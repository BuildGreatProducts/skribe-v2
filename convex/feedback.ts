import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

/**
 * Helper to get authenticated user from context.
 * Returns the user record or null if not authenticated.
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
 * Throws if not authenticated.
 */
async function requireAuthenticatedUser(ctx: QueryCtx | MutationCtx) {
  const user = await getAuthenticatedUser(ctx);
  if (!user) {
    throw new Error("Unauthorized: You must be logged in");
  }
  return user;
}

/**
 * Helper to verify project ownership
 */
async function verifyProjectOwnership(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projects">
) {
  const user = await requireAuthenticatedUser(ctx);
  const project = await ctx.db.get(projectId);

  if (!project) {
    throw new Error("Project not found");
  }

  if (project.userId !== user._id) {
    throw new Error("Unauthorized: You do not own this project");
  }

  return { user, project };
}

/**
 * Generate a cryptographically secure random API key
 */
function createRandomApiKey(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);

  let key = "fb_";
  for (let i = 0; i < 32; i++) {
    // Use modulo to map byte value to character index
    // This has minimal bias since 256 % 62 = 8 (small compared to 256)
    key += chars.charAt(randomBytes[i] % chars.length);
  }
  return key;
}

// Generate or regenerate the feedback API key for a project
export const generateApiKey = mutation({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    await verifyProjectOwnership(ctx, args.projectId);

    const apiKey = createRandomApiKey();

    await ctx.db.patch(args.projectId, {
      feedbackApiKey: apiKey,
    });

    return apiKey;
  },
});

// Get the feedback API key for a project
export const getApiKey = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const { project } = await verifyProjectOwnership(ctx, args.projectId);
    return project.feedbackApiKey || null;
  },
});

// Get project by API key (for public webhook endpoint - no auth required)
export const getProjectByApiKey = query({
  args: {
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db
      .query("projects")
      .withIndex("by_feedback_api_key", (q) => q.eq("feedbackApiKey", args.apiKey))
      .unique();

    if (!project) {
      return null;
    }

    // Return only the project ID for security
    return { projectId: project._id };
  },
});

// Create feedback entry (called by public webhook - validates API key)
export const create = mutation({
  args: {
    apiKey: v.string(),
    content: v.string(),
    email: v.optional(v.string()),
    metadata: v.optional(v.any()),
    source: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate API key and get project
    if (!args.apiKey || !args.apiKey.startsWith("fb_")) {
      throw new Error("Invalid API key format");
    }

    const project = await ctx.db
      .query("projects")
      .withIndex("by_feedback_api_key", (q) => q.eq("feedbackApiKey", args.apiKey))
      .unique();

    if (!project) {
      throw new Error("Invalid API key");
    }

    const feedbackId = await ctx.db.insert("feedback", {
      projectId: project._id,
      content: args.content,
      email: args.email,
      metadata: args.metadata,
      source: args.source,
      processed: false,
      createdAt: Date.now(),
    });

    return feedbackId;
  },
});

// List all feedback for a project (authenticated)
export const listByProject = query({
  args: {
    projectId: v.id("projects"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await verifyProjectOwnership(ctx, args.projectId);

    const limit = args.limit || 100;

    const feedback = await ctx.db
      .query("feedback")
      .withIndex("by_project_and_date", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .take(limit);

    return feedback;
  },
});

// Get feedback count for a project
export const getCountByProject = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    await verifyProjectOwnership(ctx, args.projectId);

    const feedback = await ctx.db
      .query("feedback")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    return feedback.length;
  },
});

// Delete a feedback entry
export const remove = mutation({
  args: {
    feedbackId: v.id("feedback"),
  },
  handler: async (ctx, args) => {
    const feedback = await ctx.db.get(args.feedbackId);
    if (!feedback) {
      throw new Error("Feedback not found");
    }

    // Verify project ownership
    await verifyProjectOwnership(ctx, feedback.projectId);

    await ctx.db.delete(args.feedbackId);
  },
});

// Update feedback category/sentiment (for future AI processing)
export const updateProcessing = mutation({
  args: {
    feedbackId: v.id("feedback"),
    category: v.optional(v.string()),
    sentiment: v.optional(v.string()),
    processed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const feedback = await ctx.db.get(args.feedbackId);
    if (!feedback) {
      throw new Error("Feedback not found");
    }

    // Verify project ownership
    await verifyProjectOwnership(ctx, feedback.projectId);

    const updates: {
      category?: string;
      sentiment?: string;
      processed?: boolean;
    } = {};
    if (args.category !== undefined) updates.category = args.category;
    if (args.sentiment !== undefined) updates.sentiment = args.sentiment;
    if (args.processed !== undefined) updates.processed = args.processed;

    await ctx.db.patch(args.feedbackId, updates);
  },
});
