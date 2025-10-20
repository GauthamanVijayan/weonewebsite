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
import { api ,internal} from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { action, ActionCtx } from "./_generated/server";
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
  // 🎯 NEW ARGUMENT: Duration in months (from frontend input)
  sponsorshipDurationMonths: number;
  // 🎯 NEW OPTIONAL ARGUMENT: Single Ward ID if sponsoring the entire month for one ward
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
    totalAmount: v.number(),
    cart: v.array(v.any()),
    // 🎯 NEW ARGUMENT: Duration in months
    sponsorshipDurationMonths: v.number(),
    // 🎯 NEW OPTIONAL ARGUMENT: Single Ward ID
    singleSponsoredWardId: v.optional(v.id("wards")),
  },
  handler: async (
    ctx: MutationCtx,
    args: CreateSponsorshipArgs
  ): Promise<Id<"sponsorships">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("You must be logged in to create a sponsorship.");
    }
    const sponsorshipId = await ctx.db.insert("sponsorships", {
      ...args,
      status: "pending",
      userId: identity.subject,
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

// backend/convex/sponsorships.ts (Add this function)

// This function is called by the frontend after payment success.
export const processPaymentSuccess = action({
  args: {
    sponsorshipId: v.id("sponsorships"),
    paymentId: v.string(),
    orderId: v.string(),
    signature: v.string(), // CRITICAL for verification
  }, // 🎯 FIX 1: Explicitly type the arguments and return type
  handler: async (
    ctx: ActionCtx,
    args: {
      sponsorshipId: Id<"sponsorships">;
      paymentId: string;
      orderId: string;
      signature: string;
    }
  ): Promise<any> => {
 

    // 🎯 FIX 2: Call the verification Action (must be created separately)
  const isVerified = await ctx.runAction(internal.payment.verifyRazorpayPayment, {
        orderId: args.orderId,
        paymentId: args.paymentId,
        signature: args.signature,
      });

    if (!isVerified) {
      throw new Error("Payment verification failed due to signature mismatch.");
    } // 3. Call the existing processSponsorship mutation to finalize the state

 await ctx.runMutation(internal.sponsorships._processSponsorshipInternal, { 
            sponsorshipId: args.sponsorshipId 
        });
   return { success: true };
  },
});
