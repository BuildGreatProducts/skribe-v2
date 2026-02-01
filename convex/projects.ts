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

  // Look up user by Clerk ID
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

// Get all projects for the authenticated user
export const getByUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return [];
    }

    return await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});

// Get a single project by ID (with ownership check)
export const getById = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      return null;
    }

    // Verify ownership
    if (project.userId !== user._id) {
      return null;
    }

    return project;
  },
});

// Get project count for the authenticated user (for subscription limits)
export const getCountByUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return 0;
    }

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    return projects.length;
  },
});

// Check if user can create a new project based on subscription tier
export const canCreateProject = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return { allowed: false, reason: "not_authenticated" };
    }

    // Check if trial expired and no active subscription
    const now = Date.now();
    const isTrialExpired =
      user.subscriptionStatus === "trial" &&
      user.trialEndsAt &&
      now > user.trialEndsAt;

    if (isTrialExpired && user.subscriptionTier === "free") {
      return { allowed: false, reason: "trial_expired" };
    }

    // Check subscription status
    if (user.subscriptionStatus === "expired") {
      return { allowed: false, reason: "subscription_expired" };
    }

    // Pro users have unlimited projects
    if (user.subscriptionTier === "pro") {
      return { allowed: true, reason: "pro_unlimited" };
    }

    // Starter and free (trial) users limited to 1 project
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    if (projects.length >= 1) {
      return {
        allowed: false,
        reason: "project_limit_reached",
        currentCount: projects.length,
        limit: 1,
      };
    }

    return { allowed: true, reason: "within_limit" };
  },
});

// Create a new project
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    githubRepoId: v.optional(v.string()),
    githubRepoName: v.optional(v.string()),
    githubRepoUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);
    const now = Date.now();

    // Check subscription limits
    const isTrialExpired =
      user.subscriptionStatus === "trial" &&
      user.trialEndsAt &&
      now > user.trialEndsAt;

    if (isTrialExpired && user.subscriptionTier === "free") {
      throw new Error("Your trial has expired. Please subscribe to create projects.");
    }

    if (user.subscriptionStatus === "expired") {
      throw new Error("Your subscription has expired. Please resubscribe to create projects.");
    }

    // Pro users have unlimited projects
    if (user.subscriptionTier !== "pro") {
      // Starter and free (trial) users limited to 1 project
      const existingProjects = await ctx.db
        .query("projects")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();

      if (existingProjects.length >= 1) {
        throw new Error("Project limit reached. Upgrade to Pro for unlimited projects.");
      }
    }

    const projectId = await ctx.db.insert("projects", {
      userId: user._id,
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
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    githubRepoId: v.optional(v.string()),
    githubRepoName: v.optional(v.string()),
    githubRepoUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);
    const { projectId, ...updates } = args;

    // Verify project exists
    const project = await ctx.db.get(projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    // Verify ownership
    if (project.userId !== user._id) {
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

// Delete multiple projects for downgrade (keeps one project)
export const deleteForDowngrade = mutation({
  args: {
    projectIdsToDelete: v.array(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);

    // Verify all projects belong to this user before deleting
    for (const projectId of args.projectIdsToDelete) {
      const project = await ctx.db.get(projectId);
      if (!project) {
        throw new Error(`Project ${projectId} not found`);
      }
      if (project.userId !== user._id) {
        throw new Error("Unauthorized: You do not own this project");
      }
    }

    // Delete each project and its associated data
    for (const projectId of args.projectIdsToDelete) {
      // Collect all documents for this project
      const documents = await ctx.db
        .query("documents")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .collect();

      // Collect all chats for this project
      const chats = await ctx.db
        .query("chats")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
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

      // Batch delete messages first
      await batchDelete(ctx, messages);

      // Batch delete chats
      await batchDelete(ctx, chats);

      // Batch delete documents
      await batchDelete(ctx, documents);

      // Delete the project itself
      await ctx.db.delete(projectId);
    }

    return { deletedCount: args.projectIdsToDelete.length };
  },
});

// Delete a project and all its associated data
export const remove = mutation({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);

    // Verify project exists
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    // Verify ownership
    if (project.userId !== user._id) {
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
