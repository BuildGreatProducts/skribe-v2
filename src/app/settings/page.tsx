"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { useStoreUser } from "@/hooks/use-store-user";

export default function SettingsPage() {
  const router = useRouter();
  const { user: storedUser, isLoading, clerkUser } = useStoreUser();
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);
  const [isLoadingCheckout, setIsLoadingCheckout] = useState<string | null>(null);
  const [isDisconnectingGitHub, setIsDisconnectingGitHub] = useState(false);

  // Get default project for back navigation
  const defaultProject = useQuery(api.projects.getDefaultProject);

  const handleDisconnectGitHub = async () => {
    setIsDisconnectingGitHub(true);
    try {
      const response = await fetch("/api/github/disconnect", {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to disconnect GitHub");
      }

      // Refresh the page to reflect the changes
      router.refresh();
    } catch (error) {
      console.error("GitHub disconnect error:", error);
      alert("Failed to disconnect GitHub. Please try again.");
    } finally {
      setIsDisconnectingGitHub(false);
    }
  };

  const handleManageBilling = async () => {
    setIsLoadingPortal(true);
    try {
      const response = await fetch("/api/polar/portal");
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          alert("No active subscription found. Please subscribe first.");
          return;
        }
        throw new Error(data.error || "Failed to open billing portal");
      }

      window.location.href = data.url;
    } catch (error) {
      console.error("Portal error:", error);
      alert("Failed to open billing portal. Please try again.");
    } finally {
      setIsLoadingPortal(false);
    }
  };

  const handleUpgrade = async (tier: "starter" | "pro") => {
    setIsLoadingCheckout(tier);
    try {
      const response = await fetch("/api/polar/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      window.location.href = data.url;
    } catch (error) {
      console.error("Checkout error:", error);
      alert("Failed to start checkout. Please try again.");
    } finally {
      setIsLoadingCheckout(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  const subscriptionTier = storedUser?.subscriptionTier || "free";
  const subscriptionStatus = storedUser?.subscriptionStatus || "trial";
  const trialEndsAt = storedUser?.trialEndsAt;
  const subscriptionEndsAt = storedUser?.subscriptionEndsAt;

  const now = Date.now();
  const trialDaysRemaining = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt - now) / (1000 * 60 * 60 * 24)))
    : 0;
  const subscriptionDaysRemaining = subscriptionEndsAt
    ? Math.max(0, Math.ceil((subscriptionEndsAt - now) / (1000 * 60 * 60 * 24)))
    : null;

  const isTrialExpired = subscriptionStatus === "trial" && trialEndsAt && now > trialEndsAt;
  const isTrialActive = subscriptionStatus === "trial" && !isTrialExpired;
  const hasActiveSubscription = subscriptionStatus === "active";
  const isCancelled = subscriptionStatus === "cancelled";

  const backLink = defaultProject ? `/p/${defaultProject._id}` : "/onboarding";

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-6 py-4">
          <Link
            href={backLink}
            className="rounded-lg p-2 hover:bg-muted"
            aria-label="Back"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="font-serif text-xl font-semibold">Settings</h1>
            <p className="text-sm text-muted-foreground">
              Manage your account and subscription
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8 space-y-6">
        {/* Account Information */}
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              {clerkUser?.imageUrl && (
                <img
                  src={clerkUser.imageUrl}
                  alt="Profile"
                  className="h-16 w-16 rounded-full"
                />
              )}
              <div>
                <p className="font-medium">{clerkUser?.fullName || "User"}</p>
                <p className="text-sm text-muted-foreground">
                  {clerkUser?.emailAddresses[0]?.emailAddress}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Subscription Status */}
        <Card>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Current Plan */}
            <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
              <div>
                <p className="text-sm text-muted-foreground">Current Plan</p>
                <p className="text-xl font-semibold capitalize">
                  {subscriptionTier === "free" ? "Free" : subscriptionTier}
                </p>
              </div>
              <SubscriptionStatusBadge
                status={subscriptionStatus}
                isTrialExpired={isTrialExpired || false}
              />
            </div>

            {/* Trial Status */}
            {isTrialActive && (
              <div className="p-4 rounded-xl border border-warning/30 bg-warning/10">
                <div className="flex items-start gap-3">
                  <ClockIcon className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-warning">Trial Period</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {trialDaysRemaining > 0
                        ? `Your trial ends in ${trialDaysRemaining} day${trialDaysRemaining !== 1 ? "s" : ""}. Subscribe to keep full access.`
                        : "Your trial ends today. Subscribe to keep full access."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Trial Expired */}
            {isTrialExpired && (
              <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10">
                <div className="flex items-start gap-3">
                  <WarningIcon className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-destructive">Trial Expired</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your free trial has ended. Subscribe to continue using Skribe.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Cancelled Notice */}
            {isCancelled && subscriptionDaysRemaining !== null && (
              <div className="p-4 rounded-xl border border-warning/30 bg-warning/10">
                <div className="flex items-start gap-3">
                  <WarningIcon className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-warning">Subscription Cancelled</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your subscription will end in {subscriptionDaysRemaining} day
                      {subscriptionDaysRemaining !== 1 ? "s" : ""}. You can resubscribe
                      anytime.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Upgrade/Subscribe Buttons */}
            <div className="space-y-3">
              {!hasActiveSubscription && !isCancelled && (
                <>
                  <p className="text-sm font-medium">Choose a plan:</p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <button
                      onClick={() => handleUpgrade("starter")}
                      disabled={isLoadingCheckout !== null}
                      className="p-4 rounded-xl border border-border hover:border-primary transition-colors text-left"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold">Starter</span>
                        <span className="font-bold">$12/mo</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        1 project, all features
                      </p>
                      {isLoadingCheckout === "starter" && (
                        <div className="mt-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                      )}
                    </button>

                    <button
                      onClick={() => handleUpgrade("pro")}
                      disabled={isLoadingCheckout !== null}
                      className="p-4 rounded-xl border-2 border-primary bg-primary/5 hover:bg-primary/10 transition-colors text-left"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold">Pro</span>
                        <span className="font-bold">$29/mo</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Unlimited projects
                      </p>
                      {isLoadingCheckout === "pro" && (
                        <div className="mt-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                      )}
                    </button>
                  </div>
                </>
              )}

              {/* Manage Billing Button */}
              {(hasActiveSubscription || isCancelled) && (
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="outline"
                    onClick={handleManageBilling}
                    isLoading={isLoadingPortal}
                  >
                    <CreditCardIcon className="h-4 w-4 mr-2" />
                    Manage Billing
                  </Button>

                  {subscriptionTier === "starter" && (
                    <Button
                      onClick={() => handleUpgrade("pro")}
                      isLoading={isLoadingCheckout === "pro"}
                    >
                      Upgrade to Pro
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Plan Features */}
            <div className="pt-4 border-t border-border">
              <p className="text-sm font-medium mb-3">Your plan includes:</p>
              <ul className="space-y-2">
                <PlanFeature
                  included={true}
                  feature={
                    subscriptionTier === "pro" ? "Unlimited projects" : "1 project"
                  }
                />
                <PlanFeature included={true} feature="All 9 starting points" />
                <PlanFeature included={true} feature="Document generation" />
                <PlanFeature included={true} feature="GitHub sync" />
                <PlanFeature
                  included={subscriptionTier === "pro"}
                  feature="Unlimited conversation history"
                />
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* GitHub Connection */}
        <Card>
          <CardHeader>
            <CardTitle>GitHub Connection</CardTitle>
          </CardHeader>
          <CardContent>
            {storedUser?.githubConnected ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <GitHubIcon className="h-6 w-6" />
                  <div>
                    <p className="font-medium">
                      Connected as @{storedUser.githubUsername}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      You can push documents to your GitHub repos
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnectGitHub}
                  disabled={isDisconnectingGitHub}
                  isLoading={isDisconnectingGitHub}
                >
                  Disconnect
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Not connected</p>
                  <p className="text-sm text-muted-foreground">
                    Connect GitHub to sync your documents
                  </p>
                </div>
                <Button
                  onClick={() =>
                    (window.location.href = "/api/github/auth")
                  }
                >
                  <GitHubIcon className="h-4 w-4 mr-2" />
                  Connect GitHub
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function SubscriptionStatusBadge({
  status,
  isTrialExpired,
}: {
  status: string;
  isTrialExpired: boolean;
}) {
  if (isTrialExpired) {
    return (
      <span className="rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">
        Expired
      </span>
    );
  }

  const statusConfig: Record<string, { label: string; className: string }> = {
    trial: { label: "Trial", className: "bg-warning/10 text-warning" },
    active: { label: "Active", className: "bg-success/10 text-success" },
    cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
    expired: { label: "Expired", className: "bg-destructive/10 text-destructive" },
  };

  const config = statusConfig[status] || statusConfig.expired;

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}

function PlanFeature({ included, feature }: { included: boolean; feature: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {included ? (
        <CheckIcon className="h-4 w-4 text-success flex-shrink-0" />
      ) : (
        <XIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      )}
      <span className={included ? "" : "text-muted-foreground"}>{feature}</span>
    </li>
  );
}

// Icons
function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function CreditCardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
    </svg>
  );
}
