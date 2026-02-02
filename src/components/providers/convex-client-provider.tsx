"use client";

import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth } from "@clerk/nextjs";
import { ReactNode, useMemo } from "react";

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const convex = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) {
      // Return a mock client during build or when URL is not set
      // This will show an error state in the app when Convex is required
      console.warn("NEXT_PUBLIC_CONVEX_URL is not set");
      return null;
    }
    return new ConvexReactClient(url);
  }, []);

  if (!convex) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">
          Convex not configured. Please set NEXT_PUBLIC_CONVEX_URL.
        </p>
      </div>
    );
  }

  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
