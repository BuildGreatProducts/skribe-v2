import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui";

const STARTING_POINTS = [
  {
    title: "Product Refinement",
    description: "Clarify your product vision and define core features",
    icon: "🎯",
  },
  {
    title: "Market Validation",
    description: "Analyze market fit and competitive landscape",
    icon: "📊",
  },
  {
    title: "Brand Strategy",
    description: "Define your brand voice, values, and positioning",
    icon: "✨",
  },
  {
    title: "Customer Persona",
    description: "Create detailed profiles of your ideal customers",
    icon: "👤",
  },
  {
    title: "Business Model",
    description: "Structure your revenue streams and cost model",
    icon: "💰",
  },
  {
    title: "New Features",
    description: "Explore and prioritize your product roadmap",
    icon: "🚀",
  },
  {
    title: "Tech Stack",
    description: "Choose the right technologies for your project",
    icon: "🛠",
  },
  {
    title: "Create PRD",
    description: "Generate comprehensive product requirement docs",
    icon: "📝",
  },
  {
    title: "Go to Market",
    description: "Plan your launch strategy and growth tactics",
    icon: "📈",
  },
];

const PRICING_TIERS = [
  {
    name: "Starter",
    price: "$12",
    period: "/month",
    description: "Perfect for solo builders getting started",
    features: [
      "1 project",
      "All 9 starting points",
      "Unlimited documents",
      "GitHub sync",
      "Limited conversation history",
    ],
    cta: "Start Free Trial",
    popular: false,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/month",
    description: "For serious builders with multiple projects",
    features: [
      "Unlimited projects",
      "All 9 starting points",
      "Unlimited documents",
      "GitHub sync",
      "Unlimited conversation history",
      "Priority support",
    ],
    cta: "Start Free Trial",
    popular: true,
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="Skribe" width={28} height={28} className="h-7 w-auto" />
            <span className="logo-text text-2xl text-foreground">
              Skribe
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/sign-in"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Sign in
            </Link>
            <Link href="/sign-up">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-pastel-lavender/40 to-white py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="font-serif text-5xl leading-tight text-foreground md:text-6xl">
              Your AI-Powered
              <span className="text-foreground"> Strategic Advisor</span>
            </h1>
            <p className="mt-6 text-xl text-muted-foreground">
              Create comprehensive project context documents through guided,
              conversational workflows. Let AI help you think through every
              aspect of your product.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/sign-up">
                <Button size="lg">Start Free 3-Day Trial</Button>
              </Link>
              <Link href="#features">
                <Button variant="outline" size="lg">
                  See How It Works
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              No credit card required. Full access during trial.
            </p>
          </div>
        </div>
      </section>

      {/* Features Section - 9 Starting Points */}
      <section id="features" className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-serif text-4xl font-bold text-foreground">
              9 Guided Starting Points
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Choose where to begin. Our AI advisor guides you through
              specialized conversations to build comprehensive project context.
            </p>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {STARTING_POINTS.map((point, index) => (
              <div
                key={index}
                className="rounded-2xl border border-border bg-white p-6 shadow-md transition-all hover:shadow-lg hover:border-foreground/20"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-pastel-sky text-2xl">
                  {point.icon}
                </div>
                <h3 className="font-serif text-xl font-semibold text-foreground">
                  {point.title}
                </h3>
                <p className="mt-2 text-muted-foreground">{point.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-muted py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-serif text-4xl font-bold text-foreground">
              How It Works
            </h2>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-pastel-rose text-2xl font-semibold text-foreground">
                1
              </div>
              <h3 className="font-serif text-xl">
                Connect Your Project
              </h3>
              <p className="mt-2 text-muted-foreground">
                Link your GitHub repository and give your project a name and
                description.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-pastel-mint text-2xl font-semibold text-foreground">
                2
              </div>
              <h3 className="font-serif text-xl">
                Chat with AI Advisor
              </h3>
              <p className="mt-2 text-muted-foreground">
                Choose a starting point and have guided conversations that build
                on each other.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-pastel-lavender text-2xl font-semibold text-foreground">
                3
              </div>
              <h3 className="font-serif text-xl">
                Generate & Sync Documents
              </h3>
              <p className="mt-2 text-muted-foreground">
                AI creates markdown documents that sync directly to your GitHub
                repo.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-serif text-4xl font-bold text-foreground">
              Simple, Transparent Pricing
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Start with a 3-day free trial. No credit card required.
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-2 md:mx-auto md:max-w-4xl">
            {PRICING_TIERS.map((tier, index) => (
              <div
                key={index}
                className={`relative rounded-2xl border p-8 ${
                  tier.popular
                    ? "border-foreground/20 bg-pastel-lemon/30 shadow-lg"
                    : "border-border bg-white shadow-md"
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-foreground px-4 py-1 text-sm font-medium text-white">
                    Most Popular
                  </div>
                )}
                <h3 className="font-serif text-2xl font-bold text-foreground">
                  {tier.name}
                </h3>
                <p className="mt-2 text-muted-foreground">{tier.description}</p>
                <div className="mt-6">
                  <span className="font-serif text-5xl font-bold text-foreground">
                    {tier.price}
                  </span>
                  <span className="text-muted-foreground">{tier.period}</span>
                </div>
                <ul className="mt-8 space-y-3">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <CheckIcon className="h-5 w-5 text-foreground" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/sign-up" className="mt-8 block">
                  <Button
                    variant={tier.popular ? "primary" : "outline"}
                    className="w-full"
                    size="lg"
                  >
                    {tier.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-foreground py-24">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <h2 className="font-serif text-4xl text-white">
            Ready to build with clarity?
          </h2>
          <p className="mt-4 text-xl text-white/70">
            Start your free trial today and let AI help you think through every
            aspect of your project.
          </p>
          <div className="mt-10">
            <Link href="/sign-up">
              <Button
                size="lg"
                className="bg-white text-foreground hover:bg-white/90"
              >
                Get Started Free
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <Image src="/logo.png" alt="Skribe" width={24} height={24} className="h-6 w-auto" />
              <span className="logo-text text-xl text-foreground">
                Skribe
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Skribe. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
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
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
