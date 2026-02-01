"use client";

import Link from "next/link";
import { Button } from "@/components/ui";

interface TrialBannerProps {
  daysRemaining: number;
  isExpired: boolean;
}

export function TrialBanner({ daysRemaining, isExpired }: TrialBannerProps) {
  if (isExpired) {
    return (
      <div className="bg-destructive/10 border-b border-destructive/20">
        <div className="mx-auto max-w-7xl px-6 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <WarningIcon className="h-5 w-5 text-destructive flex-shrink-0" />
              <p className="text-sm font-medium text-destructive">
                Your free trial has ended. Subscribe now to continue using Skribe.
              </p>
            </div>
            <Link href="/pricing">
              <Button size="sm">
                View Plans
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-warning/10 border-b border-warning/20">
      <div className="mx-auto max-w-7xl px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ClockIcon className="h-5 w-5 text-warning flex-shrink-0" />
            <p className="text-sm font-medium text-warning">
              {daysRemaining === 0
                ? "Your trial ends today!"
                : daysRemaining === 1
                ? "Your trial ends tomorrow!"
                : `${daysRemaining} days left in your free trial`}
            </p>
          </div>
          <Link href="/pricing">
            <Button size="sm" variant="outline" className="border-warning text-warning hover:bg-warning/10">
              Upgrade Now
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// Icons
function ClockIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
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
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}
