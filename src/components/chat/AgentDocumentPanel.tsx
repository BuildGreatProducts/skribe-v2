"use client";

import { useEffect, useCallback, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { SelectableMarkdownRenderer } from "@/components/ui/selectable-markdown-renderer";
import { SelectionContext } from "@/hooks/use-text-selection";

export interface AgentDocumentPanelProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: Id<"documents"> | null;
  projectId: Id<"projects">;
  availableDocuments: Array<{
    _id: Id<"documents">;
    title: string;
    type: string;
  }>;
  onDocumentChange: (documentId: Id<"documents">) => void;
  onSelectionChange: (selection: SelectionContext | null) => void;
  onContentChange?: (content: string) => void;
}

export function AgentDocumentPanel({
  isOpen,
  onClose,
  documentId,
  availableDocuments,
  onDocumentChange,
  onSelectionChange,
  onContentChange,
}: AgentDocumentPanelProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Fetch the current document content
  const documentData = useQuery(
    api.documents.getById,
    documentId ? { documentId } : "skip"
  );

  // Notify parent of content changes (including empty strings)
  useEffect(() => {
    if (documentData?.content !== undefined && onContentChange) {
      onContentChange(documentData.content);
    }
  }, [documentData?.content, onContentChange]);

  // Handle escape key to close panel
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setIsDropdownOpen(false);
    if (isDropdownOpen) {
      window.addEventListener("click", handleClickOutside);
      return () => window.removeEventListener("click", handleClickOutside);
    }
  }, [isDropdownOpen]);

  const currentDocument = availableDocuments.find((d) => d._id === documentId);

  return (
    <>
      {/* Panel */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full bg-white border-l border-border shadow-xl z-40",
          "transform transition-transform duration-300 ease-in-out",
          "w-[480px]",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          {/* Document switcher dropdown */}
          <div className="relative flex-1 min-w-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsDropdownOpen(!isDropdownOpen);
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors max-w-full"
            >
              <DocumentIcon className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="font-medium truncate">
                {currentDocument?.title || "Select document"}
              </span>
              <ChevronDownIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </button>

            {/* Dropdown menu */}
            {isDropdownOpen && availableDocuments.length > 1 && (
              <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-border rounded-lg shadow-lg z-50">
                <div className="py-1">
                  {availableDocuments.map((doc) => (
                    <button
                      key={doc._id}
                      type="button"
                      onClick={() => {
                        onDocumentChange(doc._id);
                        setIsDropdownOpen(false);
                      }}
                      className={cn(
                        "w-full px-4 py-2 text-left hover:bg-muted transition-colors",
                        doc._id === documentId && "bg-muted"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <DocumentIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate">{doc.title}</span>
                      </div>
                      <span className="text-xs text-muted-foreground ml-6">
                        {doc.type}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Close panel"
          >
            <XIcon className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Document content */}
        <div className="h-[calc(100%-57px)] overflow-y-auto px-6 py-6">
          {documentData === undefined ? (
            <div className="flex items-center justify-center h-32">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
            </div>
          ) : documentData === null ? (
            <div className="text-center py-12">
              <DocumentIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Document not found</p>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none">
              <SelectableMarkdownRenderer
                content={documentData.content}
                onSelectionChange={onSelectionChange}
                selectionEnabled={true}
              />
            </div>
          )}
        </div>

        {/* Selection hint */}
        <div className="absolute bottom-4 left-4 right-4">
          <div className="bg-muted/80 backdrop-blur-sm rounded-lg px-4 py-2 text-center">
            <p className="text-xs text-muted-foreground">
              Select text to add it to the chat context
            </p>
          </div>
        </div>
      </div>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
    </>
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

function ChevronDownIcon({ className }: { className?: string }) {
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
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
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
