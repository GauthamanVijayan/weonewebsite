// backend/convex/admin.ts

"use node";

import { action, ActionCtx } from "./_generated/server"; // 🎯 Change to 'action' and 'ActionCtx'
import { v } from "convex/values";
import { internal } from "./_generated/api"; // To call the internal mutation
import bcrypt from "bcryptjs";
import type { TableNames } from "./_generated/dataModel"; // 👈 CRITICAL IMPORT
import { Id } from "./_generated/dataModel";
// --- Type Definitions (Keep these) ---
type CreateUserArgs = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
};

// 🎯 The secure function to create the initial manager account
export const createAdminUser = action({
  // 🎯 FIX 1: Defined as an ACTION
  args: {
    email: v.string(),
    password: v.string(),
    firstName: v.string(),
    lastName: v.string(),
  },
  // 🎯 FIX 2: Use ActionCtx, which is valid for Node.js
  handler: async (
    ctx: ActionCtx,
    { email, password, firstName, lastName }: CreateUserArgs // 👈 FIXES 'Cannot find name' errors
  ): Promise<Id<any>> => {
    // --- 1. NON-DB LOGIC (Hashing) ---
    // This is safe to run in the Node.js environment.
    const passwordHash = await bcrypt.hash(password, 10);

    // --- 2. DB LOGIC (Delegation) ---
    // 🎯 FIX 3: Call the internal mutation to perform the secure database write
    const userId = await ctx.runMutation(internal.users.insertAdminRecord, {
      email: email,
      passwordHash: passwordHash,
      firstName: firstName,
      lastName: lastName,
      role: "admin",
    });

    return userId as Id<"users">;;
  },
});
