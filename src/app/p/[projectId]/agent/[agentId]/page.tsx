"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { Button, Textarea } from "@/components/ui";
import { EditAgentModal } from "@/components/chat/agent";
import {
  DocumentCard,
  AgentDocumentPanel,
  ImageUploadButton,
  ImagePreviewList,
  ChatImageDisplay,
  DropZone,
} from "@/components/chat";
import { SelectionContextChip } from "@/components/document/SelectionContextChip";
import { useStoreUser } from "@/hooks/use-store-user";
import { useImageUpload } from "@/hooks/use-image-upload";
import { useState, useRef, useEffect, useCallback } from "react";
import DOMPurify from "dompurify";
import { SelectionContext } from "@/hooks/use-text-selection";

// Types for parsed document events
interface DocumentEvent {
  type: "DOCUMENT_CREATED" | "DOCUMENT_UPDATED" | "DOCUMENT_EDIT";
  documentId: string;
  title?: string;
  documentType?: string;
  content?: string;
  message?: string;
}

// Parse JSONL markers from message content
function parseDocumentEvents(content: string): {
  cleanContent: string;
  events: DocumentEvent[];
} {
  const events: DocumentEvent[] = [];
  const lines = content.split("\n");
  const cleanLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (
          parsed.type === "DOCUMENT_CREATED" ||
          parsed.type === "DOCUMENT_UPDATED" ||
          parsed.type === "DOCUMENT_EDIT"
        ) {
          events.push(parsed as DocumentEvent);
          continue; // Don't add this line to clean content
        }
      } catch {
        // Not valid JSON, treat as regular content
      }
    }
    cleanLines.push(line);
  }

  return {
    cleanContent: cleanLines.join("\n").trim(),
    events,
  };
}

export default function AgentPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const agentId = params.agentId as string;
  useStoreUser(); // Ensure user is synced to Convex

  const [inputValue, setInputValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, setIsStreaming] = useState(false);
  const [awaitingFirstChunk, setAwaitingFirstChunk] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUpdatingAgent, setIsUpdatingAgent] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Document panel state
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [activeDocumentId, setActiveDocumentId] = useState<Id<"documents"> | null>(null);
  const [activeDocumentContent, setActiveDocumentContent] = useState("");
  const [selectionContext, setSelectionContext] = useState<SelectionContext | null>(null);

  // Image upload state
  const [imageError, setImageError] = useState<string | null>(null);
  const {
    pendingImages,
    isUploading,
    addImages,
    removeImage,
    clearImages,
    uploadAllImages,
    maxImages,
  } = useImageUpload({
    onError: (error) => setImageError(error),
  });

  // Fetch documents for the project
  const projectDocuments = useQuery(
    api.documents.getByProject,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );

  // Fetch agent with messages
  const agentData = useQuery(
    api.agents.getWithMessages,
    agentId ? { agentId: agentId as Id<"agents"> } : "skip"
  );

  // Fetch project for breadcrumb
  const project = useQuery(
    api.projects.getById,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );

  // Mutations
  const createMessage = useMutation(api.messages.create);
  const updateMessage = useMutation(api.messages.update);
  const updateAgent = useMutation(api.agents.update);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [agentData?.messages]);

  // Focus textarea on load
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Handle opening a document in the panel
  const handleOpenDocument = useCallback((documentId: Id<"documents">) => {
    setActiveDocumentId(documentId);
    setIsPanelOpen(true);
    setSelectionContext(null); // Clear any previous selection
  }, []);

  // Handle document content updates from the panel
  const handleDocumentContentChange = useCallback((content: string) => {
    setActiveDocumentContent(content);
  }, []);

  // Handle selection changes from the document panel
  const handleSelectionChange = useCallback((selection: SelectionContext | null) => {
    setSelectionContext(selection);
  }, []);

  // Clear selection context
  const handleClearSelection = useCallback(() => {
    setSelectionContext(null);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isSubmitting || !agentId) return;

    const userMessage = inputValue.trim();
    setInputValue("");
    setIsSubmitting(true);
    setImageError(null);

    let assistantMessageId: Id<"messages"> | null = null;

    try {
      // Upload any pending images first
      let uploadedImages: Array<{
        storageId: Id<"_storage">;
        filename: string;
        contentType: string;
        size: number;
      }> = [];

      if (pendingImages.length > 0) {
        uploadedImages = await uploadAllImages();
      }

      // Create user message with images
      await createMessage({
        agentId: agentId as Id<"agents">,
        role: "user",
        content: userMessage,
        images: uploadedImages.length > 0 ? uploadedImages : undefined,
      });

      // Clear images after successful message creation
      clearImages();

      // Create placeholder for assistant message
      setIsStreaming(true);
      setAwaitingFirstChunk(true);
      assistantMessageId = await createMessage({
        agentId: agentId as Id<"agents">,
        role: "assistant",
        content: "",
      });

      // Build request body with optional document context
      const requestBody: Record<string, unknown> = {
        agentId,
        projectId,
        message: userMessage,
      };

      // Include uploaded images for Claude vision
      if (uploadedImages.length > 0) {
        requestBody.images = uploadedImages.map((img) => ({
          storageId: img.storageId,
          contentType: img.contentType,
        }));
      }

      // Include document context if panel is open
      if (isPanelOpen && activeDocumentId) {
        requestBody.activeDocumentId = activeDocumentId;
        requestBody.activeDocumentContent = activeDocumentContent;

        // Include selection context if text is selected
        if (selectionContext) {
          requestBody.selectionContext = {
            text: selectionContext.text,
            startOffset: selectionContext.startOffset,
            endOffset: selectionContext.endOffset,
          };
        }
      }

      // Call the AI API
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to get AI response");
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      if (reader) {
        let isFirstChunk = true;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          fullContent += chunk;

          // Clear awaiting state on first chunk
          if (isFirstChunk) {
            setAwaitingFirstChunk(false);
            isFirstChunk = false;
          }

          await updateMessage({
            messageId: assistantMessageId,
            content: fullContent,
          });
        }

        const remaining = decoder.decode();
        if (remaining) {
          fullContent += remaining;
          await updateMessage({
            messageId: assistantMessageId,
            content: fullContent,
          });
        }
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      if (assistantMessageId) {
        try {
          await updateMessage({
            messageId: assistantMessageId,
            content: "Sorry, I encountered an error and couldn't respond. Please try again.",
          });
        } catch {
          // Ignore update error
        }
      }
    } finally {
      setIsSubmitting(false);
      setIsStreaming(false);
      setAwaitingFirstChunk(false);
      setSelectionContext(null); // Clear selection after sending
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleUpdateAgent = async (title: string, systemPrompt: string) => {
    if (!agentId) return;

    setIsUpdatingAgent(true);
    setUpdateError(null);
    try {
      await updateAgent({
        agentId: agentId as Id<"agents">,
        title,
        systemPrompt: systemPrompt || undefined,
      });
      setIsEditModalOpen(false);
    } catch (error) {
      console.error("Failed to update agent:", error);
      setUpdateError(error instanceof Error ? error.message : "Failed to update agent. Please try again.");
    } finally {
      setIsUpdatingAgent(false);
    }
  };

  if (agentData === undefined || project === undefined) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!agentData) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <h1 className="font-serif text-2xl font-bold">Agent Not Found</h1>
        <Button onClick={() => router.push(`/p/${projectId}`)}>
          Back to Project
        </Button>
      </div>
    );
  }

  // Prepare available documents for the panel
  const availableDocuments = projectDocuments?.map((doc) => ({
    _id: doc._id,
    title: doc.title,
    type: doc.type,
  })) || [];

  return (
    <div
      className="flex h-screen flex-col bg-muted transition-all duration-300"
      style={{
        marginRight: isPanelOpen ? "480px" : "0",
      }}
    >
      {/* Header */}
      <header className="border-b border-border bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="font-serif text-xl font-semibold truncate">
              {agentData.title}
            </h1>
            <p className="text-sm text-muted-foreground truncate">
              {project?.name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary-light px-3 py-1 text-xs font-medium text-primary">
              {agentData.type.replace(/_/g, " ")}
            </span>
            {agentData.type === "custom" && (
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="rounded-lg p-2 hover:bg-muted transition-colors"
                aria-label="Edit agent settings"
              >
                <SettingsIcon className="h-5 w-5 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto max-w-3xl space-y-6">
          {agentData.messages.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-light">
                <AgentIcon className="h-8 w-8 text-primary" />
              </div>
              <h2 className="font-serif text-xl font-semibold mb-2">
                Start the conversation
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                {agentData.type === "custom"
                  ? "Ask me anything about your project. I have access to all your project documents."
                  : `I'm ready to help you with ${agentData.title.toLowerCase()}. What would you like to explore?`}
              </p>
            </div>
          ) : (
            agentData.messages.map((message) => (
              <MessageBubble
                key={message._id}
                message={message}
                onOpenDocument={handleOpenDocument}
              />
            ))
          )}

          {/* Typing indicator */}
          {awaitingFirstChunk && (
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
                <span className="text-sm font-medium text-white">S</span>
              </div>
              <div className="rounded-2xl rounded-tl-none bg-white p-4 shadow-sm">
                <div className="flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "0ms" }}></span>
                  <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "150ms" }}></span>
                  <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "300ms" }}></span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border bg-white px-6 py-4">
        {/* Selection context chip */}
        {selectionContext && (
          <div className="mx-auto max-w-3xl mb-3">
            <SelectionContextChip
              selection={{
                text: selectionContext.text,
                startOffset: selectionContext.startOffset,
                endOffset: selectionContext.endOffset,
                contentSnapshot: activeDocumentContent,
              }}
              onClear={handleClearSelection}
            />
          </div>
        )}

        {/* Image error message */}
        {imageError && (
          <div className="mx-auto max-w-3xl mb-3">
            <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {imageError}
              <button
                type="button"
                onClick={() => setImageError(null)}
                className="ml-2 underline hover:no-underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Image previews */}
        {pendingImages.length > 0 && (
          <div className="mx-auto max-w-3xl mb-3">
            <ImagePreviewList images={pendingImages} onRemove={removeImage} />
          </div>
        )}

        <DropZone
          onFilesDropped={addImages}
          disabled={isSubmitting}
          className="mx-auto max-w-3xl"
        >
          <form
            onSubmit={handleSubmit}
            className="flex items-end gap-3"
          >
            <div className="flex-1">
              <Textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  selectionContext
                    ? "Ask about or edit the selected text..."
                    : pendingImages.length > 0
                      ? "Add a message about your image..."
                      : "Type your message..."
                }
                rows={1}
                className="min-h-[44px] max-h-32 resize-none"
                disabled={isSubmitting}
              />
            </div>
            <ImageUploadButton
              onFilesSelected={addImages}
              disabled={isSubmitting}
              maxImages={maxImages}
              currentCount={pendingImages.length}
            />
            <Button
              type="submit"
              disabled={!inputValue.trim() || isSubmitting || isUploading}
              isLoading={isSubmitting || isUploading}
            >
              <SendIcon className="h-5 w-5" />
            </Button>
          </form>
        </DropZone>
        <p className="mx-auto max-w-3xl mt-2 text-xs text-muted-foreground text-center">
          Press Enter to send, Shift+Enter for new line. Drag & drop or click to attach images.
        </p>
      </div>

      {/* Edit Agent Modal */}
      {agentData.type === "custom" && (
        <EditAgentModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setUpdateError(null);
          }}
          onSubmit={handleUpdateAgent}
          isLoading={isUpdatingAgent}
          initialTitle={agentData.title}
          initialSystemPrompt={agentData.systemPrompt || ""}
          externalError={updateError}
        />
      )}

      {/* Document Panel */}
      <AgentDocumentPanel
        isOpen={isPanelOpen}
        onClose={() => {
          setIsPanelOpen(false);
          setSelectionContext(null);
        }}
        documentId={activeDocumentId}
        projectId={projectId as Id<"projects">}
        availableDocuments={availableDocuments}
        onDocumentChange={handleOpenDocument}
        onSelectionChange={handleSelectionChange}
        onContentChange={handleDocumentContentChange}
      />
    </div>
  );
}

// Message bubble component
function MessageBubble({
  message,
  onOpenDocument,
}: {
  message: {
    _id: string;
    role: "user" | "assistant" | "system";
    content: string;
    createdAt: number;
    images?: Array<{
      storageId: Id<"_storage">;
      filename: string;
      contentType: string;
      size: number;
    }>;
  };
  onOpenDocument?: (documentId: Id<"documents">) => void;
}) {
  const isUser = message.role === "user";

  // Get URLs for any images in the message
  const storageIds = message.images?.map((img) => img.storageId) ?? [];
  const imageUrls = useQuery(
    api.storage.getImageUrls,
    storageIds.length > 0 ? { storageIds } : "skip"
  );

  if (message.role === "system") {
    return null;
  }

  // Parse document events from assistant messages
  const { cleanContent, events } = isUser
    ? { cleanContent: message.content, events: [] }
    : parseDocumentEvents(message.content);

  // Separate document cards (created/updated) from edit notifications
  const documentCards = events.filter(
    (e) => e.type === "DOCUMENT_CREATED" || e.type === "DOCUMENT_UPDATED"
  );

  const hasImages = message.images && message.images.length > 0;

  return (
    <div className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
          isUser ? "bg-secondary" : "bg-primary"
        }`}
      >
        <span className="text-sm font-medium text-white">
          {isUser ? "U" : "S"}
        </span>
      </div>
      <div className="max-w-[80%] space-y-2">
        {/* Images attached to message */}
        {hasImages && (
          <ChatImageDisplay
            images={message.images!.map((img) => ({
              storageId: img.storageId as string,
              filename: img.filename,
              contentType: img.contentType,
              size: img.size,
            }))}
            imageUrls={imageUrls ?? {}}
            isUser={isUser}
          />
        )}

        {/* Main message content */}
        {cleanContent && (
          <div
            className={`rounded-2xl p-4 shadow-sm ${
              isUser
                ? "rounded-tr-none bg-secondary text-white"
                : "rounded-tl-none bg-white"
            }`}
          >
            <div className="prose prose-sm max-w-none">
              <MarkdownRenderer content={cleanContent} isUser={isUser} />
            </div>
          </div>
        )}

        {/* Render document cards for created/updated documents */}
        {documentCards.map((event, index) => (
          <DocumentCard
            key={`${event.documentId}-${index}`}
            documentId={event.documentId as Id<"documents">}
            title={event.title || "Document"}
            documentType={event.documentType || "custom"}
            action={event.type === "DOCUMENT_CREATED" ? "created" : "updated"}
            onClick={() => onOpenDocument?.(event.documentId as Id<"documents">)}
          />
        ))}

        {/* Show placeholder if no content yet */}
        {!cleanContent && documentCards.length === 0 && !hasImages && (
          <div className="rounded-2xl rounded-tl-none bg-white p-4 shadow-sm">
            <span className="text-muted-foreground italic">...</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Simple markdown renderer
function MarkdownRenderer({
  content,
  isUser,
}: {
  content: string;
  isUser: boolean;
}) {
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className={isUser ? "text-white" : ""}>
      {parts.map((part, index) => {
        if (part.startsWith("```")) {
          const match = part.match(/```(\w*)\n?([\s\S]*?)```/);
          const language = match?.[1] || "";
          const code = match?.[2] || part.slice(3, -3);
          return (
            <pre
              key={index}
              className="my-2 overflow-x-auto rounded-lg bg-muted p-3 text-sm"
            >
              {language && (
                <div className="mb-2 text-xs text-muted-foreground">
                  {language}
                </div>
              )}
              <code className="text-foreground">{code.trim()}</code>
            </pre>
          );
        }

        return (
          <span key={index}>
            {part.split("\n").map((line, lineIndex) => (
              <span key={lineIndex}>
                {lineIndex > 0 && <br />}
                {renderInlineMarkdown(line)}
              </span>
            ))}
          </span>
        );
      })}
    </div>
  );
}

function renderInlineMarkdown(text: string) {
  let html = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  html = html.replace(/`(.*?)`/g, '<code class="rounded bg-muted px-1 py-0.5 text-sm">$1</code>');

  const sanitizedHtml = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["strong", "em", "code"],
    ALLOWED_ATTR: ["class"],
  });

  return <span dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />;
}

// Icons
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

function SendIcon({ className }: { className?: string }) {
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
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

function AgentIcon({ className }: { className?: string }) {
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
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
