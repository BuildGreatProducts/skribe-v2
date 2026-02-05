"use client";

import { useState, useCallback, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

// Image limits - should match convex/storage.ts
const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3 MB
const MAX_IMAGES_PER_MESSAGE = 5;
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

export interface PendingImage {
  id: string;
  file: File;
  preview: string;
  status: "pending" | "uploading" | "uploaded" | "error";
  storageId?: Id<"_storage">;
  error?: string;
  progress?: number;
}

export interface UseImageUploadReturn {
  pendingImages: PendingImage[];
  isUploading: boolean;
  uploadError: string | null;
  storageUsage: { used: number; limit: number; percentUsed: number } | null;

  addImages: (files: FileList | File[]) => Promise<void>;
  removeImage: (id: string) => void;
  clearImages: () => void;
  uploadAllImages: () => Promise<Id<"_storage">[]>;
}

export function useImageUpload(): UseImageUploadReturn {
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const saveImage = useMutation(api.storage.saveImage);
  const deleteImage = useMutation(api.storage.deleteImage);
  const storageUsage = useQuery(api.storage.getUserStorageUsage);

  const isUploading = pendingImages.some((img) => img.status === "uploading");

  /**
   * Validate a file before adding
   */
  const validateFile = useCallback(
    (file: File): string | null => {
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return `Invalid file type: ${file.type}. Allowed: JPEG, PNG, GIF, WebP`;
      }

      if (file.size > MAX_FILE_SIZE) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        return `File too large: ${sizeMB}MB. Maximum: ${MAX_FILE_SIZE / (1024 * 1024)}MB`;
      }

      return null;
    },
    []
  );

  /**
   * Add images to the pending list
   */
  const addImages = useCallback(
    async (files: FileList | File[]) => {
      setUploadError(null);
      const fileArray = Array.from(files);

      // Check if adding these files would exceed the per-message limit
      const currentCount = pendingImages.length;
      const availableSlots = MAX_IMAGES_PER_MESSAGE - currentCount;

      if (availableSlots <= 0) {
        setUploadError(`Maximum ${MAX_IMAGES_PER_MESSAGE} images per message`);
        return;
      }

      const filesToAdd = fileArray.slice(0, availableSlots);
      if (filesToAdd.length < fileArray.length) {
        setUploadError(
          `Only ${filesToAdd.length} of ${fileArray.length} images added (max ${MAX_IMAGES_PER_MESSAGE})`
        );
      }

      // Validate and create pending images
      const newPendingImages: PendingImage[] = [];

      for (const file of filesToAdd) {
        const validationError = validateFile(file);
        if (validationError) {
          setUploadError(validationError);
          continue;
        }

        // Create preview URL
        const preview = URL.createObjectURL(file);
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

        newPendingImages.push({
          id,
          file,
          preview,
          status: "pending",
        });
      }

      if (newPendingImages.length > 0) {
        setPendingImages((prev) => [...prev, ...newPendingImages]);
      }
    },
    [pendingImages.length, validateFile]
  );

  /**
   * Remove an image from the pending list
   */
  const removeImage = useCallback(
    async (id: string) => {
      const image = pendingImages.find((img) => img.id === id);
      if (!image) return;

      // Cancel upload if in progress
      const controller = abortControllersRef.current.get(id);
      if (controller) {
        controller.abort();
        abortControllersRef.current.delete(id);
      }

      // Revoke the preview URL
      URL.revokeObjectURL(image.preview);

      // If already uploaded, delete from storage
      if (image.storageId) {
        try {
          await deleteImage({ storageId: image.storageId });
        } catch (error) {
          console.error("Failed to delete image from storage:", error);
        }
      }

      setPendingImages((prev) => prev.filter((img) => img.id !== id));
      setUploadError(null);
    },
    [pendingImages, deleteImage]
  );

  /**
   * Clear all pending images
   */
  const clearImages = useCallback(() => {
    // Cancel all uploads
    abortControllersRef.current.forEach((controller) => controller.abort());
    abortControllersRef.current.clear();

    // Revoke all preview URLs
    pendingImages.forEach((img) => URL.revokeObjectURL(img.preview));

    // Delete any already uploaded images
    pendingImages.forEach(async (img) => {
      if (img.storageId) {
        try {
          await deleteImage({ storageId: img.storageId });
        } catch (error) {
          console.error("Failed to delete image from storage:", error);
        }
      }
    });

    setPendingImages([]);
    setUploadError(null);
  }, [pendingImages, deleteImage]);

  /**
   * Upload a single image
   */
  const uploadImage = useCallback(
    async (image: PendingImage): Promise<Id<"_storage"> | null> => {
      const controller = new AbortController();
      abortControllersRef.current.set(image.id, controller);

      try {
        // Update status to uploading
        setPendingImages((prev) =>
          prev.map((img) =>
            img.id === image.id ? { ...img, status: "uploading" as const } : img
          )
        );

        // Generate upload URL
        const uploadUrl = await generateUploadUrl({
          fileSize: image.file.size,
          mimeType: image.file.type,
        });

        // Upload the file
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": image.file.type },
          body: image.file,
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`);
        }

        const { storageId } = (await response.json()) as {
          storageId: Id<"_storage">;
        };

        // Save the image record
        await saveImage({
          storageId,
          fileSize: image.file.size,
        });

        // Update status to uploaded
        setPendingImages((prev) =>
          prev.map((img) =>
            img.id === image.id
              ? { ...img, status: "uploaded" as const, storageId }
              : img
          )
        );

        abortControllersRef.current.delete(image.id);
        return storageId;
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          // Upload was cancelled
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
    [generateUploadUrl, saveImage]
  );

  /**
   * Upload all pending images and return storage IDs
   */
  const uploadAllImages = useCallback(async (): Promise<Id<"_storage">[]> => {
    const imagesToUpload = pendingImages.filter(
      (img) => img.status === "pending" || img.status === "error"
    );
    const alreadyUploaded = pendingImages.filter(
      (img) => img.status === "uploaded" && img.storageId
    );

    // Upload pending images in parallel
    const uploadPromises = imagesToUpload.map((img) => uploadImage(img));
    const results = await Promise.all(uploadPromises);

    // Collect all storage IDs (from new uploads and already uploaded)
    const storageIds: Id<"_storage">[] = [
      ...alreadyUploaded.map((img) => img.storageId!),
      ...results.filter((id): id is Id<"_storage"> => id !== null),
    ];

    return storageIds;
  }, [pendingImages, uploadImage]);

  return {
    pendingImages,
    isUploading,
    uploadError,
    storageUsage: storageUsage ?? null,
    addImages,
    removeImage,
    clearImages,
    uploadAllImages,
  };
}

// Export constants for use in components
export const IMAGE_UPLOAD_LIMITS = {
  maxFileSize: MAX_FILE_SIZE,
  maxImagesPerMessage: MAX_IMAGES_PER_MESSAGE,
  allowedMimeTypes: ALLOWED_MIME_TYPES,
};
