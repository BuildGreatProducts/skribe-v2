"use client";

import { cn } from "@/lib/utils";

export interface SelectionContext {
  text: string;
  startOffset: number;
  endOffset: number;
  contentSnapshot: string;
}

interface SelectionContextChipProps {
  selection: SelectionContext;
  onClear: () => void;
  className?: string;
}

export function SelectionContextChip({
  selection,
  onClear,
  className,
}: SelectionContextChipProps) {
  const maxPreviewLength = 60;
  const previewText =
    selection.text.length > maxPreviewLength
      ? selection.text.slice(0, maxPreviewLength) + "..."
      : selection.text;

  const charCount = selection.text.length;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full bg-primary-light px-3 py-1.5 text-sm",
        className
      )}
    >
      <SelectionIcon className="h-4 w-4 text-primary flex-shrink-0" />
      <span className="text-primary font-medium truncate max-w-[200px]">
        &ldquo;{previewText}&rdquo;
      </span>
      <span className="text-primary/70 text-xs flex-shrink-0">
        {charCount} chars
      </span>
      <button
        onClick={onClear}
        className="p-0.5 rounded-full hover:bg-primary/10 transition-colors flex-shrink-0"
        aria-label="Clear selection"
      >
        <XIcon className="h-3.5 w-3.5 text-primary" />
      </button>
    </div>
  );
}

function SelectionIcon({ className }: { className?: string }) {
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
      <path d="M5 3a2 2 0 0 0-2 2" />
      <path d="M19 3a2 2 0 0 1 2 2" />
      <path d="M21 19a2 2 0 0 1-2 2" />
      <path d="M5 21a2 2 0 0 1-2-2" />
      <path d="M9 3h1" />
      <path d="M9 21h1" />
      <path d="M14 3h1" />
      <path d="M14 21h1" />
      <path d="M3 9v1" />
      <path d="M21 9v1" />
      <path d="M3 14v1" />
      <path d="M21 14v1" />
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
