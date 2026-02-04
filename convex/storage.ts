import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";

// Storage limits by subscription tier (in bytes)
const STORAGE_LIMITS = {
  free: 50 * 1024 * 1024, // 50MB
  starter: 500 * 1024 * 1024, // 500MB
  pro: 2 * 1024 * 1024 * 1024, // 2GB
} as const;

// Per-image size limit (5MB)
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

// Max images per message
const MAX_IMAGES_PER_MESSAGE = 4;

// Allowed image types
const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

/**
 * Helper to get authenticated user from context.
 */
async function getAuthenticatedUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();

  return user;
}

/**
 * Helper to require authenticated user.
 */
async function requireAuthenticatedUser(ctx: QueryCtx | MutationCtx) {
  const user = await getAuthenticatedUser(ctx);
  if (!user) {
    throw new Error("Unauthorized: You must be logged in");
  }
  return user;
}

/**
 * Get storage quota information for the current user.
 */
export const getStorageQuota = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    const limit = STORAGE_LIMITS[user.subscriptionTier];
    const used = user.storageUsed ?? 0;

    return {
      used,
      limit,
      remaining: Math.max(0, limit - used),
      percentUsed: Math.round((used / limit) * 100),
    };
  },
});

/**
 * Generate an upload URL for image uploads.
 * Validates quota before generating URL.
 */
export const generateUploadUrl = mutation({
  args: {
    contentType: v.string(),
    size: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);

    // Validate content type
    if (!ALLOWED_CONTENT_TYPES.includes(args.contentType)) {
      throw new Error(
        `Invalid file type. Allowed types: ${ALLOWED_CONTENT_TYPES.join(", ")}`
      );
    }

    // Validate file size
    if (args.size > MAX_IMAGE_SIZE) {
      throw new Error(
        `File too large. Maximum size is ${MAX_IMAGE_SIZE / 1024 / 1024}MB`
      );
    }

    // Check storage quota
    const limit = STORAGE_LIMITS[user.subscriptionTier];
    const used = user.storageUsed ?? 0;
    const remaining = limit - used;

    if (args.size > remaining) {
      throw new Error(
        `Storage quota exceeded. You have ${Math.round(remaining / 1024 / 1024)}MB remaining. ` +
          `Upgrade your plan for more storage.`
      );
    }

    // Generate upload URL
    const uploadUrl = await ctx.storage.generateUploadUrl();

    return { uploadUrl };
  },
});

/**
 * Confirm an upload and update storage quota.
 * Called after successfully uploading to the generated URL.
 */
export const confirmUpload = mutation({
  args: {
    storageId: v.id("_storage"),
    filename: v.string(),
    contentType: v.string(),
    size: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);

    // Verify the storage ID exists and get metadata
    const metadata = await ctx.storage.getMetadata(args.storageId);
    if (!metadata) {
      throw new Error("Upload not found. Please try again.");
    }

    // Validate content type server-side
    if (
      metadata.contentType &&
      !ALLOWED_CONTENT_TYPES.includes(metadata.contentType)
    ) {
      // Delete the invalid upload
      await ctx.storage.delete(args.storageId);
      throw new Error("Invalid file type uploaded.");
    }

    // Update user's storage quota
    const currentUsed = user.storageUsed ?? 0;
    await ctx.db.patch(user._id, {
      storageUsed: currentUsed + (metadata.size ?? args.size),
      updatedAt: Date.now(),
    });

    return {
      storageId: args.storageId,
      filename: args.filename,
      contentType: metadata.contentType ?? args.contentType,
      size: metadata.size ?? args.size,
    };
  },
});

/**
 * Get a serving URL for a stored image.
 */
export const getImageUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const url = await ctx.storage.getUrl(args.storageId);
    return url;
  },
});

/**
 * Get serving URLs for multiple images.
 */
export const getImageUrls = query({
  args: { storageIds: v.array(v.id("_storage")) },
  handler: async (ctx, args) => {
    const urls: Record<string, string | null> = {};

    for (const storageId of args.storageIds) {
      urls[storageId] = await ctx.storage.getUrl(storageId);
    }

    return urls;
  },
});

/**
 * Delete an image and reclaim storage quota.
 * Only allows deleting images that belong to the user's messages.
 */
export const deleteImage = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);

    // Get metadata to know the size for quota adjustment
    const metadata = await ctx.storage.getMetadata(args.storageId);
    const size = metadata?.size ?? 0;

    // Delete the file
    await ctx.storage.delete(args.storageId);

    // Update storage quota
    const currentUsed = user.storageUsed ?? 0;
    await ctx.db.patch(user._id, {
      storageUsed: Math.max(0, currentUsed - size),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Validate images before message creation.
 * Checks count limits and total size.
 */
export const validateImagesForMessage = query({
  args: {
    imageCount: v.number(),
    totalSize: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return { valid: false, error: "Unauthorized" };
    }

    // Check image count
    if (args.imageCount > MAX_IMAGES_PER_MESSAGE) {
      return {
        valid: false,
        error: `Maximum ${MAX_IMAGES_PER_MESSAGE} images per message`,
      };
    }

    // Check quota
    const limit = STORAGE_LIMITS[user.subscriptionTier];
    const used = user.storageUsed ?? 0;
    const remaining = limit - used;

    if (args.totalSize > remaining) {
      return {
        valid: false,
        error: `Not enough storage. ${Math.round(remaining / 1024 / 1024)}MB remaining.`,
      };
    }

    return { valid: true, error: null };
  },
});

// Export constants for client-side use
export const storageConstants = {
  maxImageSize: MAX_IMAGE_SIZE,
  maxImagesPerMessage: MAX_IMAGES_PER_MESSAGE,
  allowedContentTypes: ALLOWED_CONTENT_TYPES,
};
