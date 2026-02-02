"use client";

import { useState, useEffect } from "react";
import { Button, Modal, Input, Textarea } from "@/components/ui";

interface CreateTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, description: string, systemPrompt: string) => void;
  isLoading?: boolean;
}

export function CreateTemplateModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
}: CreateTemplateModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Reset form state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setName("");
      setDescription("");
      setSystemPrompt("");
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Template name is required");
      return;
    }

    if (!systemPrompt.trim()) {
      setError("System prompt is required for templates");
      return;
    }

    onSubmit(name.trim(), description.trim(), systemPrompt.trim());
  };

  const handleClose = () => {
    setName("");
    setDescription("");
    setSystemPrompt("");
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create Agent Template"
      description="Create a reusable template with custom instructions for your AI advisor."
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <Input
          label="Template Name"
          placeholder="e.g., Competitive Analysis, Code Review..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <Textarea
          label="Description (optional)"
          placeholder="Brief description shown in the template grid"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />

        <Textarea
          label="System Prompt"
          placeholder="Define how the AI should behave. For example:&#10;&#10;You are an expert in competitive analysis. Help me analyze my competitors by asking about their products, pricing, and market positioning. Focus on actionable insights."
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={8}
          required
          helperText="This prompt guides the AI's behavior when using this template."
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            Create Template
          </Button>
        </div>
      </form>
    </Modal>
  );
}

interface EditTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, description: string, systemPrompt: string) => void;
  isLoading?: boolean;
  initialName: string;
  initialDescription: string;
  initialSystemPrompt: string;
  externalError?: string | null;
}

export function EditTemplateModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  initialName,
  initialDescription,
  initialSystemPrompt,
  externalError,
}: EditTemplateModalProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [systemPrompt, setSystemPrompt] = useState(initialSystemPrompt);
  const [error, setError] = useState<string | null>(null);

  // Sync form state with initial values when modal opens
  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setDescription(initialDescription);
      setSystemPrompt(initialSystemPrompt);
      setError(null);
    }
  }, [isOpen, initialName, initialDescription, initialSystemPrompt]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Template name is required");
      return;
    }

    if (!systemPrompt.trim()) {
      setError("System prompt is required for templates");
      return;
    }

    onSubmit(name.trim(), description.trim(), systemPrompt.trim());
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const displayError = externalError || error;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Edit Template"
      description="Update your agent template."
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {displayError && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
            {displayError}
          </div>
        )}

        <Input
          label="Template Name"
          placeholder="e.g., Competitive Analysis, Code Review..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <Textarea
          label="Description (optional)"
          placeholder="Brief description shown in the template grid"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />

        <Textarea
          label="System Prompt"
          placeholder="Define how the AI should behave..."
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={8}
          required
          helperText="This prompt guides the AI's behavior when using this template."
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
