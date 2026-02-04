"use client";

import { useState, useCallback, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

// Constants matching server-side validation
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_IMAGES_PER_MESSAGE = 4;
const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

export interface PendingImage {
  id: string; // Local ID for tracking
  file: File;
  previewUrl: string;
  status: "pending" | "uploading" | "uploaded" | "error";
  progress: number;
  error?: string;
  // Set after successful upload
  storageId?: Id<"_storage">;
  uploadedImage?: {
    storageId: Id<"_storage">;
    filename: string;
    contentType: string;
    size: number;
  };
}

export interface UseImageUploadOptions {
  maxImages?: number;
  maxSize?: number;
  onError?: (error: string) => void;
}

export function useImageUpload(options: UseImageUploadOptions = {}) {
  const {
    maxImages = MAX_IMAGES_PER_MESSAGE,
    maxSize = MAX_IMAGE_SIZE,
    onError,
  } = options;

  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const confirmUpload = useMutation(api.storage.confirmUpload);
  const storageQuota = useQuery(api.storage.getStorageQuota);

  // Generate unique ID for tracking
  const generateId = useCallback(() => {
    return `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Validate file before adding
  const validateFile = useCallback(
    (file: File): string | null => {
      if (!ALLOWED_CONTENT_TYPES.includes(file.type)) {
        return `Invalid file type "${file.type}". Allowed: JPEG, PNG, GIF, WebP`;
      }

      if (file.size > maxSize) {
        return `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum: ${maxSize / 1024 / 1024}MB`;
      }

      return null;
    },
    [maxSize]
  );

  // Add images from file input or drop
  const addImages = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files);

      // Check total count
      if (pendingImages.length + fileArray.length > maxImages) {
        const error = `Maximum ${maxImages} images per message. You can add ${maxImages - pendingImages.length} more.`;
        onError?.(error);
        return;
      }

      // Check storage quota
      const totalNewSize = fileArray.reduce((sum, f) => sum + f.size, 0);
      if (storageQuota && totalNewSize > storageQuota.remaining) {
        const error = `Not enough storage. You have ${(storageQuota.remaining / 1024 / 1024).toFixed(1)}MB remaining.`;
        onError?.(error);
        return;
      }

      const newImages: PendingImage[] = [];

      for (const file of fileArray) {
        const validationError = validateFile(file);
        if (validationError) {
          onError?.(validationError);
          continue;
        }

        const previewUrl = URL.createObjectURL(file);
        newImages.push({
          id: generateId(),
          file,
          previewUrl,
          status: "pending",
          progress: 0,
        });
      }

      if (newImages.length > 0) {
        setPendingImages((prev) => [...prev, ...newImages]);
      }
    },
    [
      pendingImages.length,
      maxImages,
      storageQuota,
      validateFile,
      generateId,
      onError,
    ]
  );

  // Remove a pending image
  const removeImage = useCallback((id: string) => {
    setPendingImages((prev) => {
      const image = prev.find((img) => img.id === id);
      if (image) {
        // Revoke object URL to free memory
        URL.revokeObjectURL(image.previewUrl);
        // Cancel any ongoing upload
        const controller = abortControllersRef.current.get(id);
        if (controller) {
          controller.abort();
          abortControllersRef.current.delete(id);
        }
      }
      return prev.filter((img) => img.id !== id);
    });
  }, []);

  // Clear all pending images
  const clearImages = useCallback(() => {
    // Revoke all object URLs
    pendingImages.forEach((img) => {
      URL.revokeObjectURL(img.previewUrl);
      const controller = abortControllersRef.current.get(img.id);
      if (controller) {
        controller.abort();
      }
    });
    abortControllersRef.current.clear();
    setPendingImages([]);
  }, [pendingImages]);

  // Upload a single image
  const uploadImage = useCallback(
    async (image: PendingImage): Promise<PendingImage["uploadedImage"] | null> => {
      const controller = new AbortController();
      abortControllersRef.current.set(image.id, controller);

      try {
        // Update status to uploading
        setPendingImages((prev) =>
          prev.map((img) =>
            img.id === image.id
              ? { ...img, status: "uploading" as const, progress: 10 }
              : img
          )
        );

        // Get upload URL
        const { uploadUrl } = await generateUploadUrl({
          contentType: image.file.type,
          size: image.file.size,
        });

        // Check if aborted
        if (controller.signal.aborted) {
          return null;
        }

        setPendingImages((prev) =>
          prev.map((img) =>
            img.id === image.id ? { ...img, progress: 30 } : img
          )
        );

        // Upload to Convex storage
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": image.file.type },
          body: image.file,
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Upload failed");
        }

        const { storageId } = (await response.json()) as {
          storageId: Id<"_storage">;
        };

        setPendingImages((prev) =>
          prev.map((img) =>
            img.id === image.id ? { ...img, progress: 70 } : img
          )
        );

        // Confirm upload and update quota
        const uploadedImage = await confirmUpload({
          storageId,
          filename: image.file.name,
          contentType: image.file.type,
          size: image.file.size,
        });

        // Update status to uploaded
        setPendingImages((prev) =>
          prev.map((img) =>
            img.id === image.id
              ? {
                  ...img,
                  status: "uploaded" as const,
                  progress: 100,
                  storageId,
                  uploadedImage,
                }
              : img
          )
        );

        abortControllersRef.current.delete(image.id);
        return uploadedImage;
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return null;
        }

        const errorMessage =
          error instanceof Error ? error.message : "Upload failed";

        setPendingImages((prev) =>
          prev.map((img) =>
            img.id === image.id
              ? { ...img, status: "error" as const, error: errorMessage }
              : img
          )
        );

        abortControllersRef.current.delete(image.id);
        return null;
      }
    },
    [generateUploadUrl, confirmUpload]
  );

  // Upload all pending images
  const uploadAllImages = useCallback(async () => {
    const pendingToUpload = pendingImages.filter(
      (img) => img.status === "pending"
    );

    if (pendingToUpload.length === 0) {
      // Return already uploaded images
      return pendingImages
        .filter((img) => img.uploadedImage)
        .map((img) => img.uploadedImage!);
    }

    setIsUploading(true);

    try {
      const results = await Promise.all(
        pendingToUpload.map((img) => uploadImage(img))
      );

      // Combine with already uploaded images
      const allUploaded = [
        ...pendingImages
          .filter((img) => img.status === "uploaded" && img.uploadedImage)
          .map((img) => img.uploadedImage!),
        ...results.filter(
          (r): r is NonNullable<typeof r> => r !== null
        ),
      ];

      return allUploaded;
    } finally {
      setIsUploading(false);
    }
  }, [pendingImages, uploadImage]);

  // Get uploaded images (for message creation)
  const getUploadedImages = useCallback(() => {
    return pendingImages
      .filter((img) => img.uploadedImage)
      .map((img) => img.uploadedImage!);
  }, [pendingImages]);

  // Check if there are any errors
  const hasErrors = pendingImages.some((img) => img.status === "error");

  // Check if all uploads are complete
  const allUploaded =
    pendingImages.length > 0 &&
    pendingImages.every((img) => img.status === "uploaded");

  // Check if there are pending uploads
  const hasPendingUploads = pendingImages.some(
    (img) => img.status === "pending" || img.status === "uploading"
  );

  return {
    pendingImages,
    isUploading,
    hasErrors,
    allUploaded,
    hasPendingUploads,
    storageQuota,
    addImages,
    removeImage,
    clearImages,
    uploadAllImages,
    getUploadedImages,
    // Expose constants for validation
    maxImages,
    maxSize,
    allowedTypes: ALLOWED_CONTENT_TYPES,
  };
}
