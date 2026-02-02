"use client";

import { useState, useEffect } from "react";
import { Button, Modal, Input, Textarea } from "@/components/ui";

interface EditAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (title: string, systemPrompt: string) => void;
  isLoading?: boolean;
  initialTitle: string;
  initialSystemPrompt: string;
  externalError?: string | null;
}

export function EditAgentModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  initialTitle,
  initialSystemPrompt,
  externalError,
}: EditAgentModalProps) {
  const [title, setTitle] = useState(initialTitle);
  const [systemPrompt, setSystemPrompt] = useState(initialSystemPrompt);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens with new values
  useEffect(() => {
    if (isOpen) {
      setTitle(initialTitle);
      setSystemPrompt(initialSystemPrompt);
      setError(null);
    }
  }, [isOpen, initialTitle, initialSystemPrompt]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Agent title is required");
      return;
    }

    onSubmit(title.trim(), systemPrompt.trim());
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Edit Agent Settings"
      description="Update the agent title and customize the AI's behavior with a system prompt."
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {(error || externalError) && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
            {error || externalError}
          </div>
        )}

        <Input
          label="Agent Title"
          placeholder="e.g., Competitive Analysis, User Research..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <Textarea
          label="System Prompt (optional)"
          placeholder="Give the AI specific instructions for this agent. For example:&#10;&#10;You are an expert in competitive analysis. Help me analyze my competitors by asking about their products, pricing, and market positioning. Focus on actionable insights."
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={6}
          helperText="The system prompt defines how the AI should behave in this conversation. Leave empty to use the default advisor prompt."
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
