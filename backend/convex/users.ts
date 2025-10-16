// in backend/convex/users.ts

// 🎯 FIX 1: Change clerkClient function import to ClerkClient class import.
import { mutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { ClerkClient,ClerkOptions } from "@clerk/backend";// --- Type Definitions for Strict Mode Fixes ---
import ClerkBackendModule from "@clerk/backend"; 
import { createClerkClient } from "@clerk/backend";

type CreateUserArgs = {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
}


const clientOptions: ClerkOptions = { secretKey: process.env['CLERK_SECRET_KEY']! };
const clerk: ClerkClient = createClerkClient(clientOptions); // 👈 CORRECT FACTORY CALL

export const createUser = mutation({
    args: {
        email: v.string(),
        password: v.string(),
        firstName: v.string(),
        lastName: v.string(),
    },
    // 🎯 FIX 3: Explicitly type ctx as MutationCtx and args using CreateUserArgs.
    handler: async (ctx: MutationCtx, { email, password, firstName, lastName }: CreateUserArgs) => {
        // --- IMPORTANT: Add admin-only security check here ---
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("You must be logged in to create a user.");
        }
        // Example: if (identity.email !== "your-admin-email@example.com") { ... }
        
        // Use the Clerk SDK to create a new user
        const user = await clerk.users.createUser({
            emailAddress: [email],
            password: password,
            firstName: firstName,
            lastName: lastName,
        });

        return user.id;
    },
});

// NOTE: If you are going to call the Clerk client from other Convex files, 
// you will need to add the "@clerk/backend" module to your frontend's 
// declaration shims (convex-values.d.ts) to prevent a new TS2307 error.