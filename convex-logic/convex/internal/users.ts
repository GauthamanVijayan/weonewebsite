// backend/convex/internal/users.ts

import { internalMutation, MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import type { TableNames } from "../_generated/dataModel";

// This type mirrors the data created by the Admin Action
type AdminInsertArgs = {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: string;
};

export const insertAdminRecord = internalMutation({
  args: {
    email: v.string(),
    passwordHash: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    role: v.string(),
  },
  // This uses MutationCtx and is allowed to access ctx.db
  handler: async (ctx: MutationCtx, args: AdminInsertArgs) => {
    // 1. Check if the user already exists (prevent duplicates)
    // Note: We intentionally simplify the check here, assuming the Action did the heavy lifting.
    const existingUser = await (ctx.db.query("users" as TableNames) as any) // 🎯 FIX: Assert Query return type
      .withIndex("by_email", (q: any) => q.eq(q.field("email"), args.email))
      .first();

    if (existingUser) {
      throw new Error("User already exists."); // Should not happen if Action checked properly
    }

    // 2. Insert the user using the pre-hashed password
    const userId = await (ctx.db.insert as any)("users", {
      ...args,
    });

    return userId;
  },
});
