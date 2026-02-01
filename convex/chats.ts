import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Chat types that match the schema
const chatTypes = v.union(
  v.literal("product_refinement"),
  v.literal("market_validation"),
  v.literal("brand_strategy"),
  v.literal("customer_persona"),
  v.literal("business_model"),
  v.literal("new_features"),
  v.literal("tech_stack"),
  v.literal("create_prd"),
  v.literal("go_to_market"),
  v.literal("custom")
);

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
 * Helper to verify project ownership.
 */
async function verifyProjectOwnership(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projects">,
  userId: Id<"users">
) {
  const project = await ctx.db.get(projectId);
  if (!project) {
    throw new Error("Project not found");
  }
  if (project.userId !== userId) {
    throw new Error("Unauthorized: You do not own this project");
  }
  return project;
}

// Get all chats for a project (with ownership check)
export const getByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return [];
    }

    // Verify project ownership
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      return [];
    }

    return await ctx.db
      .query("chats")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
  },
});

// Get a single chat by ID (with ownership check)
export const getById = query({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    const chat = await ctx.db.get(args.chatId);
    if (!chat) {
      return null;
    }

    // Verify project ownership
    const project = await ctx.db.get(chat.projectId);
    if (!project || project.userId !== user._id) {
      return null;
    }

    return chat;
  },
});

// Get chat with its messages (with ownership check)
export const getWithMessages = query({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    const chat = await ctx.db.get(args.chatId);
    if (!chat) {
      return null;
    }

    // Verify project ownership
    const project = await ctx.db.get(chat.projectId);
    if (!project || project.userId !== user._id) {
      return null;
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .order("asc")
      .collect();

    return { ...chat, messages };
  },
});

// Create a new chat
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    type: chatTypes,
    title: v.string(),
    systemPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);

    // Verify project ownership
    await verifyProjectOwnership(ctx, args.projectId, user._id);

    const now = Date.now();

    const chatId = await ctx.db.insert("chats", {
      projectId: args.projectId,
      type: args.type,
      title: args.title,
      systemPrompt: args.systemPrompt,
      createdAt: now,
      updatedAt: now,
    });

    return chatId;
  },
});

// Update chat title or system prompt
export const update = mutation({
  args: {
    chatId: v.id("chats"),
    title: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);
    const { chatId, ...updates } = args;

    const chat = await ctx.db.get(chatId);
    if (!chat) {
      throw new Error("Chat not found");
    }

    // Verify project ownership
    await verifyProjectOwnership(ctx, chat.projectId, user._id);

    // Filter out undefined values
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    );

    await ctx.db.patch(chatId, {
      ...filteredUpdates,
      updatedAt: Date.now(),
    });
  },
});

// Delete a chat and its messages
export const remove = mutation({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);

    const chat = await ctx.db.get(args.chatId);
    if (!chat) {
      throw new Error("Chat not found");
    }

    // Verify project ownership
    await verifyProjectOwnership(ctx, chat.projectId, user._id);

    // Delete all messages in the chat
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // Delete the chat
    await ctx.db.delete(args.chatId);
  },
});
