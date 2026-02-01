"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../../../convex/_generated/api";
import { Id } from "../../../../../../../convex/_generated/dataModel";
import { Button, Textarea, Modal } from "@/components/ui";
import { useStoreUser } from "@/hooks/use-store-user";
import Link from "next/link";
import { useState, useMemo } from "react";
import DOMPurify from "dompurify";

// Token estimation: ~4 chars per token on average
const CHARS_PER_TOKEN = 4;
const WARNING_THRESHOLD_TOKENS = 80000; // Warn when approaching Claude's context limit
const WARNING_THRESHOLD_CHARS = WARNING_THRESHOLD_TOKENS * CHARS_PER_TOKEN;

export default function DocumentPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const documentId = params.documentId as string;
  const { user: storedUser } = useStoreUser();

  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [editedTitle, setEditedTitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch document
  const document = useQuery(
    api.documents.getById,
    documentId ? { documentId: documentId as Id<"documents"> } : "skip"
  );

  // Fetch project for breadcrumb
  const project = useQuery(
    api.projects.getById,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );

  // Mutations
  const updateDocument = useMutation(api.documents.update);
  const deleteDocument = useMutation(api.documents.remove);

  // Calculate token estimate
  const tokenEstimate = useMemo(() => {
    if (!document) return 0;
    return Math.ceil(document.content.length / CHARS_PER_TOKEN);
  }, [document]);

  const isLongDocument = document && document.content.length > WARNING_THRESHOLD_CHARS;

  const handleEdit = () => {
    if (!document) return;
    setEditedTitle(document.title);
    setEditedContent(document.content);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedTitle("");
    setEditedContent("");
  };

  const handleSaveEdit = async () => {
    if (!documentId || !editedContent.trim()) return;

    setIsSaving(true);
    try {
      await updateDocument({
        documentId: documentId as Id<"documents">,
        title: editedTitle.trim() || undefined,
        content: editedContent,
      });
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save document:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = () => {
    if (!document) return;

    const blob = new Blob([document.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = `${document.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.md`;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDelete = async () => {
    if (!documentId) return;

    setIsDeleting(true);
    try {
      await deleteDocument({
        documentId: documentId as Id<"documents">,
      });
      router.push(`/dashboard/projects/${projectId}`);
    } catch (error) {
      console.error("Failed to delete document:", error);
      setIsDeleting(false);
    }
  };

  if (document === undefined || project === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <h1 className="font-serif text-2xl font-bold">Document Not Found</h1>
        <Link href={`/dashboard/projects/${projectId}`}>
          <Button>Back to Project</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
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
            {isEditing ? (
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="w-full font-serif text-xl font-semibold bg-transparent border-b border-primary focus:outline-none"
                placeholder="Document title"
              />
            ) : (
              <h1 className="font-serif text-xl font-semibold truncate">
                {document.title}
              </h1>
            )}
            <p className="text-sm text-muted-foreground truncate">
              {project?.name} &middot; Last updated{" "}
              {new Date(document.updatedAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary-light px-3 py-1 text-xs font-medium text-primary">
              {document.type}
            </span>
            <SyncStatusBadge status={document.syncStatus} />
          </div>
        </div>
      </header>

      {/* Context Length Warning */}
      {isLongDocument && (
        <div className="mx-auto max-w-4xl px-6 pt-4">
          <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
            <div className="flex items-start gap-3">
              <WarningIcon className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-warning">Long Document Warning</p>
                <p className="text-sm text-muted-foreground mt-1">
                  This document is approximately {tokenEstimate.toLocaleString()} tokens.
                  Very long documents may reduce the AI's ability to reference all content
                  effectively. Consider breaking it into smaller, focused documents.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actions Bar */}
      <div className="mx-auto max-w-4xl px-6 pt-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            ~{tokenEstimate.toLocaleString()} tokens
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={handleCancelEdit}>
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit} isLoading={isSaving}>
                  Save Changes
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={handleDownload}>
                  <DownloadIcon className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button variant="outline" onClick={handleEdit}>
                  <EditIcon className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setIsDeleteModalOpen(true)}
                >
                  <TrashIcon className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-6 py-6">
        <div className="rounded-xl border border-border bg-white p-8 shadow-sm">
          {isEditing ? (
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="min-h-[500px] font-mono text-sm"
              placeholder="Enter markdown content..."
            />
          ) : (
            <div className="prose prose-slate max-w-none">
              <MarkdownRenderer content={document.content} />
            </div>
          )}
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Document"
        description="Are you sure you want to delete this document? This action cannot be undone."
      >
        <div className="flex justify-end gap-3 pt-4">
          <Button
            variant="outline"
            onClick={() => setIsDeleteModalOpen(false)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            isLoading={isDeleting}
          >
            Delete Document
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// Markdown Renderer Component
function MarkdownRenderer({ content }: { content: string }) {
  // Parse markdown to HTML
  const html = useMemo(() => {
    let result = content;

    // Headers
    result = result.replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-6 mb-3">$1</h3>');
    result = result.replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold mt-8 mb-4">$1</h2>');
    result = result.replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-8 mb-4">$1</h1>');

    // Bold and italic
    result = result.replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>");
    result = result.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    result = result.replace(/\*(.*?)\*/g, "<em>$1</em>");

    // Inline code
    result = result.replace(/`(.*?)`/g, '<code class="rounded bg-muted px-1.5 py-0.5 text-sm font-mono">$1</code>');

    // Unordered lists
    result = result.replace(/^\s*[-*]\s+(.*$)/gm, '<li class="ml-4">$1</li>');
    result = result.replace(/(<li.*<\/li>)\n(<li)/g, "$1$2");
    // Wrap consecutive list items in ul tags
    result = result.replace(/(<li class="ml-4">[^]*?<\/li>)(?=\s*(?:<li|$))/gm, '<ul class="list-disc pl-6 my-4">$1</ul>');

    // Ordered lists
    result = result.replace(/^\s*\d+\.\s+(.*$)/gm, '<li class="ml-4">$1</li>');

    // Blockquotes
    result = result.replace(/^>\s+(.*$)/gm, '<blockquote class="border-l-4 border-primary pl-4 italic my-4">$1</blockquote>');

    // Horizontal rules
    result = result.replace(/^---$/gm, '<hr class="my-8 border-border" />');

    // Line breaks
    result = result.replace(/\n\n/g, '</p><p class="my-4">');
    result = '<p class="my-4">' + result + "</p>";

    // Clean up empty paragraphs
    result = result.replace(/<p class="my-4"><\/p>/g, "");
    result = result.replace(/<p class="my-4">(<h[1-3])/g, "$1");
    result = result.replace(/(<\/h[1-3]>)<\/p>/g, "$1");
    result = result.replace(/<p class="my-4">(<ul)/g, "$1");
    result = result.replace(/(<\/ul>)<\/p>/g, "$1");
    result = result.replace(/<p class="my-4">(<blockquote)/g, "$1");
    result = result.replace(/(<\/blockquote>)<\/p>/g, "$1");
    result = result.replace(/<p class="my-4">(<hr)/g, "$1");

    // Sanitize
    return DOMPurify.sanitize(result, {
      ALLOWED_TAGS: [
        "h1", "h2", "h3", "p", "strong", "em", "code", "ul", "ol", "li",
        "blockquote", "hr", "br"
      ],
      ALLOWED_ATTR: ["class"],
    });
  }, [content]);

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

// Sync Status Badge
function SyncStatusBadge({ status }: { status: "synced" | "pending" | "error" }) {
  const statusConfig = {
    synced: { label: "Synced", className: "bg-success/10 text-success" },
    pending: { label: "Pending", className: "bg-warning/10 text-warning" },
    error: { label: "Sync Error", className: "bg-destructive/10 text-destructive" },
  };

  const config = statusConfig[status];

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
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

function EditIcon({ className }: { className?: string }) {
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
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
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
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
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
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
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
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}
