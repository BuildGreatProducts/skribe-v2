"use client";

import { useState, useEffect } from "react";
import { Button, Modal, Input, Textarea } from "@/components/ui";

interface CustomChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (title: string, systemPrompt: string) => void;
  isLoading?: boolean;
}

export function CustomChatModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
}: CustomChatModalProps) {
  const [title, setTitle] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Reset form state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTitle("");
      setSystemPrompt("");
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Chat title is required");
      return;
    }

    onSubmit(title.trim(), systemPrompt.trim());
  };

  const handleClose = () => {
    setTitle("");
    setSystemPrompt("");
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create Custom Chat"
      description="Create a chat with your own custom instructions for the AI advisor."
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <Input
          label="Chat Title"
          placeholder="e.g., Competitive Analysis, User Research..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <Textarea
          label="Custom System Prompt (optional)"
          placeholder="Give the AI specific instructions for this chat. For example:&#10;&#10;You are an expert in competitive analysis. Help me analyze my competitors by asking about their products, pricing, and market positioning. Focus on actionable insights."
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={6}
          helperText="Leave empty to use the default advisor prompt. The AI will always have access to your project documents."
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            Create Chat
          </Button>
        </div>
      </form>
    </Modal>
  );
}
