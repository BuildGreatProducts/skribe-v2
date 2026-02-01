"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect } from "react";

export function useStoreUser() {
  const { user, isLoaded } = useUser();
  const upsertUser = useMutation(api.users.upsertUser);
  const storedUser = useQuery(
    api.users.getByClerkId,
    user?.id ? { clerkId: user.id } : "skip"
  );

  useEffect(() => {
    if (!isLoaded || !user) return;

    // Sync user to Convex
    upsertUser({
      clerkId: user.id,
      email: user.emailAddresses[0]?.emailAddress || "",
      name: user.fullName || undefined,
      imageUrl: user.imageUrl || undefined,
    });
  }, [isLoaded, user, upsertUser]);

  return {
    user: storedUser,
    isLoading: !isLoaded || (user && storedUser === undefined),
    clerkUser: user,
  };
}
