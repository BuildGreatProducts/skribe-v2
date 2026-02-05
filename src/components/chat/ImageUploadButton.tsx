"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import { IMAGE_UPLOAD_LIMITS } from "@/hooks/use-image-upload";
import { StorageQuotaCompact } from "./StorageQuotaIndicator";

interface ImageUploadButtonProps {
  onFilesSelected: (files: FileList) => void;
  disabled?: boolean;
  className?: string;
  showQuotaWarning?: boolean;
}

export function ImageUploadButton({
  onFilesSelected,
  disabled = false,
  className,
  showQuotaWarning = true,
}: ImageUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFilesSelected(files);
      // Reset input so the same file can be selected again
      e.target.value = "";
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_UPLOAD_LIMITS.allowedMimeTypes.join(",")}
        multiple
        onChange={handleChange}
        className="hidden"
        aria-label="Upload images"
      />
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className={cn(
          "flex items-center justify-center rounded-lg p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        title="Attach images (max 3MB each)"
        aria-label="Attach images"
      >
        <ImageIcon className="h-5 w-5" />
      </button>
      {showQuotaWarning && <StorageQuotaCompact />}
    </div>
  );
}

function ImageIcon({ className }: { className?: string }) {
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
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  );
}
