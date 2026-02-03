"use client";

import { Id } from "../../../convex/_generated/dataModel";

export interface DocumentCardProps {
  documentId: Id<"documents">;
  title: string;
  documentType: string;
  action: "created" | "updated";
  onClick?: () => void;
}

export function DocumentCard({
  title,
  documentType,
  action,
  onClick,
}: DocumentCardProps) {
  const typeLabels: Record<string, string> = {
    prd: "PRD",
    persona: "Persona",
    market: "Market Analysis",
    brand: "Brand Strategy",
    business: "Business Model",
    feature: "Feature Spec",
    tech: "Tech Stack",
    gtm: "Go-to-Market",
    custom: "Document",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="my-3 w-full rounded-xl border border-border bg-white p-4 text-left shadow-sm transition-all hover:border-primary hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-light">
          <DocumentIcon className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {action === "created" ? "New Document" : "Updated"}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {typeLabels[documentType] || documentType}
            </span>
          </div>
          <h4 className="font-medium text-foreground truncate">{title}</h4>
        </div>
        <div className="flex-shrink-0">
          <ChevronRightIcon className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Click to view and edit this document
      </p>
    </button>
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
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
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
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
