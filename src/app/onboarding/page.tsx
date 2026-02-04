"use client";

import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { useStoreUser } from "@/hooks/use-store-user";
import { useState, useEffect } from "react";
import Image from "next/image";

export default function OnboardingPage() {
  const router = useRouter();
  const { isLoading: isUserLoading } = useStoreUser();
  const [projectName, setProjectName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user already has projects
  const projects = useQuery(api.projects.getByUser);
  const createProject = useMutation(api.projects.create);

  // If user already has projects, redirect to first project
  useEffect(() => {
    if (projects && projects.length > 0) {
      router.replace(`/p/${projects[0]._id}`);
    }
  }, [projects, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim() || isCreating) return;

    setIsCreating(true);
    setError(null);

    try {
      const projectId = await createProject({
        name: projectName.trim(),
      });

      router.push(`/p/${projectId}`);
    } catch (err) {
      console.error("Failed to create project:", err);
      setError(err instanceof Error ? err.message : "Failed to create project. Please try again.");
      setIsCreating(false);
    }
  };

  // Show loading while checking for existing projects
  if (isUserLoading || projects === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  // If user has projects, show loading while redirecting
  if (projects && projects.length > 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-2">
            <Image src="/logo.png" alt="Skribe" width={32} height={32} className="h-8 w-auto" />
            <h1 className="logo-text text-3xl text-foreground">Skribe</h1>
          </div>
          <p className="mt-2 text-muted-foreground">Your AI-Powered Strategic Advisor</p>
        </div>

        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-pastel-mint">
              <RocketIcon className="h-8 w-8 text-foreground" />
            </div>
            <CardTitle>Welcome to Skribe!</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Create your first project to get started. You can add more details later.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="projectName" className="block text-sm font-medium text-foreground mb-2">
                  What are you building?
                </label>
                <Input
                  id="projectName"
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g., My SaaS Product"
                  required
                  autoFocus
                  className="text-lg"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Give your project a name. This helps organize your documents and conversations.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                isLoading={isCreating}
                disabled={!projectName.trim() || isCreating}
              >
                Create Project & Get Started
              </Button>
            </form>

            {/* Trial info */}
            <div className="mt-6 pt-6 border-t border-border">
              <div className="flex items-start gap-3">
                <SparklesIcon className="h-5 w-5 text-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">3-Day Free Trial</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    You have full access to all features during your trial. No credit card required.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RocketIcon({ className }: { className?: string }) {
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
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
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
