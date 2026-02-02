"use client";

import { useState, useRef, useEffect } from "react";
import { Button, Textarea } from "@/components/ui";
import { SelectionContextChip, SelectionContext } from "./SelectionContextChip";
import { PendingUpdatePreview } from "./PendingUpdatePreview";
import { cn } from "@/lib/utils";
import DOMPurify from "dompurify";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface DocumentAIChatProps {
  documentId: string;
  projectId: string;
  documentContent: string;
  selectedText: SelectionContext | null;
  onDocumentUpdate: (newContent: string) => void;
  onClearSelection: () => void;
}

export function DocumentAIChat({
  documentId,
  projectId,
  documentContent,
  selectedText,
  onDocumentUpdate,
  onClearSelection,
}: DocumentAIChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isSubmitting) return;

    const userMessage = inputValue.trim();
    setInputValue("");
    setIsSubmitting(true);
    setError(null);

    // Add user message to local state
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

    // Add placeholder for assistant
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const response = await fetch("/api/document-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          projectId,
          message: userMessage,
          documentContent,
          selectionContext: selectedText,
          messageHistory: messages,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to get response");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          fullContent += chunk;

          // Check for document update markers
          const updateRegex = /<!-- DOCUMENT_UPDATE:(.*?) -->/g;
          let match;
          let cleanedContent = fullContent;

          while ((match = updateRegex.exec(fullContent)) !== null) {
            try {
              const updateData = JSON.parse(match[1]);
              setPendingUpdate(updateData.content);
            } catch {
              // Ignore parse errors for partial JSON
            }
          }

          // Remove the markers from displayed content
          cleanedContent = fullContent.replace(/<!-- DOCUMENT_UPDATE:.*? -->/g, "");

          // Update assistant message
          setMessages((prev) => {
            const updated = [...prev];
            if (updated.length > 0 && updated[updated.length - 1].role === "assistant") {
              updated[updated.length - 1] = {
                role: "assistant",
                content: cleanedContent.trim(),
              };
            }
            return updated;
          });
        }
      }
    } catch (err) {
      console.error("Document AI error:", err);
      setError(err instanceof Error ? err.message : "Something went wrong");
      // Update the placeholder message with error indication
      setMessages((prev) => {
        const updated = [...prev];
        if (updated.length > 0 && updated[updated.length - 1].role === "assistant") {
          updated[updated.length - 1] = {
            role: "assistant",
            content: "Sorry, I encountered an error. Please try again.",
          };
        }
        return updated;
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApplyUpdate = () => {
    if (pendingUpdate) {
      onDocumentUpdate(pendingUpdate);
      setPendingUpdate(null);
      onClearSelection();
    }
  };

  const handleRejectUpdate = () => {
    setPendingUpdate(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <h2 className="font-serif text-lg font-semibold">AI Editor</h2>
        <p className="text-xs text-muted-foreground">
          Ask AI to help edit your document
        </p>
      </div>

      {/* Selection indicator */}
      {selectedText && (
        <div className="px-4 py-2 border-b border-border bg-muted/50">
          <SelectionContextChip selection={selectedText} onClear={onClearSelection} />
        </div>
      )}

      {/* Pending update preview */}
      {pendingUpdate && (
        <div className="px-4 py-3 border-b border-border bg-primary-light/30">
          <PendingUpdatePreview
            originalContent={documentContent}
            newContent={pendingUpdate}
            onApply={handleApplyUpdate}
            onReject={handleRejectUpdate}
          />
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <SparklesIcon className="h-8 w-8 mx-auto mb-3 text-primary/50" />
            <p className="text-sm">
              {selectedText
                ? "Ask me to rewrite, improve, or change the selected text."
                : "Select text to focus edits, or ask me to make changes to the document."}
            </p>
            <div className="mt-4 text-xs space-y-1">
              <p>&ldquo;Make this more concise&rdquo;</p>
              <p>&ldquo;Add a section about pricing&rdquo;</p>
              <p>&ldquo;Rewrite in a more professional tone&rdquo;</p>
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={cn(
                "flex",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-xl px-4 py-2.5",
                  message.role === "user"
                    ? "bg-primary text-white"
                    : "bg-muted text-foreground"
                )}
              >
                {message.role === "assistant" ? (
                  <div className="prose prose-sm prose-slate max-w-none">
                    <MessageContent content={message.content} />
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                )}
                {message.role === "assistant" && !message.content && isSubmitting && (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" />
                    <div
                      className="w-2 h-2 rounded-full bg-primary/50 animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    />
                    <div
                      className="w-2 h-2 rounded-full bg-primary/50 animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    />
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error display */}
      {error && (
        <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 border-t border-border">
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <Textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              selectedText
                ? "How should I change the selected text?"
                : "How can I help edit this document?"
            }
            className="min-h-[80px] text-sm resize-none"
            disabled={isSubmitting}
          />
          <Button
            type="submit"
            size="sm"
            isLoading={isSubmitting}
            disabled={!inputValue.trim() || isSubmitting}
            className="self-end"
          >
            <SendIcon className="h-4 w-4 mr-2" />
            Send
          </Button>
        </form>
      </div>
    </div>
  );
}

// Simple markdown-to-html for assistant messages
function MessageContent({ content }: { content: string }) {
  if (!content) return null;

  let html = content;

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  // Italic
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  // Inline code
  html = html.replace(
    /`(.*?)`/g,
    '<code class="rounded bg-white/50 px-1 py-0.5 text-xs font-mono">$1</code>'
  );
  // Line breaks
  html = html.replace(/\n/g, "<br />");

  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["strong", "em", "code", "br"],
    ALLOWED_ATTR: ["class"],
  });

  return <span dangerouslySetInnerHTML={{ __html: sanitized }} />;
}

function SparklesIcon({ className }: { className?: string }) {
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
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
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
