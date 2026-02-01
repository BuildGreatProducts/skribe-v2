"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { UserProfileDropdown } from "@/components/user-profile-dropdown";
import { ConnectGitHubButton } from "@/components/github/connect-github-button";
import { TrialBanner } from "@/components/billing";
import { useStoreUser } from "@/hooks/use-store-user";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useMemo } from "react";

export default function DashboardPage() {
  const { user: clerkUser, isLoaded: isClerkLoaded } = useUser();
  const { user: storedUser, isLoading: isUserLoading } = useStoreUser();
  const searchParams = useSearchParams();
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Get user's projects - uses server-side auth
  const projectsQuery = useQuery(api.projects.getByUser, {});

  // Projects query always runs, returns [] if not authenticated
  const projectsData = projectsQuery ?? [];
  const isProjectsLoading = projectsQuery === undefined;

  // Disconnect GitHub mutation
  const disconnectGitHub = useMutation(api.users.disconnectGitHub);

  // Calculate trial status
  const trialStatus = useMemo(() => {
    if (!storedUser || storedUser.subscriptionStatus !== "trial") {
      return { showBanner: false, daysRemaining: 0, isExpired: false };
    }

    const now = Date.now();
    const trialEndsAt = storedUser.trialEndsAt;
    if (!trialEndsAt) {
      return { showBanner: false, daysRemaining: 0, isExpired: false };
    }

    const isExpired = now > trialEndsAt;
    const daysRemaining = Math.max(
      0,
      Math.ceil((trialEndsAt - now) / (1000 * 60 * 60 * 24))
    );

    return { showBanner: true, daysRemaining, isExpired };
  }, [storedUser]);

  // Handle URL query params for GitHub OAuth status
  useEffect(() => {
    const githubConnected = searchParams.get("github_connected");
    const githubError = searchParams.get("github_error");

    if (githubConnected === "true") {
      setNotification({
        type: "success",
        message: "GitHub connected successfully!",
      });
    } else if (githubError) {
      setNotification({
        type: "error",
        message: `GitHub connection failed: ${githubError}`,
      });
    }

    // Clear notification after 5 seconds
    if (githubConnected || githubError) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  const handleDisconnectGitHub = async () => {
    if (!clerkUser?.id) return;
    try {
      const res = await fetch("/api/github/disconnect", { method: "POST" });

      if (!res.ok) {
        // Parse error response if possible
        let errorMessage = "Failed to disconnect GitHub";
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // Use status text if JSON parsing fails
          errorMessage = `Failed to disconnect GitHub: ${res.status} ${res.statusText}`;
        }
        console.error(errorMessage);
        setNotification({
          type: "error",
          message: errorMessage,
        });
        return;
      }

      // Only reload on success
      window.location.reload();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      console.error("Failed to disconnect GitHub:", errorMessage);
      setNotification({
        type: "error",
        message: `Failed to disconnect GitHub: ${errorMessage}`,
      });
    }
  };

  if (!isClerkLoaded || isUserLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      {/* Trial Banner */}
      {trialStatus.showBanner && (
        <TrialBanner
          daysRemaining={trialStatus.daysRemaining}
          isExpired={trialStatus.isExpired}
        />
      )}

      {/* Header */}
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="font-serif text-2xl font-bold text-primary">
              Skribe
            </span>
          </Link>
          <UserProfileDropdown />
        </div>
      </header>

      {/* Notification */}
      {notification && (
        <div
          className={`mx-auto mt-4 max-w-7xl px-6 ${
            notification.type === "success"
              ? "text-success"
              : "text-destructive"
          }`}
        >
          <div
            className={`rounded-xl p-4 ${
              notification.type === "success"
                ? "bg-success/10 border border-success/20"
                : "bg-destructive/10 border border-destructive/20"
            }`}
          >
            {notification.message}
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* GitHub Connection Status */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>GitHub Connection</CardTitle>
          </CardHeader>
          <CardContent>
            <ConnectGitHubButton
              isConnected={storedUser?.githubConnected ?? false}
              username={storedUser?.githubUsername}
              onDisconnect={handleDisconnectGitHub}
            />
            {!storedUser?.githubConnected && (
              <p className="mt-3 text-sm text-muted-foreground">
                Connect your GitHub account to link repositories and sync
                documents.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Subscription Status */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {storedUser?.subscriptionTier === "pro"
                    ? "Pro"
                    : storedUser?.subscriptionTier === "starter"
                      ? "Starter"
                      : "Free Trial"}
                </p>
                {storedUser?.subscriptionStatus === "trial" &&
                  storedUser?.trialEndsAt && (
                    <p className="text-sm text-muted-foreground">
                      Trial ends{" "}
                      {new Date(storedUser.trialEndsAt).toLocaleDateString()}
                    </p>
                  )}
              </div>
              {storedUser?.subscriptionTier !== "pro" && (
                <Link href="/pricing">
                  <Button variant="secondary" size="sm">
                    Upgrade
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Projects Section */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-serif text-2xl font-bold">Your Projects</h2>
          <Link href="/dashboard/projects/new">
            <Button>New Project</Button>
          </Link>
        </div>

        {isProjectsLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-40 animate-pulse rounded-2xl bg-white shadow-md"
              ></div>
            ))}
          </div>
        ) : projectsData.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-light">
              <FolderIcon className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-serif text-xl font-semibold">No projects yet</h3>
            <p className="mt-2 text-muted-foreground">
              Create your first project to start building context with AI.
            </p>
            <Link href="/dashboard/projects/new" className="mt-6 inline-block">
              <Button>Create Your First Project</Button>
            </Link>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projectsData.map((project) => (
              <Link
                key={project._id}
                href={`/dashboard/projects/${project._id}`}
              >
                <Card className="h-full cursor-pointer transition-all hover:shadow-lg hover:border-primary/30">
                  <CardHeader>
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {project.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {project.description}
                      </p>
                    )}
                    {project.githubRepoName && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <GitHubIcon className="h-4 w-4" />
                        <span>{project.githubRepoName}</span>
                      </div>
                    )}
                    <p className="mt-3 text-xs text-muted-foreground">
                      Updated{" "}
                      {new Date(project.updatedAt).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function FolderIcon({ className }: { className?: string }) {
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
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
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
