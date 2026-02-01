"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { useStoreUser } from "@/hooks/use-store-user";
import Link from "next/link";
import { useState } from "react";

// Starting points configuration
const STARTING_POINTS = [
  {
    id: "product_refinement",
    title: "Product Refinement",
    description: "Clarify your product vision and value proposition",
    icon: "lightbulb",
    order: 1,
  },
  {
    id: "market_validation",
    title: "Market Validation",
    description: "Validate your market opportunity and competition",
    icon: "chart",
    order: 2,
  },
  {
    id: "customer_persona",
    title: "Customer Persona",
    description: "Define your ideal customer profiles",
    icon: "users",
    order: 3,
  },
  {
    id: "brand_strategy",
    title: "Brand Strategy",
    description: "Develop your brand identity and positioning",
    icon: "palette",
    order: 4,
  },
  {
    id: "business_model",
    title: "Business Model",
    description: "Design your revenue and business model",
    icon: "briefcase",
    order: 5,
  },
  {
    id: "new_features",
    title: "New Features",
    description: "Brainstorm and prioritize new features",
    icon: "sparkles",
    order: 6,
  },
  {
    id: "tech_stack",
    title: "Tech Stack",
    description: "Plan your technology architecture",
    icon: "code",
    order: 7,
  },
  {
    id: "create_prd",
    title: "Create PRD",
    description: "Generate a product requirements document",
    icon: "document",
    order: 8,
  },
  {
    id: "go_to_market",
    title: "Go to Market",
    description: "Plan your launch and marketing strategy",
    icon: "rocket",
    order: 9,
  },
] as const;

type ChatType = (typeof STARTING_POINTS)[number]["id"] | "custom";

export default function ProjectDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const { user: storedUser, isLoading: isUserLoading } = useStoreUser();
  const [isCreatingChat, setIsCreatingChat] = useState<string | null>(null);

  // Fetch project data
  const project = useQuery(
    api.projects.getById,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );

  // Fetch project documents
  const documents = useQuery(
    api.documents.getByProject,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );

  // Fetch project chats
  const chats = useQuery(
    api.chats.getByProject,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );

  // Create chat mutation
  const createChat = useMutation(api.chats.create);

  const handleStartChat = async (type: ChatType) => {
    if (!storedUser?._id || !projectId) return;

    setIsCreatingChat(type);
    try {
      const startingPoint = STARTING_POINTS.find((sp) => sp.id === type);
      const chatId = await createChat({
        projectId: projectId as Id<"projects">,
        type,
        title: startingPoint?.title ?? "Custom Chat",
      });

      router.push(`/dashboard/projects/${projectId}/chat/${chatId}`);
    } catch (error) {
      console.error("Failed to create chat:", error);
      setIsCreatingChat(null);
    }
  };

  if (isUserLoading || project === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <h1 className="font-serif text-2xl font-bold">Project Not Found</h1>
        <Link href="/dashboard">
          <Button>Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-2">
              <span className="font-serif text-2xl font-bold text-primary">
                Skribe
              </span>
            </Link>
            <span className="text-muted-foreground">/</span>
            <h1 className="font-serif text-xl font-semibold">{project.name}</h1>
          </div>
          {project.githubRepoUrl && (
            <a
              href={project.githubRepoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <GitHubIcon className="h-4 w-4" />
              {project.githubRepoName}
            </a>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Project description */}
        {project.description && (
          <p className="mb-8 text-muted-foreground">{project.description}</p>
        )}

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main content - Starting Points & Chats */}
          <div className="lg:col-span-2 space-y-8">
            {/* Starting Points */}
            <section>
              <h2 className="font-serif text-xl font-semibold mb-4">
                Starting Points
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {STARTING_POINTS.map((point) => (
                  <Card
                    key={point.id}
                    className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/30"
                    onClick={() => handleStartChat(point.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light">
                          <StartingPointIcon
                            icon={point.icon}
                            className="h-5 w-5 text-primary"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-foreground">
                            {point.title}
                          </h3>
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                            {point.description}
                          </p>
                        </div>
                        {isCreatingChat === point.id && (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            {/* Recent Chats */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-serif text-xl font-semibold">
                  Recent Chats
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStartChat("custom")}
                  isLoading={isCreatingChat === "custom"}
                >
                  New Custom Chat
                </Button>
              </div>

              {chats === undefined ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-16 animate-pulse rounded-xl bg-white"
                    ></div>
                  ))}
                </div>
              ) : chats.length === 0 ? (
                <Card className="p-8 text-center">
                  <p className="text-muted-foreground">
                    No chats yet. Select a starting point above to begin.
                  </p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {chats.map((chat) => (
                    <Link
                      key={chat._id}
                      href={`/dashboard/projects/${projectId}/chat/${chat._id}`}
                    >
                      <Card className="p-4 transition-all hover:shadow-md hover:border-primary/30">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-medium">{chat.title}</h3>
                            <p className="text-xs text-muted-foreground">
                              {new Date(chat.updatedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                            {chat.type.replace(/_/g, " ")}
                          </span>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Sidebar - Documents */}
          <aside>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Documents</CardTitle>
              </CardHeader>
              <CardContent>
                {documents === undefined ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-8 animate-pulse rounded bg-muted"
                      ></div>
                    ))}
                  </div>
                ) : documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No documents yet. Documents created during chats will appear
                    here.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {documents.map((doc) => (
                      <Link
                        key={doc._id}
                        href={`/dashboard/projects/${projectId}/documents/${doc._id}`}
                        className="flex items-center justify-between rounded-lg p-2 hover:bg-muted"
                      >
                        <div className="flex items-center gap-2">
                          <DocumentIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {doc.title}
                          </span>
                        </div>
                        <SyncStatusIcon status={doc.syncStatus} />
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}

// Icon components
function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"
      />
    </svg>
  );
}

function DocumentIcon({ className }: { className?: string }) {
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
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function SyncStatusIcon({ status }: { status: "synced" | "pending" | "error" }) {
  if (status === "synced") {
    return (
      <span className="h-2 w-2 rounded-full bg-success" title="Synced" />
    );
  }
  if (status === "pending") {
    return (
      <span className="h-2 w-2 rounded-full bg-warning" title="Pending sync" />
    );
  }
  return (
    <span className="h-2 w-2 rounded-full bg-destructive" title="Sync error" />
  );
}

function StartingPointIcon({
  icon,
  className,
}: {
  icon: string;
  className?: string;
}) {
  const icons: Record<string, React.ReactNode> = {
    lightbulb: (
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
        <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
        <path d="M9 18h6" />
        <path d="M10 22h4" />
      </svg>
    ),
    chart: (
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
        <line x1="12" x2="12" y1="20" y2="10" />
        <line x1="18" x2="18" y1="20" y2="4" />
        <line x1="6" x2="6" y1="20" y2="16" />
      </svg>
    ),
    users: (
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
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    palette: (
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
        <circle cx="13.5" cy="6.5" r="0.5" fill="currentColor" />
        <circle cx="17.5" cy="10.5" r="0.5" fill="currentColor" />
        <circle cx="8.5" cy="7.5" r="0.5" fill="currentColor" />
        <circle cx="6.5" cy="12.5" r="0.5" fill="currentColor" />
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z" />
      </svg>
    ),
    briefcase: (
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
        <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        <rect width="20" height="14" x="2" y="6" rx="2" />
      </svg>
    ),
    sparkles: (
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
        <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      </svg>
    ),
    code: (
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
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
    document: (
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
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" x2="8" y1="13" y2="13" />
        <line x1="16" x2="8" y1="17" y2="17" />
        <line x1="10" x2="8" y1="9" y2="9" />
      </svg>
    ),
    rocket: (
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
        <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
        <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
        <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
        <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
      </svg>
    ),
  };

  return <>{icons[icon] || icons.document}</>;
}
