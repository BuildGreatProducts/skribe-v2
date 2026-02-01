import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Get all projects for a user
export const getByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

// Get a single project by ID
export const getById = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.projectId);
  },
});

// Get project count for a user (for subscription limits)
export const getCountByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    return projects.length;
  },
});

// Create a new project
export const create = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    githubRepoId: v.optional(v.string()),
    githubRepoName: v.optional(v.string()),
    githubRepoUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const projectId = await ctx.db.insert("projects", {
      userId: args.userId,
      name: args.name,
      description: args.description,
      githubRepoId: args.githubRepoId,
      githubRepoName: args.githubRepoName,
      githubRepoUrl: args.githubRepoUrl,
      createdAt: now,
      updatedAt: now,
    });

    return projectId;
  },
});

// Update a project
export const update = mutation({
  args: {
    projectId: v.id("projects"),
    userId: v.id("users"), // Required for ownership verification
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    githubRepoId: v.optional(v.string()),
    githubRepoName: v.optional(v.string()),
    githubRepoUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { projectId, userId, ...updates } = args;

    // Verify project exists
    const project = await ctx.db.get(projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    // Verify ownership
    if (project.userId !== userId) {
      throw new Error("Unauthorized: You do not own this project");
    }

    // Filter out undefined values
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    );

    await ctx.db.patch(projectId, {
      ...filteredUpdates,
      updatedAt: Date.now(),
    });
  },
});

// Helper to batch delete items
async function batchDelete(
  ctx: { db: { delete: (id: Id<"documents"> | Id<"chats"> | Id<"messages">) => Promise<void> } },
  items: Array<{ _id: Id<"documents"> | Id<"chats"> | Id<"messages"> }>,
  batchSize: number = 50
) {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map((item) => ctx.db.delete(item._id)));
  }
}

// Delete a project and all its associated data
export const remove = mutation({
  args: {
    projectId: v.id("projects"),
    userId: v.id("users"), // Required for ownership verification
  },
  handler: async (ctx, args) => {
    // Verify project exists
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    // Verify ownership
    if (project.userId !== args.userId) {
      throw new Error("Unauthorized: You do not own this project");
    }

    // Collect all documents for this project
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Collect all chats for this project
    const chats = await ctx.db
      .query("chats")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Collect all messages for all chats
    const allMessages = await Promise.all(
      chats.map((chat) =>
        ctx.db
          .query("messages")
          .withIndex("by_chat", (q) => q.eq("chatId", chat._id))
          .collect()
      )
    );
    const messages = allMessages.flat();

    // Batch delete messages first (most numerous)
    await batchDelete(ctx, messages);

    // Batch delete chats
    await batchDelete(ctx, chats);

    // Batch delete documents
    await batchDelete(ctx, documents);

    // Delete the project itself
    await ctx.db.delete(args.projectId);
  },
});
