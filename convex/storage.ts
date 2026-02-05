import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";

// Storage limits by subscription tier (in bytes)
const STORAGE_LIMITS = {
  free: 50 * 1024 * 1024, // 50 MB
  starter: 200 * 1024 * 1024, // 200 MB
  pro: 1024 * 1024 * 1024, // 1 GB
} as const;

// Per-image limits
const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3 MB
const MAX_IMAGES_PER_MESSAGE = 5;
const ALLOWED_MIME_TYPES = [
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
 * Get user's storage usage and limits.
 */
export const getUserStorageUsage = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    const limit = STORAGE_LIMITS[user.subscriptionTier];
    const used = user.storageTotalBytes ?? 0;

    return {
      used,
      limit,
      imageCount: user.storageImageCount ?? 0,
      percentUsed: Math.round((used / limit) * 100),
    };
  },
});

/**
 * Generate an upload URL for a new image.
 * Validates storage limits before allowing upload.
 * Note: This is an optimistic check - final quota enforcement happens in saveImage.
 */
export const generateUploadUrl = mutation({
  args: {
    fileSize: v.number(),
    mimeType: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);

    // Validate file size
    if (args.fileSize > MAX_FILE_SIZE) {
      throw new Error(
        `File size exceeds maximum of ${MAX_FILE_SIZE / (1024 * 1024)}MB`
      );
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(args.mimeType)) {
      throw new Error(
        `Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}`
      );
    }

    // Optimistic storage quota check
    const currentUsage = user.storageTotalBytes ?? 0;
    const limit = STORAGE_LIMITS[user.subscriptionTier];

    if (currentUsage + args.fileSize > limit) {
      throw new Error(
        `Storage limit exceeded. You have ${Math.round((limit - currentUsage) / (1024 * 1024))}MB remaining. Upgrade your plan for more storage.`
      );
    }

    // Generate upload URL
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Save an uploaded image and update storage usage.
 * Performs authoritative quota enforcement to handle race conditions.
 * Returns the storage ID for the image, or throws if quota exceeded.
 */
export const saveImage = mutation({
  args: {
    storageId: v.id("_storage"),
    fileSize: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);

    // Re-read user for authoritative quota check (handles race conditions)
    const freshUser = await ctx.db.get(user._id);
    if (!freshUser) {
      // Delete the uploaded file since user no longer exists
      await ctx.storage.delete(args.storageId);
      throw new Error("User not found");
    }

    const currentUsage = freshUser.storageTotalBytes ?? 0;
    const limit = STORAGE_LIMITS[freshUser.subscriptionTier];

    // Authoritative quota enforcement
    if (currentUsage + args.fileSize > limit) {
      // Delete the uploaded file to free storage
      await ctx.storage.delete(args.storageId);
      throw new Error(
        `Storage limit exceeded. You have ${Math.round((limit - currentUsage) / (1024 * 1024))}MB remaining. Upgrade your plan for more storage.`
      );
    }

    // Update user storage usage atomically
    await ctx.db.patch(user._id, {
      storageTotalBytes: currentUsage + args.fileSize,
      storageImageCount: (freshUser.storageImageCount ?? 0) + 1,
      updatedAt: Date.now(),
    });

    return args.storageId;
  },
});

/**
 * Delete an image and update storage usage.
 */
export const deleteImage = mutation({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);

    // Get file metadata to know the size
    const metadata = await ctx.storage.getMetadata(args.storageId);
    if (!metadata) {
      // File already deleted or doesn't exist
      return;
    }

    // Delete the file from storage
    await ctx.storage.delete(args.storageId);

    // Update user storage usage
    await ctx.db.patch(user._id, {
      storageTotalBytes: Math.max(0, (user.storageTotalBytes ?? 0) - metadata.size),
      storageImageCount: Math.max(0, (user.storageImageCount ?? 0) - 1),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Delete multiple images (for batch cleanup).
 */
export const deleteImages = mutation({
  args: {
    storageIds: v.array(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);

    let totalSize = 0;
    let deletedCount = 0;

    for (const storageId of args.storageIds) {
      const metadata = await ctx.storage.getMetadata(storageId);
      if (metadata) {
        totalSize += metadata.size;
        deletedCount++;
        await ctx.storage.delete(storageId);
      }
    }

    if (deletedCount > 0) {
      await ctx.db.patch(user._id, {
        storageTotalBytes: Math.max(0, (user.storageTotalBytes ?? 0) - totalSize),
        storageImageCount: Math.max(0, (user.storageImageCount ?? 0) - deletedCount),
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Get a URL for an image.
 */
export const getImageUrl = query({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

/**
 * Get URLs for multiple images.
 */
export const getImageUrls = query({
  args: {
    storageIds: v.array(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const urls: (string | null)[] = [];
    for (const storageId of args.storageIds) {
      urls.push(await ctx.storage.getUrl(storageId));
    }
    return urls;
  },
});

// Export constants for use in frontend validation
export const IMAGE_LIMITS = {
  maxFileSize: MAX_FILE_SIZE,
  maxImagesPerMessage: MAX_IMAGES_PER_MESSAGE,
  allowedMimeTypes: ALLOWED_MIME_TYPES,
  storageLimits: STORAGE_LIMITS,
};
