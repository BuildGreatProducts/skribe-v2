"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useStoreUser } from "@/hooks/use-store-user";

// Legacy dashboard redirect - redirects to new /p/ routes
export default function DashboardRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoading: isUserLoading } = useStoreUser();
  const defaultProject = useQuery(api.projects.getDefaultProject);

  useEffect(() => {
    if (isUserLoading) return;
    if (defaultProject === undefined) return;

    // Preserve any query params (like github_connected)
    const queryString = searchParams.toString();
    const suffix = queryString ? `?${queryString}` : "";

    if (defaultProject) {
      router.replace(`/p/${defaultProject._id}${suffix}`);
    } else {
      router.replace(`/onboarding${suffix}`);
    }
  }, [defaultProject, router, isUserLoading, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
    </div>
  );
}
