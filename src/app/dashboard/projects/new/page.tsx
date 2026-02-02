"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Legacy new project redirect - redirects to new /p/new route
export default function NewProjectRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/p/new");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
    </div>
  );
}
