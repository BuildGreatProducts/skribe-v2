import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Message roles that match the schema
const messageRoles = v.union(
  v.literal("user"),
  v.literal("assistant"),
  v.literal("system")
);

// Get all messages for a chat
export const getByChat = query({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .order("asc")
      .collect();
  },
});

// Get a single message by ID
export const getById = query({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.messageId);
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
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

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
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

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
