import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";

/**
 * Helper to get authenticated user from context.
 * Returns the user record or null if not authenticated.
 */
async function getAuthenticatedUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  // Look up user by Clerk ID
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();

  return user;
}

// Debug query to test if Clerk authentication is working with Convex
// Requires authentication and returns only non-sensitive info
export const debugAuth = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);

    if (!user) {
      return {
        authenticated: false,
        userId: null,
        timestamp: Date.now(),
      };
    }

    return {
      authenticated: true,
      userId: user._id,
      timestamp: Date.now(),
    };
  },
});

// Get user by Clerk ID
export const getByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
  },
});

// Get current user (for authenticated requests)
export const getCurrentUser = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    return user;
  },
});

// Create or update user on sign-in (upsert)
export const upsertUser = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    const now = Date.now();

    if (existingUser) {
      // Build update object only with explicitly provided fields
      // This prevents undefined values from overwriting existing data
      const updateData: Record<string, unknown> = {
        email: args.email,
        updatedAt: now,
      };

      // Only include name and imageUrl if they are explicitly provided
      if (args.name !== undefined) {
        updateData.name = args.name;
      }
      if (args.imageUrl !== undefined) {
        updateData.imageUrl = args.imageUrl;
      }

      await ctx.db.patch(existingUser._id, updateData);
      return existingUser._id;
    }

    // Create new user with 3-day trial
    const trialEndsAt = now + 3 * 24 * 60 * 60 * 1000; // 3 days from now

    const userId = await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      name: args.name,
      imageUrl: args.imageUrl,
      githubConnected: false,
      subscriptionTier: "free",
      subscriptionStatus: "trial",
      trialEndsAt,
      createdAt: now,
      updatedAt: now,
    });

    return userId;
  },
});

// Update GitHub connection status with encrypted token
export const updateGitHubConnection = mutation({
  args: {
    clerkId: v.string(),
    encryptedGitHubToken: v.string(),
    githubTokenIv: v.string(),
    githubUsername: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(user._id, {
      githubConnected: true,
      encryptedGitHubToken: args.encryptedGitHubToken,
      githubTokenIv: args.githubTokenIv,
      githubUsername: args.githubUsername,
      updatedAt: Date.now(),
    });
  },
});

// Disconnect GitHub
export const disconnectGitHub = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(user._id, {
      githubConnected: false,
      encryptedGitHubToken: undefined,
      githubTokenIv: undefined,
      githubUsername: undefined,
      updatedAt: Date.now(),
    });
  },
});

// Update subscription
export const updateSubscription = mutation({
  args: {
    clerkId: v.string(),
    subscriptionTier: v.union(
      v.literal("free"),
      v.literal("starter"),
      v.literal("pro")
    ),
    subscriptionStatus: v.union(
      v.literal("trial"),
      v.literal("active"),
      v.literal("cancelled"),
      v.literal("expired")
    ),
    subscriptionEndsAt: v.optional(v.number()),
    polarCustomerId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Build update object only with explicitly provided fields
    const updateData: Record<string, unknown> = {
      subscriptionTier: args.subscriptionTier,
      subscriptionStatus: args.subscriptionStatus,
      updatedAt: Date.now(),
    };

    if (args.subscriptionEndsAt !== undefined) {
      updateData.subscriptionEndsAt = args.subscriptionEndsAt;
    }
    if (args.polarCustomerId !== undefined) {
      updateData.polarCustomerId = args.polarCustomerId;
    }

    await ctx.db.patch(user._id, updateData);
  },
});
