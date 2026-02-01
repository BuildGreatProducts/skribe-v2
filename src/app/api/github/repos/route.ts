import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  }
  return new ConvexHttpClient(url);
}

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const convex = getConvexClient();

    // Get user from Convex to retrieve GitHub token
    const user = await convex.query(api.users.getByClerkId, {
      clerkId: userId,
    });

    if (!user || !user.githubConnected || !user.githubAccessToken) {
      return NextResponse.json(
        { error: "GitHub not connected" },
        { status: 400 }
      );
    }

    // Fetch user's repositories from GitHub
    const response = await fetch(
      "https://api.github.com/user/repos?sort=updated&per_page=100",
      {
        headers: {
          Authorization: `Bearer ${user.githubAccessToken}`,
          Accept: "application/vnd.github+json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.message || "Failed to fetch repositories" },
        { status: response.status }
      );
    }

    const repos = await response.json();

    // Return simplified repo data
    const simplifiedRepos = repos.map(
      (repo: {
        id: number;
        name: string;
        full_name: string;
        description: string | null;
        html_url: string;
        private: boolean;
        updated_at: string;
        language: string | null;
      }) => ({
        id: repo.id.toString(),
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        url: repo.html_url,
        isPrivate: repo.private,
        updatedAt: repo.updated_at,
        language: repo.language,
      })
    );

    return NextResponse.json({ repos: simplifiedRepos });
  } catch (err) {
    console.error("Error fetching repositories:", err);
    return NextResponse.json(
      { error: "Failed to fetch repositories" },
      { status: 500 }
    );
  }
}
