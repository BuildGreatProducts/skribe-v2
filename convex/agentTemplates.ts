import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";

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

// Get all templates for the current user
export const getByUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return [];
    }

    return await ctx.db
      .query("agentTemplates")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});

// Get a single template by ID (with ownership check)
export const getById = query({
  args: { templateId: v.id("agentTemplates") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    const template = await ctx.db.get(args.templateId);
    if (!template || template.userId !== user._id) {
      return null;
    }

    return template;
  },
});

// Create a new template
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    systemPrompt: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);

    const now = Date.now();

    const templateId = await ctx.db.insert("agentTemplates", {
      userId: user._id,
      name: args.name,
      description: args.description,
      systemPrompt: args.systemPrompt,
      createdAt: now,
      updatedAt: now,
    });

    return templateId;
  },
});

// Update a template
export const update = mutation({
  args: {
    templateId: v.id("agentTemplates"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);
    const { templateId, ...updates } = args;

    const template = await ctx.db.get(templateId);
    if (!template) {
      throw new Error("Template not found");
    }

    if (template.userId !== user._id) {
      throw new Error("Unauthorized: You do not own this template");
    }

    // Filter out undefined values
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    );

    await ctx.db.patch(templateId, {
      ...filteredUpdates,
      updatedAt: Date.now(),
    });
  },
});

// Delete a template
export const remove = mutation({
  args: { templateId: v.id("agentTemplates") },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);

    const template = await ctx.db.get(args.templateId);
    if (!template) {
      throw new Error("Template not found");
    }

    if (template.userId !== user._id) {
      throw new Error("Unauthorized: You do not own this template");
    }

    await ctx.db.delete(args.templateId);
  },
});
