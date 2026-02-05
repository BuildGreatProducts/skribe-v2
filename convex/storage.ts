import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

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
 * Get or create user storage record.
 */
async function getOrCreateUserStorage(ctx: MutationCtx, userId: Id<"users">) {
  const existing = await ctx.db
    .query("userStorage")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();

  if (existing) {
    return existing;
  }

  // Create new storage record
  const storageId = await ctx.db.insert("userStorage", {
    userId,
    totalBytes: 0,
    imageCount: 0,
    updatedAt: Date.now(),
  });

  return (await ctx.db.get(storageId))!;
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

    const storage = await ctx.db
      .query("userStorage")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    const limit = STORAGE_LIMITS[user.subscriptionTier];

    return {
      used: storage?.totalBytes ?? 0,
      limit,
      imageCount: storage?.imageCount ?? 0,
      percentUsed: storage ? Math.round((storage.totalBytes / limit) * 100) : 0,
    };
  },
});

/**
 * Generate an upload URL for a new image.
 * Validates storage limits before allowing upload.
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

    // Check storage quota
    const storage = await getOrCreateUserStorage(ctx, user._id);
    const limit = STORAGE_LIMITS[user.subscriptionTier];

    if (storage.totalBytes + args.fileSize > limit) {
      throw new Error(
        `Storage limit exceeded. You have ${Math.round((limit - storage.totalBytes) / (1024 * 1024))}MB remaining. Upgrade your plan for more storage.`
      );
    }

    // Generate upload URL
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Save an uploaded image and update storage usage.
 * Returns the storage ID for the image.
 */
export const saveImage = mutation({
  args: {
    storageId: v.id("_storage"),
    fileSize: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);

    // Update user storage usage
    const storage = await getOrCreateUserStorage(ctx, user._id);

    await ctx.db.patch(storage._id, {
      totalBytes: storage.totalBytes + args.fileSize,
      imageCount: storage.imageCount + 1,
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
    const storage = await getOrCreateUserStorage(ctx, user._id);

    await ctx.db.patch(storage._id, {
      totalBytes: Math.max(0, storage.totalBytes - metadata.size),
      imageCount: Math.max(0, storage.imageCount - 1),
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
      const storage = await getOrCreateUserStorage(ctx, user._id);

      await ctx.db.patch(storage._id, {
        totalBytes: Math.max(0, storage.totalBytes - totalSize),
        imageCount: Math.max(0, storage.imageCount - deletedCount),
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
