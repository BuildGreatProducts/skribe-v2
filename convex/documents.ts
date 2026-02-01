import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Document types that match the schema
const documentTypes = v.union(
  v.literal("prd"),
  v.literal("persona"),
  v.literal("market"),
  v.literal("brand"),
  v.literal("business"),
  v.literal("feature"),
  v.literal("tech"),
  v.literal("gtm"),
  v.literal("custom")
);

const syncStatuses = v.union(
  v.literal("synced"),
  v.literal("pending"),
  v.literal("error")
);

// Get all documents for a project
export const getByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("documents")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
  },
});

// Get a single document by ID
export const getById = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.documentId);
  },
});

// Get documents by type for a project
export const getByType = query({
  args: {
    projectId: v.id("projects"),
    type: documentTypes,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("documents")
      .withIndex("by_type", (q) =>
        q.eq("projectId", args.projectId).eq("type", args.type)
      )
      .collect();
  },
});

// Create a new document
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    content: v.string(),
    type: documentTypes,
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const documentId = await ctx.db.insert("documents", {
      projectId: args.projectId,
      title: args.title,
      content: args.content,
      type: args.type,
      syncStatus: "pending",
      createdAt: now,
      updatedAt: now,
    });

    return documentId;
  },
});

// Update a document
export const update = mutation({
  args: {
    documentId: v.id("documents"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    type: v.optional(documentTypes),
  },
  handler: async (ctx, args) => {
    const { documentId, ...updates } = args;

    const doc = await ctx.db.get(documentId);
    if (!doc) {
      throw new Error("Document not found");
    }

    // Filter out undefined values
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    );

    // If content changed, mark as pending sync
    const shouldUpdateSyncStatus =
      updates.content !== undefined && updates.content !== doc.content;

    await ctx.db.patch(documentId, {
      ...filteredUpdates,
      ...(shouldUpdateSyncStatus ? { syncStatus: "pending" as const } : {}),
      updatedAt: Date.now(),
    });
  },
});

// Update sync status
export const updateSyncStatus = mutation({
  args: {
    documentId: v.id("documents"),
    syncStatus: syncStatuses,
    lastSyncedHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) {
      throw new Error("Document not found");
    }

    await ctx.db.patch(args.documentId, {
      syncStatus: args.syncStatus,
      lastSyncedHash: args.lastSyncedHash,
      lastSyncedAt: args.syncStatus === "synced" ? Date.now() : doc.lastSyncedAt,
      updatedAt: Date.now(),
    });
  },
});

// Delete a document
export const remove = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) {
      throw new Error("Document not found");
    }

    await ctx.db.delete(args.documentId);
  },
});

// Get all documents for a project formatted for AI context
export const getContextForProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Format documents for context injection
    return documents.map((doc) => ({
      title: doc.title,
      type: doc.type,
      content: doc.content,
      updatedAt: doc.updatedAt,
    }));
  },
});
