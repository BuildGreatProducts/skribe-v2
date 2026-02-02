"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useRef } from "react";

export function useStoreUser() {
  const { user, isLoaded } = useUser();
  const upsertUser = useMutation(api.users.upsertUser);
  const storedUser = useQuery(
    api.users.getByClerkId,
    user?.id ? { clerkId: user.id } : "skip"
  );
  // Track if we've initiated user creation to handle the race condition
  const isCreatingUser = useRef(false);

  useEffect(() => {
    if (!isLoaded || !user) return;

    // Only call upsert if user doesn't exist yet
    if (!storedUser && !isCreatingUser.current) {
      isCreatingUser.current = true;
      upsertUser({
        clerkId: user.id,
        email: user.emailAddresses[0]?.emailAddress || "",
        name: user.fullName || undefined,
        imageUrl: user.imageUrl || undefined,
      }).finally(() => {
        isCreatingUser.current = false;
      });
    }
  }, [isLoaded, user, storedUser, upsertUser]);

  // Consider loading complete only when:
  // 1. Clerk has loaded
  // 2. If there's a Clerk user, the Convex user must also exist (not null/undefined)
  const isLoading = !isLoaded || (!!user && !storedUser);

  return {
    user: storedUser,
    isLoading,
    clerkUser: user,
  };
}
