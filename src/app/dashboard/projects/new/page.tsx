"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Textarea,
} from "@/components/ui";
import { RepositoryList } from "@/components/github/repository-list";
import { useStoreUser } from "@/hooks/use-store-user";
import Link from "next/link";

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

export default function NewProjectPage() {
  const router = useRouter();
  const { user: storedUser, isLoading: isUserLoading } = useStoreUser();
  const createProject = useMutation(api.projects.create);
  const canCreate = useQuery(api.projects.canCreateProject);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repoOption, setRepoOption] = useState<"existing" | "none">("existing");

  // Check if user is blocked from creating projects
  const isBlocked = canCreate && !canCreate.allowed;
  const blockReason = canCreate?.reason;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Project name is required");
      return;
    }

    setIsCreating(true);

    try {
      // Server-side auth handles user verification
      const projectId = await createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        githubRepoId: selectedRepo?.id,
        githubRepoName: selectedRepo?.fullName,
        githubRepoUrl: selectedRepo?.url,
      });

      router.push(`/dashboard/projects/${projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
      setIsCreating(false);
    }
  };

  if (isUserLoading || canCreate === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  // Show upgrade prompt if blocked
  if (isBlocked) {
    return (
      <div className="min-h-screen bg-muted">
        {/* Header */}
        <header className="border-b border-border bg-white">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
            <Link href="/dashboard" className="flex items-center gap-2">
              <span className="font-serif text-2xl font-bold text-primary">
                Skribe
              </span>
            </Link>
          </div>
        </header>

        {/* Upgrade Prompt */}
        <main className="mx-auto max-w-3xl px-6 py-8">
          <div className="mb-6">
            <Link
              href="/dashboard"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              &larr; Back to Dashboard
            </Link>
          </div>

          <Card className="text-center">
            <CardContent className="pt-8 pb-8">
              <div className="mb-6">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-warning/10">
                  <LockIcon className="h-8 w-8 text-warning" />
                </div>

                {blockReason === "trial_expired" && (
                  <>
                    <h2 className="font-serif text-2xl font-bold mb-2">
                      Your Trial Has Ended
                    </h2>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      Subscribe to continue creating projects and using all Skribe features.
                    </p>
                  </>
                )}

                {blockReason === "subscription_expired" && (
                  <>
                    <h2 className="font-serif text-2xl font-bold mb-2">
                      Subscription Expired
                    </h2>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      Your subscription has expired. Please resubscribe to create new projects.
                    </p>
                  </>
                )}

                {blockReason === "project_limit_reached" && (
                  <>
                    <h2 className="font-serif text-2xl font-bold mb-2">
                      Project Limit Reached
                    </h2>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      Your current plan allows 1 project. Upgrade to Pro for unlimited projects.
                    </p>
                  </>
                )}
              </div>

              <div className="flex justify-center gap-4">
                <Link href="/dashboard">
                  <Button variant="outline">Back to Dashboard</Button>
                </Link>
                <Link href="/pricing">
                  <Button>
                    <SparklesIcon className="h-4 w-4 mr-2" />
                    {blockReason === "project_limit_reached"
                      ? "Upgrade to Pro"
                      : "View Plans"}
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="font-serif text-2xl font-bold text-primary">
              Skribe
            </span>
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            &larr; Back to Dashboard
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create New Project</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-destructive">
                  {error}
                </div>
              )}

              <Input
                label="Project Name"
                placeholder="My Awesome Product"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />

              <Textarea
                label="Description (optional)"
                placeholder="A brief description of your project..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />

              {/* GitHub Repository Selection */}
              {storedUser?.githubConnected && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-medium text-foreground">
                      GitHub Repository
                    </label>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRepoOption("existing");
                        setSelectedRepo(null);
                      }}
                      className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                        repoOption === "existing"
                          ? "bg-primary text-white"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      Link Existing Repo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRepoOption("none");
                        setSelectedRepo(null);
                      }}
                      className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                        repoOption === "none"
                          ? "bg-primary text-white"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      No Repository
                    </button>
                  </div>

                  {repoOption === "existing" && (
                    <RepositoryList
                      onSelect={setSelectedRepo}
                      selectedRepoId={selectedRepo?.id}
                    />
                  )}

                  {repoOption === "none" && (
                    <p className="text-sm text-muted-foreground">
                      You can link a GitHub repository later from the project
                      settings.
                    </p>
                  )}
                </div>
              )}

              {!storedUser?.githubConnected && (
                <div className="rounded-xl border border-border bg-muted/50 p-4">
                  <p className="text-sm text-muted-foreground">
                    <Link
                      href="/dashboard"
                      className="text-primary hover:underline"
                    >
                      Connect your GitHub account
                    </Link>{" "}
                    to link repositories to your projects.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <Link href="/dashboard">
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" isLoading={isCreating}>
                  Create Project
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

// Icons
function LockIcon({ className }: { className?: string }) {
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
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function SparklesIcon({ className }: { className?: string }) {
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
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
  );
}
