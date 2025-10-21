// backend/convex/auth.ts

"use node";

import {
  internalMutation,
  mutation,
  ActionCtx,
  internalAction,
  action,
} from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import bcrypt from "bcryptjs";
import { internal } from "./_generated/api";

interface UserDocument {
  _id: Id<"users">;
  authId: string;
  passwordHash: string;
  firstName: string; // Needed for return
  // Include other necessary fields from your schema
  [key: string]: any;
}
interface LoginResult {
  userId: Id<"users">;
  authId: string;
  firstName: string;
  email: string;
}

// --- Internal Mutation: Insert/Create User Record ---

// --- Internal Action: Securely Verify Password (Called by login) ---
export const _verifyPasswordInternal = internalAction({
  args: { password: v.string(), hash: v.string() },
  handler: async (
    ctx: ActionCtx,
    { password, hash }: { password: string; hash: string }
  ) => {
    // Uses the bcrypt Node package
    return bcrypt.compare(password, hash);
  },
});

// --- Public Action: Login (Orchestrates the login flow) ---
// This function needs to be imported by the frontend and is responsible for running the internal check.
export const login = action({
  args: { email: v.string(), password: v.string() },
  handler: async (
    ctx: ActionCtx,
    { email, password }: { email: string; password: string }
  ): Promise<LoginResult> => {
    // 1. Fetch user (Must use internal query from users.ts)
    const user = (await ctx.runQuery(internal.users.getUserByEmailInternal, {
      email,
    })) as UserDocument | null;
    if (!user) {
      throw new Error("Invalid email .");
    }

    // 2. Verify password (Action calling internal Action)
    const passwordMatch = await ctx.runAction(
      internal.auth._verifyPasswordInternal,
      {
        password,
        hash: user.passwordHash,
      }
    );

    if (!passwordMatch) {
      throw new Error("Invalid  password.");
    }

    // 3. Login is successful.
    return {
      userId: user._id,
      authId: user.authId,
      firstName: user['firstName'],
      ["email"]: user['email'], // ✅ Add email
    };
  },
});
