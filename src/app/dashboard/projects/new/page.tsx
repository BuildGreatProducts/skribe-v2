"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
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

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repoOption, setRepoOption] = useState<"existing" | "none">("existing");

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

  if (isUserLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
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
