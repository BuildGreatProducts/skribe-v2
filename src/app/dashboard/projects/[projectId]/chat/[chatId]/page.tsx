"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

// Legacy chat redirect - redirects to new /p/[projectId]/chat/[chatId] route
export default function ChatRedirect() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const chatId = params.chatId as string;

  useEffect(() => {
    if (projectId && chatId) {
      router.replace(`/p/${projectId}/chat/${chatId}`);
    }
  }, [projectId, chatId, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
    </div>
  );
}
