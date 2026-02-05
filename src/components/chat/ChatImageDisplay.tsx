"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface ChatImageDisplayProps {
  imageIds: Id<"_storage">[];
  className?: string;
}

export function ChatImageDisplay({ imageIds, className }: ChatImageDisplayProps) {
  const imageUrls = useQuery(api.storage.getImageUrls, { storageIds: imageIds });

  if (!imageUrls || imageUrls.length === 0) {
    return null;
  }

  // Filter out null URLs (deleted images)
  const validImages = imageUrls
    .map((url, index) => ({ url, id: imageIds[index] }))
    .filter((img): img is { url: string; id: Id<"_storage"> } => img.url !== null);

  if (validImages.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {validImages.map((image) => (
        <ChatImage key={image.id} url={image.url} />
      ))}
    </div>
  );
}

interface ChatImageProps {
  url: string;
}

function ChatImage({ url }: ChatImageProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsExpanded(true)}
        className={cn(
          "relative overflow-hidden rounded-lg border border-neutral-200 transition-all hover:border-neutral-300 hover:shadow-md",
          "h-32 w-32 sm:h-40 sm:w-40"
        )}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-100">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent" />
          </div>
        )}
        {hasError ? (
          <div className="flex h-full w-full items-center justify-center bg-neutral-100 text-neutral-400">
            <BrokenImageIcon className="h-8 w-8" />
          </div>
        ) : (
          <Image
            src={url}
            alt="Attached image"
            fill
            className={cn(
              "object-cover transition-opacity",
              isLoading ? "opacity-0" : "opacity-100"
            )}
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
            unoptimized
          />
        )}
      </button>

      {/* Expanded view modal */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setIsExpanded(false)}
        >
          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
            aria-label="Close"
          >
            <XIcon className="h-6 w-6" />
          </button>
          <div
            className="relative max-h-[90vh] max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt="Expanded image"
              className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            />
          </div>
        </div>
      )}
    </>
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

function BrokenImageIcon({ className }: { className?: string }) {
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
      <path d="M10.3 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10l-3.1-3.1a2 2 0 0 0-2.814.014L6 21" />
      <path d="m2 2 20 20" />
      <circle cx="9" cy="9" r="2" />
    </svg>
  );
}
