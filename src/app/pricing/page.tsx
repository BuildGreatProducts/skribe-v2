"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import Link from "next/link";
import Image from "next/image";
import { useStoreUser } from "@/hooks/use-store-user";

const PRICING_TIERS = [
  {
    id: "starter" as const,
    name: "Starter",
    price: "$12",
    period: "/month",
    description: "Perfect for solo builders",
    features: [
      "1 project",
      "All 9 starting points",
      "Document generation",
      "GitHub sync",
      "Limited conversation history",
    ],
    cta: "Get Started",
    popular: false,
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: "$29",
    period: "/month",
    description: "For serious builders",
    features: [
      "Unlimited projects",
      "All 9 starting points",
      "Document generation",
      "GitHub sync",
      "Unlimited conversation history",
      "Priority support",
    ],
    cta: "Go Pro",
    popular: true,
  },
];

export default function PricingPage() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Only use Clerk hooks after mounting on client
  if (!isMounted) {
    return <PricingPageSkeleton />;
  }

  return <PricingPageContent />;
}

function PricingPageSkeleton() {
  return (
    <div className="min-h-screen bg-muted">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="Skribe" width={28} height={28} className="h-7 w-auto" />
            <span className="logo-text text-2xl text-foreground">Skribe</span>
          </Link>
          <div className="h-10 w-24 animate-pulse rounded-xl bg-muted"></div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="font-serif text-4xl font-bold text-foreground mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Choose the plan that fits your needs. All plans include a 3-day free trial
            with full access.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          <div className="h-96 animate-pulse rounded-xl bg-white border border-border"></div>
          <div className="h-96 animate-pulse rounded-xl bg-white border border-border"></div>
        </div>
      </main>
    </div>
  );
}

function PricingPageContent() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();
  const { user: storedUser } = useStoreUser();
  const [isLoadingCheckout, setIsLoadingCheckout] = useState<string | null>(null);

  const handleSubscribe = async (tier: "starter" | "pro") => {
    // Redirect to sign-up if not signed in (or still loading)
    if (!isLoaded || !isSignedIn) {
      router.push("/sign-up");
      return;
    }

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

      // Redirect to Polar checkout
      window.location.href = data.url;
    } catch (error) {
      console.error("Checkout error:", error);
      alert("Failed to start checkout. Please try again.");
    } finally {
      setIsLoadingCheckout(null);
    }
  };

  // Check if user already has a subscription
  const currentTier = storedUser?.subscriptionTier;
  const isSubscribed = currentTier && currentTier !== "free";

  // Determine what to show in header (handles SSR and loading states)
  const showAuthButtons = isLoaded && !isSignedIn;
  const showDashboardLink = isLoaded && isSignedIn;

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="Skribe" width={28} height={28} className="h-7 w-auto" />
            <span className="logo-text text-2xl text-foreground">Skribe</span>
          </Link>
          <div className="flex items-center gap-4">
            {showDashboardLink && (
              <Link href="/dashboard">
                <Button variant="outline">Go to Dashboard</Button>
              </Link>
            )}
            {showAuthButtons && (
              <>
                <Link href="/sign-in">
                  <Button variant="outline">Sign In</Button>
                </Link>
                <Link href="/sign-up">
                  <Button>Get Started</Button>
                </Link>
              </>
            )}
            {!isLoaded && (
              <div className="h-10 w-24 animate-pulse rounded-xl bg-muted"></div>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-5xl px-6 py-16">
        {/* Heading */}
        <div className="text-center mb-12">
          <h1 className="font-serif text-4xl font-bold text-foreground mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Choose the plan that fits your needs. All plans include a 3-day free trial
            with full access.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {PRICING_TIERS.map((tier) => {
            const isCurrentTier = currentTier === tier.id;

            return (
              <Card
                key={tier.id}
                className={`relative ${
                  tier.popular ? "border-primary shadow-lg" : ""
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-white text-xs font-medium px-3 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}

                <CardHeader className="text-center pb-2">
                  <CardTitle className="font-serif text-2xl">{tier.name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {tier.description}
                  </p>
                </CardHeader>

                <CardContent className="text-center">
                  <div className="my-6">
                    <span className="font-serif text-5xl font-bold text-foreground">
                      {tier.price}
                    </span>
                    <span className="text-muted-foreground">{tier.period}</span>
                  </div>

                  <ul className="space-y-3 mb-8 text-left">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2">
                        <CheckIcon className="h-5 w-5 text-success flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {isCurrentTier ? (
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : (
                    <Button
                      className={`w-full ${tier.popular ? "" : "bg-secondary hover:bg-secondary/90"}`}
                      onClick={() => handleSubscribe(tier.id)}
                      isLoading={isLoadingCheckout === tier.id}
                      disabled={isLoadingCheckout !== null}
                    >
                      {tier.cta}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* FAQ or additional info */}
        <div className="mt-16 text-center">
          <h2 className="font-serif text-2xl font-semibold mb-4">
            Start your free trial today
          </h2>
          <p className="text-muted-foreground mb-6">
            No credit card required. Get full access for 3 days.
          </p>
          {showAuthButtons && (
            <Link href="/sign-up">
              <Button size="lg">Start Free Trial</Button>
            </Link>
          )}
        </div>

        {/* Already subscribed message */}
        {isSubscribed && (
          <div className="mt-8 text-center p-4 bg-white rounded-xl border border-border">
            <p className="text-muted-foreground">
              You&apos;re currently on the <strong>{currentTier}</strong> plan.{" "}
              <Link
                href="/dashboard/settings"
                className="text-primary hover:underline"
              >
                Manage your subscription
              </Link>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
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
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
