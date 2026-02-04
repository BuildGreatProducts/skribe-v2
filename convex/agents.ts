import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Agent types that match the schema
const agentTypes = v.union(
  v.literal("idea_refinement"),
  v.literal("market_validation"),
  v.literal("brand_strategy"),
  v.literal("customer_persona"),
  v.literal("business_model"),
  v.literal("new_features"),
  v.literal("tech_stack"),
  v.literal("create_prd"),
  v.literal("go_to_market"),
  v.literal("landing_page"),
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

// Get all agents for a project (with ownership check)
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
      .query("agents")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
  },
});

// Get a single agent by ID (with ownership check)
export const getById = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    const agent = await ctx.db.get(args.agentId);
    if (!agent) {
      return null;
    }

    // Verify project ownership
    const project = await ctx.db.get(agent.projectId);
    if (!project || project.userId !== user._id) {
      return null;
    }

    return agent;
  },
});

// Get agent with its messages (with ownership check)
export const getWithMessages = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    const agent = await ctx.db.get(args.agentId);
    if (!agent) {
      return null;
    }

    // Verify project ownership
    const project = await ctx.db.get(agent.projectId);
    if (!project || project.userId !== user._id) {
      return null;
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .order("asc")
      .collect();

    return { ...agent, messages };
  },
});

// Create a new agent
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    type: agentTypes,
    title: v.string(),
    systemPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);

    // Verify project ownership
    await verifyProjectOwnership(ctx, args.projectId, user._id);

    const now = Date.now();

    const agentId = await ctx.db.insert("agents", {
      projectId: args.projectId,
      type: args.type,
      title: args.title,
      systemPrompt: args.systemPrompt,
      createdAt: now,
      updatedAt: now,
    });

    return agentId;
  },
});

// Update agent title or system prompt
export const update = mutation({
  args: {
    agentId: v.id("agents"),
    title: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);
    const { agentId, ...updates } = args;

    const agent = await ctx.db.get(agentId);
    if (!agent) {
      throw new Error("Agent not found");
    }

    // Verify project ownership
    await verifyProjectOwnership(ctx, agent.projectId, user._id);

    // Filter out undefined values
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    );

    await ctx.db.patch(agentId, {
      ...filteredUpdates,
      updatedAt: Date.now(),
    });
  },
});

// Get recent agents for a project (limited for sidebar) - with ownership check
export const getRecentByProject = query({
  args: {
    projectId: v.id("projects"),
    limit: v.optional(v.number()),
  },
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
      .query("agents")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .take(args.limit ?? 10);
  },
});

// Delete an agent and its messages
export const remove = mutation({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);

    const agent = await ctx.db.get(args.agentId);
    if (!agent) {
      throw new Error("Agent not found");
    }

    // Verify project ownership
    await verifyProjectOwnership(ctx, agent.projectId, user._id);

    // Delete all messages in the agent
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // Delete the agent
    await ctx.db.delete(args.agentId);
  },
});
