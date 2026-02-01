import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { decryptToken } from "@/lib/encryption";
import crypto from "crypto";

function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  }
  return new ConvexHttpClient(url);
}

// Generate a hash of the content for sync tracking
function generateContentHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}

// Generate a filename from the document title
function generateFilename(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") + ".md"
  );
}

interface GitHubFileResponse {
  sha?: string;
  content?: string;
}

interface GitHubErrorResponse {
  message?: string;
  documentation_url?: string;
}

// Parse GitHub API error response into a user-friendly message
function parseGitHubError(status: number, data: GitHubErrorResponse): string {
  const message = data.message || "Unknown error";

  // Rate limiting
  if (status === 403 && message.includes("rate limit")) {
    return "GitHub API rate limit exceeded. Please wait a few minutes and try again.";
  }

  // Authentication/permission errors
  if (status === 401) {
    return "GitHub authentication failed. Please reconnect your GitHub account.";
  }
  if (status === 403) {
    return "Permission denied. Please ensure you have write access to this repository.";
  }

  // Not found
  if (status === 404) {
    return "Repository not found. It may have been deleted or your access may have been revoked.";
  }

  // Conflict - file was modified on GitHub
  if (status === 409) {
    return "Conflict detected. The file was modified on GitHub. Please pull the latest changes.";
  }

  // Validation error
  if (status === 422) {
    return `GitHub validation error: ${message}`;
  }

  // Server error
  if (status >= 500) {
    return "GitHub is experiencing issues. Please try again later.";
  }

  return message;
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { projectId, documentIds } = body as {
      projectId: string;
      documentIds: string[];
    };

    if (!projectId || !documentIds || documentIds.length === 0) {
      return NextResponse.json(
        { error: "Missing projectId or documentIds" },
        { status: 400 }
      );
    }

    const convex = getConvexClient();

    // Get user from Convex to retrieve encrypted GitHub token
    const user = await convex.query(api.users.getByClerkId, {
      clerkId: userId,
    });

    if (
      !user ||
      !user.githubConnected ||
      !user.encryptedGitHubToken ||
      !user.githubTokenIv
    ) {
      return NextResponse.json(
        { error: "GitHub not connected" },
        { status: 400 }
      );
    }

    // Get project to verify ownership and get repo info
    const project = await convex.query(api.projects.getById, {
      projectId: projectId as Id<"projects">,
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 }
      );
    }

    if (!project.githubRepoName) {
      return NextResponse.json(
        { error: "No GitHub repository connected to this project" },
        { status: 400 }
      );
    }

    // Decrypt the access token
    const accessToken = await decryptToken(
      user.encryptedGitHubToken,
      user.githubTokenIv
    );

    // Get all documents to push
    const documents = await convex.query(api.documents.getByProject, {
      projectId: projectId as Id<"projects">,
    });

    const documentsToPush = documents.filter((doc) =>
      documentIds.includes(doc._id)
    );

    if (documentsToPush.length === 0) {
      return NextResponse.json(
        { error: "No valid documents to push" },
        { status: 400 }
      );
    }

    const results: {
      documentId: string;
      success: boolean;
      error?: string;
      filename?: string;
    }[] = [];

    // Push each document to GitHub
    for (const doc of documentsToPush) {
      const filename = generateFilename(doc.title);
      const filePath = `Skribe/${filename}`;
      const contentHash = generateContentHash(doc.content);

      try {
        // Check if file already exists (to get SHA for update)
        let existingSha: string | undefined;
        const checkResponse = await fetch(
          `https://api.github.com/repos/${project.githubRepoName}/contents/${filePath}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/vnd.github+json",
            },
          }
        );

        if (checkResponse.ok) {
          const existingFile =
            (await checkResponse.json()) as GitHubFileResponse;
          existingSha = existingFile.sha;
        }

        // Create or update the file
        const commitMessage = existingSha
          ? `Update ${doc.title} via Skribe`
          : `Add ${doc.title} via Skribe`;

        const pushResponse = await fetch(
          `https://api.github.com/repos/${project.githubRepoName}/contents/${filePath}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/vnd.github+json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: commitMessage,
              content: Buffer.from(doc.content).toString("base64"),
              ...(existingSha ? { sha: existingSha } : {}),
            }),
          }
        );

        if (!pushResponse.ok) {
          const errorData =
            (await pushResponse.json()) as GitHubErrorResponse;
          const errorMessage = parseGitHubError(pushResponse.status, errorData);
          throw new Error(errorMessage);
        }

        // Update document sync status
        await convex.mutation(api.documents.updateSyncStatus, {
          documentId: doc._id,
          syncStatus: "synced",
          lastSyncedHash: contentHash,
        });

        results.push({
          documentId: doc._id,
          success: true,
          filename,
        });
      } catch (error) {
        // Update document sync status to error
        await convex.mutation(api.documents.updateSyncStatus, {
          documentId: doc._id,
          syncStatus: "error",
        });

        results.push({
          documentId: doc._id,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          filename,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: failureCount === 0,
      message:
        failureCount === 0
          ? `Successfully pushed ${successCount} document(s) to GitHub`
          : `Pushed ${successCount} document(s), ${failureCount} failed`,
      results,
    });
  } catch (err) {
    console.error("Error pushing to GitHub:", err);
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error occurred";
    return NextResponse.json(
      { error: `Failed to push to GitHub: ${errorMessage}` },
      { status: 500 }
    );
  }
}
