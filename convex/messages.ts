import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Message roles that match the schema
const messageRoles = v.union(
  v.literal("user"),
  v.literal("assistant"),
  v.literal("system")
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
 * Helper to verify chat ownership through project.
 * Returns the chat if authorized.
 */
async function verifyChatOwnership(
  ctx: QueryCtx | MutationCtx,
  chatId: Id<"chats">,
  userId: Id<"users">
) {
  const chat = await ctx.db.get(chatId);
  if (!chat) {
    throw new Error("Chat not found");
  }

  const project = await ctx.db.get(chat.projectId);
  if (!project) {
    throw new Error("Project not found");
  }

  if (project.userId !== userId) {
    throw new Error("Unauthorized: You do not own this project");
  }

  return chat;
}

/**
 * Helper to verify message ownership through chat and project.
 * Returns the message and chat if authorized.
 */
async function verifyMessageOwnership(
  ctx: QueryCtx | MutationCtx,
  messageId: Id<"messages">,
  userId: Id<"users">
) {
  const message = await ctx.db.get(messageId);
  if (!message) {
    throw new Error("Message not found");
  }

  const chat = await verifyChatOwnership(ctx, message.chatId, userId);

  return { message, chat };
}

// Get all messages for a chat (with ownership check)
export const getByChat = query({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return [];
    }

    // Verify chat ownership
    const chat = await ctx.db.get(args.chatId);
    if (!chat) {
      return [];
    }

    const project = await ctx.db.get(chat.projectId);
    if (!project || project.userId !== user._id) {
      return [];
    }

    return await ctx.db
      .query("messages")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .order("asc")
      .collect();
  },
});

// Get a single message by ID (with ownership check)
export const getById = query({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    const message = await ctx.db.get(args.messageId);
    if (!message) {
      return null;
    }

    // Verify ownership through chat and project
    const chat = await ctx.db.get(message.chatId);
    if (!chat) {
      return null;
    }

    const project = await ctx.db.get(chat.projectId);
    if (!project || project.userId !== user._id) {
      return null;
    }

    return message;
  },
});

// Create a new message
export const create = mutation({
  args: {
    chatId: v.id("chats"),
    role: messageRoles,
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);

    // Verify chat ownership
    await verifyChatOwnership(ctx, args.chatId, user._id);

    const now = Date.now();

    // Create the message
    const messageId = await ctx.db.insert("messages", {
      chatId: args.chatId,
      role: args.role,
      content: args.content,
      createdAt: now,
    });

    // Update chat's updatedAt timestamp
    await ctx.db.patch(args.chatId, {
      updatedAt: now,
    });

    return messageId;
  },
});

// Update a message content (for streaming updates)
export const update = mutation({
  args: {
    messageId: v.id("messages"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);

    // Verify message ownership
    const { message } = await verifyMessageOwnership(ctx, args.messageId, user._id);

    await ctx.db.patch(args.messageId, {
      content: args.content,
    });

    // Update chat's updatedAt timestamp
    await ctx.db.patch(message.chatId, {
      updatedAt: Date.now(),
    });
  },
});

// Delete a message
export const remove = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);

    // Verify message ownership
    await verifyMessageOwnership(ctx, args.messageId, user._id);

    await ctx.db.delete(args.messageId);
  },
});

// Batch create messages (for importing or initial setup)
export const batchCreate = mutation({
  args: {
    chatId: v.id("chats"),
    messages: v.array(
      v.object({
        role: messageRoles,
        content: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);

    // Verify chat ownership
    await verifyChatOwnership(ctx, args.chatId, user._id);

    const now = Date.now();
    const messageIds = [];

    for (let i = 0; i < args.messages.length; i++) {
      const msg = args.messages[i];
      const messageId = await ctx.db.insert("messages", {
        chatId: args.chatId,
        role: msg.role,
        content: msg.content,
        createdAt: now + i, // Ensure ordering
      });
      messageIds.push(messageId);
    }

    // Update chat's updatedAt timestamp
    await ctx.db.patch(args.chatId, {
      updatedAt: now + args.messages.length,
    });

    return messageIds;
  },
});
