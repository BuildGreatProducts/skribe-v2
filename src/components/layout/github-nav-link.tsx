"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useStoreUser } from "@/hooks/use-store-user";
import Link from "next/link";

interface GitHubNavLinkProps {
  currentProjectId: string;
}

export function GitHubNavLink({ currentProjectId }: GitHubNavLinkProps) {
  const { user: storedUser, isLoading: isUserLoading } = useStoreUser();
  const currentProject = useQuery(
    api.projects.getById,
    currentProjectId ? { projectId: currentProjectId as Id<"projects"> } : "skip"
  );

  // Loading state
  if (isUserLoading || currentProject === undefined) {
    return (
      <div className="px-3 py-1">
        <div className="h-8 animate-pulse rounded-md bg-muted"></div>
      </div>
    );
  }

  const isGitHubConnected = storedUser?.githubConnected ?? false;
  const hasLinkedRepo = !!currentProject?.githubRepoUrl;

  // State 1: GitHub not connected - show connect link
  if (!isGitHubConnected) {
    return (
      <div className="px-3 py-1">
        <Link
          href="/api/github/auth"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <GitHubIcon className="h-4 w-4" />
          <span>Connect GitHub</span>
        </Link>
      </div>
    );
  }

  // State 2: GitHub connected + repo linked - show repo link
  if (hasLinkedRepo) {
    return (
      <div className="px-3 py-1">
        <a
          href={currentProject.githubRepoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <GitHubIcon className="h-4 w-4" />
          <span className="flex-1 truncate">{currentProject.githubRepoName}</span>
          <ExternalLinkIcon className="h-3 w-3 flex-shrink-0" />
        </a>
      </div>
    );
  }

  // State 3: GitHub connected but no repo linked - show link repo option
  return (
    <div className="px-3 py-1">
      <Link
        href={`/p/${currentProjectId}/settings`}
        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <GitHubIcon className="h-4 w-4" />
        <span>Link Repository</span>
      </Link>
    </div>
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

function ExternalLinkIcon({ className }: { className?: string }) {
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
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}
