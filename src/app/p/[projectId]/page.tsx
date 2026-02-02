"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Card, CardContent } from "@/components/ui";
import { CustomChatModal } from "@/components/chat";
import { useStoreUser } from "@/hooks/use-store-user";
import { useState, useMemo } from "react";
import { STARTING_POINTS, ChatType } from "@/lib/starting-points";

export default function NewChatPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const { user: storedUser } = useStoreUser();
  const [isCreatingChat, setIsCreatingChat] = useState<string | null>(null);
  const [isCustomChatModalOpen, setIsCustomChatModalOpen] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  // Fetch project data
  const project = useQuery(
    api.projects.getById,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );

  // Fetch project chats to know which starting points are completed
  const chats = useQuery(
    api.chats.getByProject,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );

  // Create chat mutation
  const createChat = useMutation(api.chats.create);

  // Calculate which starting points have been completed (have chats)
  const completedStartingPoints = useMemo(() => {
    if (!chats) return new Set<string>();
    const completedTypes = new Set<string>();
    for (const chat of chats) {
      if (chat.type !== "custom") {
        completedTypes.add(chat.type);
      }
    }
    return completedTypes;
  }, [chats]);

  // Check if project is new (no chats yet)
  const isNewProject = chats !== undefined && chats.length === 0;

  const handleStartChat = async (type: ChatType) => {
    if (isCreatingChat) return;
    if (!storedUser?._id || !projectId) return;

    setIsCreatingChat(type);
    setChatError(null);
    try {
      const startingPoint = STARTING_POINTS.find((sp) => sp.id === type);
      const chatId = await createChat({
        projectId: projectId as Id<"projects">,
        type,
        title: startingPoint?.title ?? "Custom Chat",
      });

      router.push(`/p/${projectId}/chat/${chatId}`);
    } catch (error) {
      console.error("Failed to create chat:", error);
      setChatError(error instanceof Error ? error.message : "Failed to create chat. Please try again.");
    } finally {
      setIsCreatingChat(null);
    }
  };

  const handleOpenChat = () => {
    setIsCustomChatModalOpen(true);
  };

  const handleCreateCustomChat = async (title: string, systemPrompt: string) => {
    if (isCreatingChat) return;
    if (!storedUser?._id || !projectId) return;

    setIsCreatingChat("custom");
    setChatError(null);
    try {
      const chatId = await createChat({
        projectId: projectId as Id<"projects">,
        type: "custom",
        title: title || "Open Chat",
        systemPrompt: systemPrompt || undefined,
      });

      setIsCustomChatModalOpen(false);
      router.push(`/p/${projectId}/chat/${chatId}`);
    } catch (error) {
      console.error("Failed to create custom chat:", error);
      setChatError(error instanceof Error ? error.message : "Failed to create chat. Please try again.");
    } finally {
      setIsCreatingChat(null);
    }
  };

  if (project === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted px-8 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-bold text-foreground">
          Start a new conversation
        </h1>
        <p className="mt-1 text-muted-foreground">
          Choose a starting point or start an open chat to explore any topic
        </p>
      </div>

      {/* Error Banner */}
      {chatError && (
        <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-destructive">{chatError}</p>
            <button
              onClick={() => setChatError(null)}
              className="text-destructive hover:text-destructive/80"
              aria-label="Dismiss error"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Starting Points Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {STARTING_POINTS.map((point) => {
          const isCompleted = completedStartingPoints.has(point.id);
          const isRecommended = isNewProject && point.order === 1;

          return (
            <Card
              key={point.id}
              role="button"
              tabIndex={0}
              aria-label={`Start ${point.title} chat${isCompleted ? " (completed)" : ""}${isRecommended ? " (recommended)" : ""}`}
              className={`cursor-pointer transition-all hover:shadow-lg hover:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                isCompleted ? "bg-success/5 border-success/30" : ""
              } ${isRecommended ? "ring-2 ring-primary ring-offset-2" : ""}`}
              onClick={() => handleStartChat(point.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  if (e.key === " ") {
                    e.preventDefault();
                  }
                  handleStartChat(point.id);
                }
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                      isCompleted ? "bg-success/20" : "bg-primary-light"
                    }`}
                  >
                    {isCompleted ? (
                      <CheckIcon className="h-5 w-5 text-success" />
                    ) : (
                      <StartingPointIcon
                        icon={point.icon}
                        className="h-5 w-5 text-primary"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-foreground">
                        {point.title}
                      </h3>
                      {isRecommended && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-white">
                          Start here
                        </span>
                      )}
                    </div>
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
          );
        })}

        {/* Open Chat Card */}
        <Card
          role="button"
          tabIndex={0}
          aria-label="Start an open chat"
          className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 border-dashed"
          onClick={handleOpenChat}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              if (e.key === " ") {
                e.preventDefault();
              }
              handleOpenChat();
            }
          }}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                <MessageCircleIcon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-foreground">Open Chat</h3>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                  Start a freeform conversation without a specific template
                </p>
              </div>
              {isCreatingChat === "custom" && (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Custom Chat Modal */}
      <CustomChatModal
        isOpen={isCustomChatModalOpen}
        onClose={() => setIsCustomChatModalOpen(false)}
        onSubmit={handleCreateCustomChat}
        isLoading={isCreatingChat === "custom"}
      />
    </div>
  );
}

// Icon components
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

function MessageCircleIcon({ className }: { className?: string }) {
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
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
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

function XIcon({ className }: { className?: string }) {
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
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
