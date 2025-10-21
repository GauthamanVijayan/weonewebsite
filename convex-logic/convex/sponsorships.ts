// in backend/convex/sponsorships.ts

// NOTE: Ensure your global file (or the necessary type file) exports QueryCtx, MutationCtx, Id, and the internal module export helpers.
import {
  query,
  mutation,
  QueryCtx,
  MutationCtx,
  internalMutation,
} from "./_generated/server";
import {  v } from "convex/values";
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
    const processedCart = args.cart.map((item) => ({
      ...item,
      // Convert ISO string back to timestamp number for consistent backend storage/use
      startDate: new Date(item["startDate"]).getTime(),
      endDate: new Date(item["endDate"]).getTime(),
    }));

    if (identity) {
      identityFields.userId = identity.subject;
    }
    const sponsorshipId = await ctx.db.insert("sponsorships", {
      ...args,
      cart: processedCart, // Use the processed cart
      status: "pending",
      paymentDate: 0,
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
    args: { 
        sponsorshipId: v.id("sponsorships"),
        userId: v.id("users") // ✅ Add userId parameter
    },
    handler: async (
        ctx: MutationCtx,
        { sponsorshipId, userId }
    ) => {
        console.log('🗑️ Cancel request from userId:', userId);

        // Get user
        const user = await ctx.db.get(userId);
        if (!user) {
            throw new Error("Unauthorized: User not found.");
        }

        // Get sponsorship
        const sponsorship = await ctx.db.get(sponsorshipId) as any;
        if (!sponsorship) {
            throw new Error("Sponsorship not found.");
        }

        // Security Check: user owns this sponsorship
        if (sponsorship.userId !== user.authId) {
            throw new Error("You are not authorized to cancel this sponsorship.");
        }

        // Update sponsorship
        await ctx.db.patch(sponsorshipId, {
            status: "expired",
        });

        // Unlock wards
        for (const item of sponsorship.cart) {
            const wardId = item.ward._id as Id<"wards">;
            await ctx.db.patch(wardId, {
                isSponsored: false,
                sponsoredUntil: undefined,
            });
        }

        console.log('✅ Sponsorship cancelled');
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

    const subjectId = identity.subject;
    // Fetch sponsorships linked to the user that are currently active
    return await ctx.db
      .query("sponsorships")
      .withIndex("by_userId", (q: any) => q.eq("userId", subjectId)) // Added 'q: any' for safety
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
  handler: async (ctx:MutationCtx, args: { sponsorshipId: Id<"sponsorships">, razorpayPaymentId: string, razorpayOrderId: string }) => {
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
  handler: async (
    ctx: MutationCtx,
    args: {
      sponsorshipId: Id<"sponsorships">;
      razorpayPaymentId: string;
      razorpayOrderId: string;
    } // ✅ FIX: Explicitly type args
  ) => {
    // NOTE: This line was causing an error because it redeclares sponsorshipId
    // const sponsorshipId = args.sponsorshipId;

    // 1. Fetch the sponsorship record
    const sponsorship = await ctx.db.get(args.sponsorshipId);

    if (!sponsorship || sponsorship.status !== "pending") {
      console.error(
        `Fulfillment skip: Sponsorship ${args.sponsorshipId} not found or not pending.`
      );
      return;
    }

    const now = Date.now();
    const durationMs =
      sponsorship.sponsorshipDurationMonths * 30 * 24 * 60 * 60 * 1000;
    const endDate = now + durationMs; // 2. Update the Sponsorship record

    await ctx.db.patch(args.sponsorshipId, {
      // ✅ Use args.sponsorshipId
      status: "active",
      paymentId: args.razorpayPaymentId,
      razorpayOrderId: args.razorpayOrderId,
      paymentDate: now,
      startDate: now,
      endDate: endDate,
    }); // 3. Lock/Sponsor the Wards associated with the cart

    const cart: CartItem[] = sponsorship.cart as CartItem[];

    for (const item of cart) {
      const wardId = item["ward"]._id as Id<"wards">; // ✅ FIX TS4111: Bracket notation
      await ctx.db.patch(wardId, {
        isSponsored: true,
        sponsoredUntil: endDate,
      });
    }

    console.log(
      `Fulfillment complete and wards locked for sponsorship: ${args.sponsorshipId}`
    );
  },
});

// in backend/convex/sponsorships.ts

export const getAllSponsorshipsForAdmin = query({
    args: {
        userId: v.id("users"),
        searchText: v.optional(v.string()),
        zone: v.optional(v.string()),
        district: v.optional(v.string()),
        subdistrict: v.optional(v.string()),
        localBodyName: v.optional(v.string()),
        status: v.optional(v.string()),
    },
    handler: async (ctx: QueryCtx, args) => {
        const { userId, searchText, zone, district, subdistrict, localBodyName, status } = args;
        
        // ✅ Normalization helper
        const normalizeText = (text: string) => {
            if (!text) return '';
            return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
        };

        // Verify user
        const user = await ctx.db.get(userId);
        if (!user) {
            throw new Error("Unauthorized: User not found.");
        }
        if (user.role !== "admin") {
            throw new Error("Unauthorized: Access restricted to administrators.");
        }

        // Fetch sponsorships with status filter
        let query = ctx.db.query("sponsorships");
        
        if (status) {
            query = query.filter((q: any) => q.eq(q.field("status"), status));
        } else {
            query = query.filter((q: any) => q.eq(q.field("status"), "active"));
        }

        let sponsorships = await query.order("desc").collect();

        // ✅ Apply filters with normalization
        if (searchText && searchText.trim()) {
            const search = searchText.toLowerCase().trim();
            sponsorships = sponsorships.filter(s => 
                s.sponsorName?.toLowerCase().includes(search) ||
                s.sponsorEmail?.toLowerCase().includes(search) ||
                s.cart?.some((item: any) => 
                    item.ward?.wardName?.toLowerCase().includes(search) ||
                    item.ward?.localBodyName?.toLowerCase().includes(search)
                )
            );
        }

        // ✅ Zone filter with normalization
        if (zone) {
            const normalizedZone = normalizeText(zone);
            sponsorships = sponsorships.filter(s =>
                s.cart?.some((item: any) => 
                    normalizeText(item.ward?.zoneName) === normalizedZone
                )
            );
        }

        // ✅ District filter with normalization
        if (district) {
            const normalizedDistrict = normalizeText(district);
            sponsorships = sponsorships.filter(s =>
                s.cart?.some((item: any) => 
                    normalizeText(item.ward?.districtName) === normalizedDistrict
                )
            );
        }

        // ✅ Subdistrict filter with normalization
        if (subdistrict) {
            const normalizedSubdistrict = normalizeText(subdistrict);
            sponsorships = sponsorships.filter(s =>
                s.cart?.some((item: any) => 
                    normalizeText(item.ward?.subdistrictName) === normalizedSubdistrict
                )
            );
        }

        // ✅ Local body filter (exact match, but case-insensitive)
        if (localBodyName) {
            const normalizedLocalBody = localBodyName.toLowerCase();
            sponsorships = sponsorships.filter(s =>
                s.cart?.some((item: any) => 
                    item.ward?.localBodyName?.toLowerCase() === normalizedLocalBody
                )
            );
        }

        console.log('📊 Filtered sponsorships:', sponsorships.length);
        return sponsorships;
    },
});
