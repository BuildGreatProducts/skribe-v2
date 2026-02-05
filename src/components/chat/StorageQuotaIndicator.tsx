"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { cn } from "@/lib/utils";

interface StorageQuotaIndicatorProps {
  className?: string;
  showLabel?: boolean;
}

export function StorageQuotaIndicator({
  className,
  showLabel = true,
}: StorageQuotaIndicatorProps) {
  const storageUsage = useQuery(api.storage.getUserStorageUsage);

  if (!storageUsage) {
    return null;
  }

  const { used, limit, percentUsed } = storageUsage;

  // Format bytes to human readable
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  // Determine color based on usage (using pastel palette)
  // Rose (#FFD6E0) for high, Peach (#FFE5D6) for medium, Mint (#D6FFE4) for low
  const getProgressColor = () => {
    if (percentUsed >= 90) return "bg-[#FFD6E0]"; // Rose
    if (percentUsed >= 75) return "bg-[#FFE5D6]"; // Peach
    return "bg-[#D6FFE4]"; // Mint
  };

  const isNearLimit = percentUsed >= 75;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {showLabel && (
        <span className="text-xs text-muted-foreground">Storage:</span>
      )}
      <div className="flex items-center gap-1.5">
        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full transition-all", getProgressColor())}
            style={{ width: `${Math.min(percentUsed, 100)}%` }}
          />
        </div>
        <span
          className={cn(
            "text-xs",
            isNearLimit ? "text-foreground font-medium" : "text-muted-foreground"
          )}
        >
          {formatBytes(used)} / {formatBytes(limit)}
        </span>
      </div>
    </div>
  );
}

/**
 * Compact version for use in tooltips or small spaces
 */
export function StorageQuotaCompact({ className }: { className?: string }) {
  const storageUsage = useQuery(api.storage.getUserStorageUsage);

  if (!storageUsage) {
    return null;
  }

  const { used, limit, percentUsed } = storageUsage;

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const isNearLimit = percentUsed >= 75;
  const isAtLimit = percentUsed >= 100;

  if (isAtLimit) {
    return (
      <div className={cn("flex items-center gap-1 text-foreground", className)}>
        <WarningIcon className="h-3 w-3" />
        <span className="text-xs font-medium">Storage full</span>
      </div>
    );
  }

  if (isNearLimit) {
    return (
      <div className={cn("text-xs text-muted-foreground font-medium", className)}>
        {formatBytes(limit - used)} remaining
      </div>
    );
  }

  return null;
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}
