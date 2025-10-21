// backend/convex/users.ts (New file, or put this in auth.ts if you prefer)
import { internalQuery, QueryCtx } from "./_generated/server";
import { v } from "convex/values";

// Internal Query to securely read the user record
export const getUserByEmailInternal = internalQuery({
    args: { email: v.string() },
    handler: async (ctx: QueryCtx, { email }: { email: string }) => {
        return await ctx.db
            .query("users")
            .withIndex("by_email", (q: any) => q.eq("email", email))
            .unique();
    },
});