"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Legacy settings redirect - redirects to new /settings route
export default function SettingsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/settings");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
    </div>
  );
}
