"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { useStoreUser } from "@/hooks/use-store-user";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

export function UserNav() {
  const { user, isLoaded } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get user subscription info from Convex
  const { user: storedUser } = useStoreUser();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!isLoaded) {
    return (
      <div className="border-t border-border px-3 py-3">
        <div className="h-12 animate-pulse rounded-lg bg-muted"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const subscriptionTier = storedUser?.subscriptionTier || "free";
  const subscriptionStatus = storedUser?.subscriptionStatus || "trial";

  const tierLabel =
    subscriptionStatus === "trial"
      ? "Trial"
      : subscriptionTier === "pro"
        ? "Pro"
        : subscriptionTier === "starter"
          ? "Starter"
          : "Free";

  const tierColor =
    subscriptionStatus === "trial"
      ? "bg-warning/10 text-warning"
      : subscriptionTier === "pro"
        ? "bg-primary/10 text-primary"
        : "bg-muted text-muted-foreground";

  return (
    <div className="border-t border-border px-3 py-3" ref={dropdownRef}>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted",
            isOpen && "bg-muted"
          )}
        >
          <div className="h-8 w-8 flex-shrink-0 overflow-hidden rounded-full bg-primary-light">
            {user.imageUrl ? (
              <img
                src={user.imageUrl}
                alt={user.fullName || "User"}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-medium text-primary">
                {(user.fullName || user.emailAddresses[0]?.emailAddress || "U")[0].toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {user.fullName || user.emailAddresses[0]?.emailAddress}
            </p>
            <span className={cn("inline-block rounded px-1.5 py-0.5 text-xs font-medium", tierColor)}>
              {tierLabel}
            </span>
          </div>
          <ChevronIcon className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
        </button>

        {isOpen && (
          <div className="absolute bottom-full left-0 right-0 mb-1 rounded-lg border border-border bg-white shadow-lg">
            <div className="py-1">
              <Link
                href="/settings"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
              >
                <SettingsIcon className="h-4 w-4" />
                Settings
              </Link>
              <Link
                href="/pricing"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
              >
                <CreditCardIcon className="h-4 w-4" />
                Billing
              </Link>
            </div>
            <div className="border-t border-border py-1">
              <div className="px-3 py-2">
                <UserButton
                  appearance={{
                    elements: {
                      rootBox: "w-full",
                      userButtonTrigger: "w-full justify-start",
                      userButtonBox: "flex-row-reverse",
                      avatarBox: "hidden",
                    },
                  }}
                  showName={false}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function CreditCardIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </svg>
  );
}
