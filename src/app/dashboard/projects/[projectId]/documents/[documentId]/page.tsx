"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

// Legacy document redirect - redirects to new /p/[projectId]/documents/[documentId] route
export default function DocumentRedirect() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const documentId = params.documentId as string;

  useEffect(() => {
    if (projectId && documentId) {
      router.replace(`/p/${projectId}/documents/${documentId}`);
    }
  }, [projectId, documentId, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
    </div>
  );
}
