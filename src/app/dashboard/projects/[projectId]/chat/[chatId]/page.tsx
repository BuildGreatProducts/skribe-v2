"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../../../convex/_generated/api";
import { Id } from "../../../../../../../convex/_generated/dataModel";
import { Button, Textarea } from "@/components/ui";
import { useStoreUser } from "@/hooks/use-store-user";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const chatId = params.chatId as string;
  const { user: storedUser } = useStoreUser();

  const [inputValue, setInputValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch chat with messages
  const chatData = useQuery(
    api.chats.getWithMessages,
    chatId ? { chatId: chatId as Id<"chats"> } : "skip"
  );

  // Fetch project for breadcrumb
  const project = useQuery(
    api.projects.getById,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );

  // Mutations
  const createMessage = useMutation(api.messages.create);
  const updateMessage = useMutation(api.messages.update);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatData?.messages]);

  // Focus textarea on load
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isSubmitting || !chatId) return;

    const userMessage = inputValue.trim();
    setInputValue("");
    setIsSubmitting(true);

    try {
      // Create user message
      await createMessage({
        chatId: chatId as Id<"chats">,
        role: "user",
        content: userMessage,
      });

      // Create placeholder for assistant message
      setIsStreaming(true);
      const assistantMessageId = await createMessage({
        chatId: chatId as Id<"chats">,
        role: "assistant",
        content: "",
      });

      // Call the AI API
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId,
          projectId,
          message: userMessage,
        }),
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
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          fullContent += chunk;

          // Update the message with accumulated content
          await updateMessage({
            messageId: assistantMessageId,
            content: fullContent,
          });
        }
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      // Could show error toast here
    } finally {
      setIsSubmitting(false);
      setIsStreaming(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (chatData === undefined || project === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!chatData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <h1 className="font-serif text-2xl font-bold">Chat Not Found</h1>
        <Link href={`/dashboard/projects/${projectId}`}>
          <Button>Back to Project</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-muted">
      {/* Header */}
      <header className="border-b border-border bg-white px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center gap-4">
          <Link
            href={`/dashboard/projects/${projectId}`}
            className="rounded-lg p-2 hover:bg-muted"
            aria-label="Back to project"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-serif text-xl font-semibold truncate">
              {chatData.title}
            </h1>
            <p className="text-sm text-muted-foreground truncate">
              {project?.name}
            </p>
          </div>
          <span className="rounded-full bg-primary-light px-3 py-1 text-xs font-medium text-primary">
            {chatData.type.replace(/_/g, " ")}
          </span>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          {chatData.messages.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-light">
                <ChatIcon className="h-8 w-8 text-primary" />
              </div>
              <h2 className="font-serif text-xl font-semibold mb-2">
                Start the conversation
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                {chatData.type === "custom"
                  ? "Ask me anything about your project. I have access to all your project documents."
                  : `I'm ready to help you with ${chatData.title.toLowerCase()}. What would you like to explore?`}
              </p>
            </div>
          ) : (
            chatData.messages.map((message) => (
              <MessageBubble key={message._id} message={message} />
            ))
          )}

          {/* Typing indicator */}
          {isStreaming && chatData.messages[chatData.messages.length - 1]?.content === "" && (
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
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-4xl items-end gap-3"
        >
          <div className="flex-1">
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              rows={1}
              className="min-h-[44px] max-h-32 resize-none"
              disabled={isSubmitting}
            />
          </div>
          <Button
            type="submit"
            disabled={!inputValue.trim() || isSubmitting}
            isLoading={isSubmitting}
          >
            <SendIcon className="h-5 w-5" />
          </Button>
        </form>
        <p className="mx-auto max-w-4xl mt-2 text-xs text-muted-foreground text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

// Message bubble component
function MessageBubble({
  message,
}: {
  message: {
    _id: string;
    role: "user" | "assistant" | "system";
    content: string;
    createdAt: number;
  };
}) {
  const isUser = message.role === "user";

  if (message.role === "system") {
    return null; // Don't render system messages
  }

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
      <div
        className={`max-w-[80%] rounded-2xl p-4 shadow-sm ${
          isUser
            ? "rounded-tr-none bg-secondary text-white"
            : "rounded-tl-none bg-white"
        }`}
      >
        <div className="prose prose-sm max-w-none">
          {message.content ? (
            <MarkdownRenderer content={message.content} isUser={isUser} />
          ) : (
            <span className="text-muted-foreground italic">...</span>
          )}
        </div>
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
  // Split content by code blocks
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className={isUser ? "text-white" : ""}>
      {parts.map((part, index) => {
        if (part.startsWith("```")) {
          // Code block
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

        // Regular text with inline formatting
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
  // Bold
  text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  // Italic
  text = text.replace(/\*(.*?)\*/g, "<em>$1</em>");
  // Inline code
  text = text.replace(/`(.*?)`/g, '<code class="rounded bg-muted px-1 py-0.5 text-sm">$1</code>');

  return <span dangerouslySetInnerHTML={{ __html: text }} />;
}

// Icons
function ArrowLeftIcon({ className }: { className?: string }) {
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
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
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

function ChatIcon({ className }: { className?: string }) {
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
