"use client";

import { AppShell } from "@/components/layout";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useEffect } from "react";
import { useStoreUser } from "@/hooks/use-store-user";

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string | undefined;
  const { isLoading: isUserLoading } = useStoreUser();

  // Fetch the project to verify it exists and user has access
  const project = useQuery(
    api.projects.getById,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );

  // Get default project for redirect if needed
  const defaultProject = useQuery(api.projects.getDefaultProject);

  // Handle redirects
  useEffect(() => {
    // Still loading user
    if (isUserLoading) return;

    // No project ID in URL, redirect to default project or onboarding
    if (!projectId) {
      if (defaultProject === undefined) return; // Still loading
      if (defaultProject) {
        router.replace(`/p/${defaultProject._id}`);
      } else {
        router.replace("/onboarding");
      }
      return;
    }

    // Project ID in URL but project doesn't exist or user doesn't have access
    if (project === null) {
      if (defaultProject === undefined) return; // Still loading
      if (defaultProject) {
        router.replace(`/p/${defaultProject._id}`);
      } else {
        router.replace("/onboarding");
      }
    }
  }, [projectId, project, defaultProject, router, isUserLoading]);

  // Show loading state while checking project access
  if (isUserLoading || project === undefined || (projectId && project === null)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  // No project ID means we're redirecting
  if (!projectId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return <AppShell projectId={projectId}>{children}</AppShell>;
}
