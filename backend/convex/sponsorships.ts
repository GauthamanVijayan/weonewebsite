// in backend/convex/sponsorships.ts

// NOTE: Ensure your global file (or the necessary type file) exports QueryCtx, MutationCtx, Id, and the internal module export helpers.
import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// --- Type Definitions for Strict Mode Fixes ---

// Define the shape of a Cart Item used in the mutation args
type CartItem = {
    ward: { _id: Id<"wards"> };
    // Include any other required fields for a cart item object
    [key: string]: any; 
};

// Define the argument type for createSponsorship
type CreateSponsorshipArgs = {
    sponsorName: string;
    sponsorEmail: string;
    totalAmount: number;
    cart: CartItem[];
};

// --- END Type Definitions ---

/**
 * Creates a new sponsorship record with a "pending" status.
 * This is called when the user clicks "Proceed to Payment".
 */
export const createSponsorship = mutation({
  args: {
    sponsorName: v.string(),
    sponsorEmail: v.string(),
    totalAmount: v.number(),
    cart: v.array(v.any()), // The cart items from the frontend
  },
  // 🎯 FIX: Explicitly type ctx as MutationCtx and args using CreateSponsorshipArgs
  handler: async (ctx: MutationCtx, args: CreateSponsorshipArgs): Promise<Id<"sponsorships">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("You must be logged in to create a sponsorship.");
    }
    
    const sponsorshipId = await ctx.db.insert("sponsorships", {
      ...args,
      status: "pending",
      userId: identity.subject, // Link the sponsorship to the logged-in user
    });
    
    return sponsorshipId;
  },
});

/**
 * Activates a sponsorship and "locks" the corresponding wards.
 */
export const processSponsorship = mutation({
  args: { sponsorshipId: v.id("sponsorships") },
  // 🎯 FIX: Explicitly type ctx as MutationCtx and the destructured argument
  handler: async (ctx: MutationCtx, { sponsorshipId }: { sponsorshipId: Id<"sponsorships"> }) => {
    // 🎯 FIX: Type the fetched sponsorship record
    const sponsorship = await ctx.db.get(sponsorshipId) as (CreateSponsorshipArgs & { userId: string; cart: CartItem[]; }) | null;
    
    if (!sponsorship) {
      throw new Error("Sponsorship not found");
    }

    const now = Date.now();
    const endDate = now + 30 * 24 * 60 * 60 * 1000; 

    // 1. Update the sponsorship record to "active"
    await ctx.db.patch(sponsorshipId, {
      status: "active",
      startDate: now,
      endDate: endDate,
    });

    // 2. Lock each ward that was part of this sponsorship
    for (const item of sponsorship.cart) { // sponsorship.cart is now typed as CartItem[]
      // The ward ID is stored in the cart item
      const wardId = item.ward._id as Id<"wards">; // item.ward is now typed
      await ctx.db.patch(wardId, {
        isSponsored: true,
        sponsoredUntil: endDate,
      });
    }

    return { success: true };
  },
});

/**
 * Allows a user to cancel their own active sponsorship, releasing the lock on the wards.
 */
export const cancelSponsorship = mutation({
  args: { sponsorshipId: v.id("sponsorships") },
  // 🎯 FIX: Explicitly type ctx as MutationCtx and the destructured argument
  handler: async (ctx: MutationCtx, { sponsorshipId }: { sponsorshipId: Id<"sponsorships"> }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("You must be logged in to cancel a sponsorship.");
    }

    // 🎯 FIX: Type the fetched sponsorship record
    const sponsorship = await ctx.db.get(sponsorshipId) as (CreateSponsorshipArgs & { userId: string; cart: CartItem[]; }) | null;

    if (!sponsorship) {
      throw new Error("Sponsorship not found.");
    }

    // Security Check: Ensure the logged-in user is the one who created the sponsorship
    if (sponsorship.userId !== identity.subject) {
      throw new Error("You are not authorized to cancel this sponsorship.");
    }

    // 1. Update the sponsorship record status to "expired" (or "cancelled")
    await ctx.db.patch(sponsorshipId, {
      status: "expired",
    });

    // 2. "Unlock" each ward that was part of this sponsorship
    for (const item of sponsorship.cart) { // sponsorship.cart is now typed
      const wardId = item.ward._id as Id<"wards">;
      await ctx.db.patch(wardId, {
        isSponsored: false,
        sponsoredUntil: undefined, // Clear the expiration date
      });
    }

    return { success: true };
  },
});

/**
 * Fetches all active sponsorships for the currently logged-in user.
 */
export const getMySponsorships = query({
  // 🎯 FIX: Explicitly type ctx as QueryCtx
  handler: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return []; // Return an empty array if the user is not logged in
    }

    // Fetch sponsorships linked to the user that are currently active
    return await ctx.db
      .query("sponsorships")
      .withIndex("by_userId", (q: any) => q.eq("userId", identity.subject)) // Added 'q: any' for safety
      .filter((q: any) => q.eq(q.field("status"), "active")) // Added 'q: any' for safety
      .order("desc") // Show the most recent sponsorships first
      .collect();
  },
});