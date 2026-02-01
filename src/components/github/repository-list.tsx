"use client";

import { Card } from "@/components/ui";
import { useState, useEffect } from "react";

interface Repository {
  id: string;
  name: string;
  fullName: string;
  description: string | null;
  url: string;
  isPrivate: boolean;
  updatedAt: string;
  language: string | null;
}

interface RepositoryListProps {
  onSelect?: (repo: Repository) => void;
  selectedRepoId?: string;
}

export function RepositoryList({ onSelect, selectedRepoId }: RepositoryListProps) {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchRepos = async () => {
      try {
        const response = await fetch("/api/github/repos");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch repositories");
        }

        setRepos(data.repos);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchRepos();
  }, []);

  const filteredRepos = repos.filter(
    (repo) =>
      repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-xl bg-muted"
          ></div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-center text-destructive">
        {error}
      </div>
    );
  }

  if (repos.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-muted p-6 text-center text-muted-foreground">
        No repositories found. Create a repository on GitHub first, or select
        &quot;Create new empty repo&quot;.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Search repositories..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full rounded-xl border border-border bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      />

      <div className="max-h-80 space-y-2 overflow-y-auto">
        {filteredRepos.map((repo) => (
          <Card
            key={repo.id}
            variant="outlined"
            className={`cursor-pointer p-4 transition-all hover:border-primary hover:bg-primary-light/30 ${
              selectedRepoId === repo.id
                ? "border-primary bg-primary-light"
                : ""
            }`}
            onClick={() => onSelect?.(repo)}
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="truncate font-medium text-foreground">
                    {repo.name}
                  </h4>
                  {repo.isPrivate && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      Private
                    </span>
                  )}
                </div>
                {repo.description && (
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {repo.description}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                  {repo.language && (
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-primary"></span>
                      {repo.language}
                    </span>
                  )}
                  <span>
                    Updated {new Date(repo.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              {selectedRepoId === repo.id && (
                <div className="ml-2 flex-shrink-0">
                  <CheckIcon className="h-5 w-5 text-primary" />
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
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
