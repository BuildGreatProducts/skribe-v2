"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

// Legacy project dashboard redirect - redirects to new /p/[projectId] route
export default function ProjectDashboardRedirect() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;

  useEffect(() => {
    if (projectId) {
      router.replace(`/p/${projectId}`);
    } else {
      router.replace("/onboarding");
    }
  }, [projectId, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
    </div>
  );
}
