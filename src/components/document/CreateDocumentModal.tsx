"use client";

import { useState, useEffect } from "react";
import { Button, Modal, Input, Select, Textarea } from "@/components/ui";

const DOCUMENT_TYPE_OPTIONS = [
  { value: "custom", label: "Custom Document" },
  { value: "prd", label: "Product Requirements Document" },
  { value: "persona", label: "Customer Persona" },
  { value: "market", label: "Market Analysis" },
  { value: "brand", label: "Brand Strategy" },
  { value: "business", label: "Business Model" },
  { value: "feature", label: "Feature Specification" },
  { value: "tech", label: "Technical Architecture" },
  { value: "gtm", label: "Go-to-Market Strategy" },
  { value: "landing", label: "Landing Page Copy" },
] as const;

export type DocumentType = (typeof DOCUMENT_TYPE_OPTIONS)[number]["value"];

interface CreateDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (title: string, type: DocumentType, content: string) => Promise<void>;
  isLoading?: boolean;
}

export function CreateDocumentModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
}: CreateDocumentModalProps) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<DocumentType>("custom");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Reset form state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTitle("");
      setType("custom");
      setContent("");
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Document title is required");
      return;
    }

    try {
      await onSubmit(title.trim(), type, content.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create document");
    }
  };

  const handleClose = () => {
    setTitle("");
    setType("custom");
    setContent("");
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create New Document"
      description="Create a blank document to start writing from scratch."
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <Input
          label="Document Title"
          placeholder="e.g., Product Requirements, User Research Notes..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <Select
          label="Document Type"
          options={[...DOCUMENT_TYPE_OPTIONS]}
          value={type}
          onChange={(e) => setType(e.target.value as DocumentType)}
          helperText="Choose a type to categorize your document"
        />

        <Textarea
          label="Initial Content (optional)"
          placeholder="Paste or type initial content here, or leave empty for a blank document..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          helperText="You can add content now or start with a blank document and write later"
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            Create Document
          </Button>
        </div>
      </form>
    </Modal>
  );
}
