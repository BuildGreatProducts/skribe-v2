"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { Card, CardContent, Button } from "@/components/ui";
import Link from "next/link";
import { useState, useMemo } from "react";

export default function DocumentsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const [isPushingAll, setIsPushingAll] = useState(false);
  const [pushResult, setPushResult] = useState<{ success: boolean; message: string } | null>(null);

  // Fetch project data
  const project = useQuery(
    api.projects.getById,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );

  // Fetch project documents
  const documents = useQuery(
    api.documents.getByProject,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );

  // Calculate pending documents count
  const pendingDocumentsCount = useMemo(() => {
    if (!documents) return 0;
    return documents.filter((doc) => doc.syncStatus === "pending").length;
  }, [documents]);

  const handlePushAllToGitHub = async () => {
    if (!documents || documents.length === 0 || isPushingAll || !projectId) return;

    setIsPushingAll(true);
    setPushResult(null);

    try {
      const documentIds = documents.map((doc) => doc._id);

      const response = await fetch("/api/github/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          documentIds,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setPushResult({
          success: false,
          message: data.error || "Failed to push to GitHub",
        });
      } else {
        setPushResult({
          success: data.success,
          message: data.message,
        });
      }
    } catch (error) {
      console.error("Failed to push to GitHub:", error);
      setPushResult({
        success: false,
        message: "Failed to push to GitHub. Please try again.",
      });
    } finally {
      setIsPushingAll(false);
      setTimeout(() => setPushResult(null), 5000);
    }
  };

  if (project === undefined || documents === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted px-8 py-8">
      {/* Page Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">Documents</h1>
          <p className="mt-1 text-muted-foreground">
            {documents.length === 0
              ? "Documents created during chats will appear here"
              : `${documents.length} document${documents.length !== 1 ? "s" : ""} in this project`}
          </p>
        </div>
        {project?.githubRepoName && documents.length > 0 && (
          <div className="flex items-center gap-3">
            {pendingDocumentsCount > 0 && (
              <span className="text-sm text-warning">
                {pendingDocumentsCount} pending
              </span>
            )}
            <Button
              variant="outline"
              onClick={handlePushAllToGitHub}
              disabled={isPushingAll}
              isLoading={isPushingAll}
            >
              <GitHubIcon className="h-4 w-4 mr-2" />
              Push All to GitHub
            </Button>
          </div>
        )}
      </div>

      {/* Push Result Feedback */}
      {pushResult && (
        <div
          className={`mb-6 rounded-xl border p-4 ${
            pushResult.success
              ? "border-success/30 bg-success/10"
              : "border-destructive/30 bg-destructive/10"
          }`}
        >
          <div className="flex items-center gap-3">
            {pushResult.success ? (
              <CheckIcon className="h-5 w-5 text-success flex-shrink-0" />
            ) : (
              <WarningIcon className="h-5 w-5 text-destructive flex-shrink-0" />
            )}
            <p
              className={`text-sm font-medium ${
                pushResult.success ? "text-success" : "text-destructive"
              }`}
            >
              {pushResult.message}
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-white p-12">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-light">
            <DocumentIcon className="h-8 w-8 text-primary" />
          </div>
          <h2 className="font-serif text-xl font-semibold mb-2">No documents yet</h2>
          <p className="text-muted-foreground text-center max-w-md mb-6">
            Documents are created during your conversations with the AI advisor.
            Start a chat to generate your first document.
          </p>
          <Button onClick={() => router.push(`/p/${projectId}`)}>
            Start a Conversation
          </Button>
        </div>
      ) : (
        /* Documents Grid */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => (
            <Link key={doc._id} href={`/p/${projectId}/documents/${doc._id}`}>
              <Card className="h-full cursor-pointer transition-all hover:shadow-lg hover:border-primary/30">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <DocumentTypeIcon type={doc.type} className="h-5 w-5 flex-shrink-0" />
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {doc.type}
                      </span>
                    </div>
                    <SyncStatusBadge status={doc.syncStatus} />
                  </div>
                  <h3 className="font-medium text-foreground mb-1 line-clamp-2">
                    {doc.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Last edited {new Date(doc.updatedAt).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {getDocumentPreview(doc.content)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// Get first 150 characters of document content as preview
function getDocumentPreview(content: string): string {
  // Remove markdown headers and extra whitespace
  const cleaned = content
    .replace(/^#+\s+.+$/gm, "")
    .replace(/\*\*/g, "")
    .replace(/\n+/g, " ")
    .trim();
  return cleaned.slice(0, 150) + (cleaned.length > 150 ? "..." : "");
}

// Components
function SyncStatusBadge({ status }: { status: "synced" | "pending" | "error" }) {
  const config = {
    synced: { label: "Synced", className: "bg-success/10 text-success" },
    pending: { label: "Pending", className: "bg-warning/10 text-warning" },
    error: { label: "Error", className: "bg-destructive/10 text-destructive" },
  };

  const { label, className } = config[status];

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

function DocumentTypeIcon({ type, className }: { type: string; className?: string }) {
  const typeColors: Record<string, string> = {
    prd: "text-blue-500",
    persona: "text-purple-500",
    market: "text-green-500",
    brand: "text-pink-500",
    business: "text-amber-500",
    feature: "text-cyan-500",
    tech: "text-indigo-500",
    gtm: "text-orange-500",
    custom: "text-muted-foreground",
  };

  const color = typeColors[type] || typeColors.custom;

  return (
    <svg
      className={`${className} ${color}`}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" x2="8" y1="13" y2="13" />
      <line x1="16" x2="8" y1="17" y2="17" />
      <line x1="10" x2="8" y1="9" y2="9" />
    </svg>
  );
}

// Icons
function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}
