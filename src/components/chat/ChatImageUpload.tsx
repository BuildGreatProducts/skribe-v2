"use client";

import { useRef, useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { PendingImage } from "@/hooks/use-image-upload";

// ============================================
// ImageUploadButton - triggers file selection
// ============================================

interface ImageUploadButtonProps {
  onFilesSelected: (files: FileList) => void;
  disabled?: boolean;
  className?: string;
  maxImages?: number;
  currentCount?: number;
}

export function ImageUploadButton({
  onFilesSelected,
  disabled = false,
  className,
  maxImages = 4,
  currentCount = 0,
}: ImageUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFilesSelected(files);
    }
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const remainingSlots = maxImages - currentCount;
  const isAtLimit = remainingSlots <= 0;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        multiple
        onChange={handleChange}
        className="hidden"
        disabled={disabled || isAtLimit}
      />
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isAtLimit}
        className={cn(
          "flex items-center justify-center rounded-lg p-2 transition-colors",
          "text-muted-foreground hover:text-foreground hover:bg-muted",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
        title={
          isAtLimit
            ? `Maximum ${maxImages} images reached`
            : `Attach image (${remainingSlots} remaining)`
        }
        aria-label="Attach image"
      >
        <ImageIcon className="h-5 w-5" />
      </button>
    </>
  );
}

// ============================================
// ImagePreviewList - shows pending images in input area
// ============================================

interface ImagePreviewListProps {
  images: PendingImage[];
  onRemove: (id: string) => void;
  className?: string;
}

export function ImagePreviewList({
  images,
  onRemove,
  className,
}: ImagePreviewListProps) {
  if (images.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap gap-2 p-2", className)}>
      {images.map((image) => (
        <ImagePreviewItem key={image.id} image={image} onRemove={onRemove} />
      ))}
    </div>
  );
}

interface ImagePreviewItemProps {
  image: PendingImage;
  onRemove: (id: string) => void;
}

function ImagePreviewItem({ image, onRemove }: ImagePreviewItemProps) {
  const isUploading = image.status === "uploading";
  const hasError = image.status === "error";
  const isUploaded = image.status === "uploaded";

  return (
    <div className="relative group">
      <div
        className={cn(
          "relative h-16 w-16 rounded-lg overflow-hidden border-2",
          hasError && "border-destructive",
          isUploaded && "border-green-500",
          !hasError && !isUploaded && "border-border"
        )}
      >
        {/* Image thumbnail */}
        <img
          src={image.previewUrl}
          alt={image.file.name}
          className={cn(
            "h-full w-full object-cover",
            isUploading && "opacity-50"
          )}
        />

        {/* Upload progress overlay */}
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
          </div>
        )}

        {/* Upload complete indicator */}
        {isUploaded && (
          <div className="absolute bottom-0.5 right-0.5 rounded-full bg-green-500 p-0.5">
            <CheckIcon className="h-3 w-3 text-white" />
          </div>
        )}

        {/* Error indicator */}
        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <AlertIcon className="h-5 w-5 text-destructive" />
          </div>
        )}
      </div>

      {/* Remove button */}
      <button
        type="button"
        onClick={() => onRemove(image.id)}
        className={cn(
          "absolute -top-1.5 -right-1.5 rounded-full bg-foreground p-0.5",
          "text-background hover:bg-destructive transition-colors",
          "opacity-0 group-hover:opacity-100 focus:opacity-100"
        )}
        aria-label={`Remove ${image.file.name}`}
      >
        <XIcon className="h-3.5 w-3.5" />
      </button>

      {/* Error tooltip */}
      {hasError && image.error && (
        <div className="absolute top-full left-0 mt-1 z-10 hidden group-hover:block">
          <div className="bg-destructive text-white text-xs rounded px-2 py-1 max-w-32 whitespace-normal">
            {image.error}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// ChatImageDisplay - shows images in message bubbles
// ============================================

interface ChatImageDisplayProps {
  images: Array<{
    storageId: string;
    filename: string;
    contentType: string;
    size: number;
  }>;
  imageUrls: Record<string, string | null>;
  isUser?: boolean;
  className?: string;
}

export function ChatImageDisplay({
  images,
  imageUrls,
  isUser = false,
  className,
}: ChatImageDisplayProps) {
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  if (images.length === 0) {
    return null;
  }

  return (
    <>
      <div
        className={cn(
          "flex flex-wrap gap-2 mt-2",
          isUser ? "justify-end" : "justify-start",
          className
        )}
      >
        {images.map((image) => {
          const url = imageUrls[image.storageId];
          return (
            <button
              key={image.storageId}
              type="button"
              onClick={() => url && setLightboxImage(url)}
              className={cn(
                "relative overflow-hidden rounded-lg transition-transform hover:scale-105",
                "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              )}
            >
              {url ? (
                <img
                  src={url}
                  alt={image.filename}
                  className="h-32 w-32 object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="h-32 w-32 bg-muted flex items-center justify-center">
                  <ImageIcon className="h-8 w-8 text-muted-foreground animate-pulse" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Lightbox */}
      {lightboxImage && (
        <ImageLightbox
          src={lightboxImage}
          onClose={() => setLightboxImage(null)}
        />
      )}
    </>
  );
}

// ============================================
// ImageLightbox - fullscreen image viewer
// ============================================

interface ImageLightboxProps {
  src: string;
  onClose: () => void;
}

function ImageLightbox({ src, onClose }: ImageLightboxProps) {
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  // Close on escape key
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
        aria-label="Close image preview"
      >
        <XIcon className="h-6 w-6" />
      </button>
      <img
        src={src}
        alt="Full size preview"
        className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
      />
    </div>
  );
}

// ============================================
// DropZone - for drag and drop support
// ============================================

interface DropZoneProps {
  onFilesDropped: (files: FileList) => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function DropZone({
  onFilesDropped,
  children,
  className,
  disabled = false,
}: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragging(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled) return;

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        // Filter to only image files
        const imageFiles = Array.from(files).filter((f) =>
          f.type.startsWith("image/")
        );
        if (imageFiles.length > 0) {
          const dt = new DataTransfer();
          imageFiles.forEach((f) => dt.items.add(f));
          onFilesDropped(dt.files);
        }
      }
    },
    [disabled, onFilesDropped]
  );

  return (
    <div
      className={cn(
        "relative",
        isDragging && "ring-2 ring-primary ring-offset-2 rounded-xl",
        className
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}
      {isDragging && (
        <div className="absolute inset-0 bg-primary/10 rounded-xl flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-lg px-4 py-2 shadow-lg">
            <p className="text-sm font-medium text-primary">Drop image here</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Icons
// ============================================

function ImageIcon({ className }: { className?: string }) {
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
      aria-hidden="true"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
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
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
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
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
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
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </svg>
  );
}
