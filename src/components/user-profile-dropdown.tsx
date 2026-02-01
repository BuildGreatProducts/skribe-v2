"use client";

import { UserButton, useUser } from "@clerk/nextjs";

export function UserProfileDropdown() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="h-8 w-8 animate-pulse rounded-full bg-muted"></div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-sm text-muted-foreground md:inline">
        {user.fullName || user.emailAddresses[0]?.emailAddress}
      </span>
      <UserButton
        afterSignOutUrl="/"
        appearance={{
          elements: {
            avatarBox: "h-8 w-8",
            userButtonPopoverCard: "rounded-2xl shadow-lg",
            userButtonPopoverActionButton: "rounded-xl",
          },
        }}
      />
    </div>
  );
}
