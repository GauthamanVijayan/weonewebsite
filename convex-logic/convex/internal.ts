// backend/convex/internal.ts (New File)

import { internalMutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";

// This mutation runs in the standard (non-Node) environment and is safe for DB writes.
export const _insertUserRecordDB = internalMutation({
  args: {
    email: v.string(),
    passwordHash: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    role: v.union(v.literal("admin"), v.literal("sponsor")),
  },
  handler: async (ctx: MutationCtx, args) => {
    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", q => q.eq("email", args.email))
      .unique();
      
    if (existingUser) {
        throw new Error("User already exists.");
    }

    return await ctx.db.insert("users", {
        ...args,
        authId: 'manual:' + args.email, // Assign a fixed, predictable authId
    });
  },
});