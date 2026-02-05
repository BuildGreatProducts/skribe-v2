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
 * Helper to verify agent ownership through project.
 * Returns the agent if authorized.
 */
async function verifyAgentOwnership(
  ctx: QueryCtx | MutationCtx,
  agentId: Id<"agents">,
  userId: Id<"users">
) {
  const agent = await ctx.db.get(agentId);
  if (!agent) {
    throw new Error("Agent not found");
  }

  const project = await ctx.db.get(agent.projectId);
  if (!project) {
    throw new Error("Project not found");
  }

  if (project.userId !== userId) {
    throw new Error("Unauthorized: You do not own this project");
  }

  return agent;
}

/**
 * Helper to verify message ownership through agent and project.
 * Returns the message and agent if authorized.
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

  const agent = await verifyAgentOwnership(ctx, message.agentId, userId);

  return { message, agent };
}

// Get all messages for an agent (with ownership check)
export const getByAgent = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return [];
    }

    // Verify agent ownership
    const agent = await ctx.db.get(args.agentId);
    if (!agent) {
      return [];
    }

    const project = await ctx.db.get(agent.projectId);
    if (!project || project.userId !== user._id) {
      return [];
    }

    return await ctx.db
      .query("messages")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
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

    // Verify ownership through agent and project
    const agent = await ctx.db.get(message.agentId);
    if (!agent) {
      return null;
    }

    const project = await ctx.db.get(agent.projectId);
    if (!project || project.userId !== user._id) {
      return null;
    }

    return message;
  },
});

// Create a new message
export const create = mutation({
  args: {
    agentId: v.id("agents"),
    role: messageRoles,
    content: v.string(),
    imageIds: v.optional(v.array(v.id("_storage"))),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);

    // Verify agent ownership
    await verifyAgentOwnership(ctx, args.agentId, user._id);

    const now = Date.now();

    // Create the message
    const messageId = await ctx.db.insert("messages", {
      agentId: args.agentId,
      role: args.role,
      content: args.content,
      imageIds: args.imageIds,
      createdAt: now,
    });

    // Update agent's updatedAt timestamp
    await ctx.db.patch(args.agentId, {
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

    // Update agent's updatedAt timestamp
    await ctx.db.patch(message.agentId, {
      updatedAt: Date.now(),
    });
  },
});

// Delete a message and its associated images
export const remove = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);

    // Verify message ownership
    const { message } = await verifyMessageOwnership(ctx, args.messageId, user._id);

    // Delete associated images and update storage usage
    if (message.imageIds && message.imageIds.length > 0) {
      let totalSize = 0;

      for (const storageId of message.imageIds) {
        const metadata = await ctx.storage.getMetadata(storageId);
        if (metadata) {
          totalSize += metadata.size;
          await ctx.storage.delete(storageId);
        }
      }

      // Update user storage usage
      if (totalSize > 0) {
        const storage = await ctx.db
          .query("userStorage")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .unique();

        if (storage) {
          await ctx.db.patch(storage._id, {
            totalBytes: Math.max(0, storage.totalBytes - totalSize),
            imageCount: Math.max(0, storage.imageCount - message.imageIds.length),
            updatedAt: Date.now(),
          });
        }
      }
    }

    await ctx.db.delete(args.messageId);
  },
});

// Batch create messages (for importing or initial setup)
export const batchCreate = mutation({
  args: {
    agentId: v.id("agents"),
    messages: v.array(
      v.object({
        role: messageRoles,
        content: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);

    // Verify agent ownership
    await verifyAgentOwnership(ctx, args.agentId, user._id);

    const now = Date.now();
    const messageIds = [];

    for (let i = 0; i < args.messages.length; i++) {
      const msg = args.messages[i];
      const messageId = await ctx.db.insert("messages", {
        agentId: args.agentId,
        role: msg.role,
        content: msg.content,
        createdAt: now + i, // Ensure ordering
      });
      messageIds.push(messageId);
    }

    // Update agent's updatedAt timestamp
    await ctx.db.patch(args.agentId, {
      updatedAt: now + args.messages.length,
    });

    return messageIds;
  },
});
