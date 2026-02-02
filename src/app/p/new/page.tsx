"use client";

import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { useStoreUser } from "@/hooks/use-store-user";
import { useState } from "react";
import Link from "next/link";

export default function NewProjectPage() {
  const router = useRouter();
  const { isLoading: isUserLoading } = useStoreUser();
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user can create a project
  const canCreate = useQuery(api.projects.canCreateProject);
  const createProject = useMutation(api.projects.create);

  // Get existing projects for the back button
  const projects = useQuery(api.projects.getByUser);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim() || isCreating) return;

    setIsCreating(true);
    setError(null);

    try {
      const projectId = await createProject({
        name: projectName.trim(),
        description: projectDescription.trim() || undefined,
      });

      router.push(`/p/${projectId}`);
    } catch (err) {
      console.error("Failed to create project:", err);
      setError(err instanceof Error ? err.message : "Failed to create project. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  if (isUserLoading || canCreate === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  // If user can't create, show the reason
  if (!canCreate?.allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-warning/10">
              <LockIcon className="h-6 w-6 text-warning" />
            </div>
            <CardTitle className="text-center">Cannot Create Project</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-6">
              {canCreate?.reason === "trial_expired" && "Your free trial has expired."}
              {canCreate?.reason === "subscription_expired" && "Your subscription has expired."}
              {canCreate?.reason === "project_limit_reached" &&
                `You've reached your project limit (${canCreate.currentCount}/${canCreate.limit}). Upgrade to Pro for unlimited projects.`}
              {canCreate?.reason === "not_authenticated" && "Please sign in to create a project."}
            </p>
            <div className="flex flex-col gap-3">
              <Link href="/pricing">
                <Button className="w-full">Upgrade Plan</Button>
              </Link>
              {projects && projects.length > 0 && (
                <Link href={`/p/${projects[0]._id}`}>
                  <Button variant="outline" className="w-full">
                    Back to Project
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="text-center">Create New Project</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">
                Project Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="name"
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="My Awesome Project"
                required
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-foreground mb-1">
                Description <span className="text-muted-foreground">(optional)</span>
              </label>
              <Input
                id="description"
                type="text"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="Brief description of your project"
              />
            </div>

            <div className="flex gap-3 pt-2">
              {projects && projects.length > 0 && (
                <Link href={`/p/${projects[0]._id}`} className="flex-1">
                  <Button type="button" variant="outline" className="w-full">
                    Cancel
                  </Button>
                </Link>
              )}
              <Button
                type="submit"
                className={projects && projects.length > 0 ? "flex-1" : "w-full"}
                isLoading={isCreating}
                disabled={!projectName.trim() || isCreating}
              >
                Create Project
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

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
