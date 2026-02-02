"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

// Legacy agent redirect - redirects to new /p/[projectId]/agent/[agentId] route
export default function AgentRedirect() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const agentId = params.agentId as string;

  useEffect(() => {
    if (projectId && agentId) {
      router.replace(`/p/${projectId}/agent/${agentId}`);
    }
  }, [projectId, agentId, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
    </div>
  );
}
