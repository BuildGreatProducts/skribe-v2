"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

interface PendingUpdatePreviewProps {
  originalContent: string;
  newContent: string;
  onApply: () => void;
  onReject: () => void;
}

export function PendingUpdatePreview({
  originalContent,
  newContent,
  onApply,
  onReject,
}: PendingUpdatePreviewProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate a simple diff summary
  const diffSummary = useMemo(() => {
    const originalLines = originalContent.split("\n");
    const newLines = newContent.split("\n");

    const originalChars = originalContent.length;
    const newChars = newContent.length;
    const charDiff = newChars - originalChars;

    // Count changed lines (simple comparison)
    let addedLines = 0;
    let removedLines = 0;

    // Very simple line diff
    const originalSet = new Set(originalLines);
    const newSet = new Set(newLines);

    for (const line of newLines) {
      if (!originalSet.has(line) && line.trim()) addedLines++;
    }
    for (const line of originalLines) {
      if (!newSet.has(line) && line.trim()) removedLines++;
    }

    return {
      charDiff,
      addedLines,
      removedLines,
      totalOriginalLines: originalLines.length,
      totalNewLines: newLines.length,
    };
  }, [originalContent, newContent]);

  // Generate a preview of the changes
  const preview = useMemo(() => {
    if (!isExpanded) return null;

    // Find first difference
    let startDiff = 0;
    const minLen = Math.min(originalContent.length, newContent.length);
    while (startDiff < minLen && originalContent[startDiff] === newContent[startDiff]) {
      startDiff++;
    }

    // Find context around the diff
    const contextStart = Math.max(0, startDiff - 50);
    const contextEnd = Math.min(newContent.length, startDiff + 200);

    const originalPreview =
      (contextStart > 0 ? "..." : "") +
      originalContent.slice(contextStart, contextEnd) +
      (contextEnd < originalContent.length ? "..." : "");

    const newPreview =
      (contextStart > 0 ? "..." : "") +
      newContent.slice(contextStart, contextEnd) +
      (contextEnd < newContent.length ? "..." : "");

    return { originalPreview, newPreview };
  }, [originalContent, newContent, isExpanded]);

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DocumentChangeIcon className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-primary">Changes Ready</span>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-primary hover:underline"
        >
          {isExpanded ? "Hide preview" : "Show preview"}
        </button>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-xs">
        <span
          className={cn(
            "flex items-center gap-1",
            diffSummary.charDiff > 0 ? "text-success" : "text-muted-foreground"
          )}
        >
          {diffSummary.charDiff > 0 ? "+" : ""}
          {diffSummary.charDiff} chars
        </span>
        {diffSummary.addedLines > 0 && (
          <span className="text-success flex items-center gap-1">
            +{diffSummary.addedLines} lines
          </span>
        )}
        {diffSummary.removedLines > 0 && (
          <span className="text-destructive flex items-center gap-1">
            -{diffSummary.removedLines} lines
          </span>
        )}
      </div>

      {/* Preview */}
      {isExpanded && preview && (
        <div className="space-y-2 text-xs">
          <div className="rounded-lg bg-destructive/10 p-2 border border-destructive/20">
            <div className="text-destructive/70 font-medium mb-1">Before:</div>
            <pre className="whitespace-pre-wrap text-destructive/80 font-mono overflow-hidden max-h-24">
              {preview.originalPreview}
            </pre>
          </div>
          <div className="rounded-lg bg-success/10 p-2 border border-success/20">
            <div className="text-success/70 font-medium mb-1">After:</div>
            <pre className="whitespace-pre-wrap text-success/80 font-mono overflow-hidden max-h-24">
              {preview.newPreview}
            </pre>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button size="sm" onClick={onApply} className="flex-1">
          <CheckIcon className="h-3.5 w-3.5 mr-1" />
          Apply
        </Button>
        <Button size="sm" variant="outline" onClick={onReject} className="flex-1">
          <XIcon className="h-3.5 w-3.5 mr-1" />
          Reject
        </Button>
      </div>
    </div>
  );
}

function DocumentChangeIcon({ className }: { className?: string }) {
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
      <path d="M12 18v-6" />
      <path d="m9 15 3 3 3-3" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
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
      <path d="M20 6 9 17l-5-5" />
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
