// in backend/convex/sponsorships.ts

// NOTE: Ensure your global file (or the necessary type file) exports QueryCtx, MutationCtx, Id, and the internal module export helpers.
import {
  query,
  mutation,
  QueryCtx,
  MutationCtx,
  internalMutation,
} from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { action, ActionCtx } from "./_generated/server";
// --- Type Definitions for Strict Mode Fixes ---

// Define the shape of a Cart Item used in the mutation args
type CartItem = {
  _id: Id<"wards">; // Must be the Ward's internal ID
  // Include any other required fields for a cart item object
  [key: string]: any;
};

// Define the argument type for createSponsorship
type CreateSponsorshipArgs = {
  sponsorName: string;
  sponsorEmail: string;
  totalAmount: number;
  cart: CartItem[];
  sponsorshipDurationMonths: number;
  singleSponsoredWardId?: Id<"wards">;
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
    totalAmount: v.number(), // IMPORTANT: We use v.any() here but rely on TypeScript definition for safety
    cart: v.array(v.any()),
    sponsorshipDurationMonths: v.number(),
    singleSponsoredWardId: v.optional(v.id("wards")),
  },
  handler: async (
    ctx: MutationCtx,
    args: CreateSponsorshipArgs
  ): Promise<Id<"sponsorships">> => {
    const identity = await ctx.auth.getUserIdentity();
    const identityFields: { userId?: string } = {};

    if (identity) {
      identityFields.userId = identity.subject;
    }
    const sponsorshipId = await ctx.db.insert("sponsorships", {
      ...args,
      status: "pending", // Payment hasn't happened yet
      paymentDate: 0, // Set to 0 or null initially
      ...identityFields,
    });
    return sponsorshipId;
  },
});

/**
 * Activates a sponsorship and "locks" the corresponding wards.
 */
export const _processSponsorshipInternal = internalMutation({
  args: { sponsorshipId: v.id("sponsorships") },
  handler: async (
    ctx: MutationCtx,
    { sponsorshipId }: { sponsorshipId: Id<"sponsorships"> }
  ) => {
    const sponsorship = (await ctx.db.get(sponsorshipId)) as
      | (CreateSponsorshipArgs & { userId: string; cart: CartItem[] })
      | null;

    if (!sponsorship) {
      throw new Error("Sponsorship Not Found");
    }
    const now = Date.now();
    const durationMs =
      sponsorship.sponsorshipDurationMonths * 30 * 24 * 60 * 60 * 1000;
    const endDate = now + durationMs;
    await ctx.db.patch(sponsorshipId, {
      status: "active",
      startDate: now,
      endDate: endDate,
    });
    return { success: true };
  },
});
/**
 * Allows a user to cancel their own active sponsorship, releasing the lock on the wards.
 */
export const cancelSponsorship = mutation({
  args: { sponsorshipId: v.id("sponsorships") },
  // 🎯 FIX: Explicitly type ctx as MutationCtx and the destructured argument
  handler: async (
    ctx: MutationCtx,
    { sponsorshipId }: { sponsorshipId: Id<"sponsorships"> }
  ) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("You must be logged in to cancel a sponsorship.");
    }

    // 🎯 FIX: Type the fetched sponsorship record
    const sponsorship = (await ctx.db.get(sponsorshipId)) as
      | (CreateSponsorshipArgs & { userId: string; cart: CartItem[] })
      | null;

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
    for (const item of sponsorship.cart) {
      // sponsorship.cart is now typed
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


export const fulfillSponsorship = internalMutation({
  args: {
    sponsorshipId: v.id("sponsorships"), // Internal ID of the sponsorship
    razorpayPaymentId: v.string(),
    razorpayOrderId: v.string(),
  },
  handler: async (ctx, args) => {
    const sponsorshipDoc = await ctx.db.get(args.sponsorshipId);

    if (!sponsorshipDoc) {
      console.error("Fulfillment failed: Sponsorship ID not found in DB.");
      return;
    }

    await ctx.db.patch(args.sponsorshipId, {
      status: "active", // Add a 'status' field to your sponsorships table
      paymentId: args.razorpayPaymentId,
      razorpayOrderId: args.razorpayOrderId,
      paymentDate: Date.now(),
    });

    console.log(`Fulfillment complete for sponsorship: ${args.sponsorshipId}`);
  },
});

export const _fulfillSponsorshipInternal = internalMutation({
  args: {
    sponsorshipId: v.id("sponsorships"),
    razorpayPaymentId: v.string(),
    razorpayOrderId: v.string(),
  },
  handler: async (ctx: MutationCtx, args) => {
    const sponsorshipId = args.sponsorshipId;

    // 1. Fetch the sponsorship record
    const sponsorship = await ctx.db.get(sponsorshipId);

    if (!sponsorship || sponsorship.status !== "pending") {
      // Error handling for already processed or missing sponsorship
      console.error(
        `Fulfillment skip: Sponsorship ${sponsorshipId} not found or not pending.`
      );
      return;
    }

    const now = Date.now();
    const durationMs =
      sponsorship.sponsorshipDurationMonths * 30 * 24 * 60 * 60 * 1000;
    const endDate = now + durationMs;

    // 2. Update the Sponsorship record
    await ctx.db.patch(sponsorshipId, {
      status: "active",
      paymentId: args.razorpayPaymentId,
      razorpayOrderId: args.razorpayOrderId,
      paymentDate: now, // CRITICAL: Set the actual payment date here
      startDate: now,
      endDate: endDate,
    });

    // 3. Lock/Sponsor the Wards associated with the cart
    const cart: CartItem[] = sponsorship.cart as CartItem[];

    for (const item of cart) {
      const wardId = item._id; // Assumes the top-level object in the cart array is the ward ID

      // Apply the lock on the ward
      await ctx.db.patch(wardId, {
        isSponsored: true,
        sponsoredUntil: endDate,
      });
    }

    console.log(
      `Fulfillment complete and wards locked for sponsorship: ${sponsorshipId}`
    );
  },
});
