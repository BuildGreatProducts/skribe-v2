"use client";

import { cn } from "@/lib/utils";
import { PendingImage } from "@/hooks/use-image-upload";
import Image from "next/image";

interface ImagePreviewGridProps {
  images: PendingImage[];
  onRemove: (id: string) => void;
  className?: string;
}

export function ImagePreviewGrid({
  images,
  onRemove,
  className,
}: ImagePreviewGridProps) {
  if (images.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap gap-2 p-2", className)}>
      {images.map((image) => (
        <ImagePreviewItem
          key={image.id}
          image={image}
          onRemove={() => onRemove(image.id)}
        />
      ))}
    </div>
  );
}

interface ImagePreviewItemProps {
  image: PendingImage;
  onRemove: () => void;
}

function ImagePreviewItem({ image, onRemove }: ImagePreviewItemProps) {
  return (
    <div className="group relative">
      <div
        className={cn(
          "relative h-16 w-16 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50",
          image.status === "uploading" && "opacity-70",
          image.status === "error" && "border-red-300 bg-red-50"
        )}
      >
        <Image
          src={image.preview}
          alt="Preview"
          fill
          className="object-cover"
          unoptimized
        />

        {/* Upload progress overlay */}
        {image.status === "uploading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          </div>
        )}

        {/* Error indicator */}
        {image.status === "error" && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-500/20">
            <ErrorIcon className="h-5 w-5 text-red-600" />
          </div>
        )}

        {/* Success indicator */}
        {image.status === "uploaded" && (
          <div className="absolute bottom-1 right-1">
            <div className="rounded-full bg-green-500 p-0.5">
              <CheckIcon className="h-2.5 w-2.5 text-white" />
            </div>
          </div>
        )}
      </div>

      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-800 text-white opacity-0 transition-opacity hover:bg-neutral-700 group-hover:opacity-100"
        aria-label="Remove image"
      >
        <XIcon className="h-3 w-3" />
      </button>

      {/* Error tooltip */}
      {image.status === "error" && image.error && (
        <div className="absolute -bottom-1 left-0 right-0 translate-y-full">
          <div className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] text-white">
            {image.error.length > 30
              ? image.error.substring(0, 30) + "..."
              : image.error}
          </div>
        </div>
      )}
    </div>
  );
}

function XIcon({ className }: { className?: string }) {
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
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ErrorIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </svg>
  );
}
