import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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

// Get all chats for a project
export const getByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chats")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
  },
});

// Get a single chat by ID
export const getById = query({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.chatId);
  },
});

// Get chat with its messages
export const getWithMessages = query({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    const chat = await ctx.db.get(args.chatId);
    if (!chat) return null;

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
    const { chatId, ...updates } = args;

    const chat = await ctx.db.get(chatId);
    if (!chat) {
      throw new Error("Chat not found");
    }

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
    const chat = await ctx.db.get(args.chatId);
    if (!chat) {
      throw new Error("Chat not found");
    }

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
