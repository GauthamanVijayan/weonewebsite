// backend/convex/payment.ts

"use node";

import { action, ActionCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import Razorpay from "razorpay";
import { Id } from "./_generated/dataModel"; // Import Id for type safety
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import crypto from "crypto";
// Initialize Razorpay with the secret key from the environment
let razorpay: Razorpay | null = null;
const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (keyId && keySecret && keyId.length > 5 && !keyId.includes("YOUR_")) {
  razorpay = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
} else {
  // Log a warning if running locally without keys, but don't crash the analyzer
  console.warn(
    "RAZORPAY SDK NOT INITIALIZED: Missing or placeholder keys in environment."
  );
}
type CreateOrderArgs = {
  sponsorshipId: Id<"sponsorships">;
  amount: number; // Total amount in PAISA (Rupees * 100)
  sponsorName: string;
  sponsorEmail: string;
};

export const createRazorpayOrder = action({
  args: {
    sponsorshipId: v.id("sponsorships"),
    amount: v.number(),
    sponsorName: v.string(),
    sponsorEmail: v.string(),
  },
  handler: async (ctx: ActionCtx, args: CreateOrderArgs) => {
    const MAX_INSTANT_PAYMENT_PAISE = 5000000;
    let paymentMethods: any = {};

    // NOTE: The 'paymentMethods' object manipulation is client-side configuration
    // and should be merged into the 'options' object returned to the Angular frontend,
    // not used when creating the order on the server. We will ignore that part
    // for the server order creation.

    const orderOptions = {
      amount: args.amount, // Required in paise
      currency: "INR",
      receipt: args.sponsorshipId.toString(), // Unique ID for tracking
      notes: {
        sponsorshipId: args.sponsorshipId.toString(),
        sponsorEmail: args.sponsorEmail,
      },
    };

    try {
      // 1. Check for Razorpay SDK initialization
      if (!razorpay) {
        throw new Error(
          "Payment service is unavailable due to missing server configuration."
        );
      } // 2. Create the Order on Razorpay's server

      const order = await razorpay.orders.create(orderOptions); // 3. Return the Order ID and the public Key ID to the frontend

      return {
        orderId: order.id,
        amount: order.amount,
        keyId: keyId, // <--- RETURNED HERE
      };
    } catch (error) {
      console.error("Razorpay Order Creation Failed:", error);
      throw new Error("Failed to create payment order.");
    }
  },
});

export const verifyRazorpayPayment = action({
  args: {
    orderId: v.string(),
    paymentId: v.string(),
    signature: v.string(),
    sponsorshipId: v.id("sponsorships"), // Pass the Convex ID from the frontend
  },
  handler: async (ctx, { orderId, paymentId, signature, sponsorshipId }) => {
    const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
    if (!RAZORPAY_KEY_SECRET) {
      throw new Error("Server config error");
    }
    const shasum = crypto.createHmac("sha256", RAZORPAY_KEY_SECRET);
    shasum.update(`${orderId}|${paymentId}`);
    const digest = shasum.digest("hex");
    const isVerified = digest === signature;

    if (isVerified) {
      console.log(`✅ Payment Verified: Order ${orderId}`);

      // 🔥 CRITICAL: Call the internal mutation to update the database
      await ctx.runMutation(internal.sponsorships.fulfillSponsorship, {
        sponsorshipId: sponsorshipId,
        razorpayPaymentId: paymentId,
        razorpayOrderId: orderId,
      });

      return {
        verified: true,
        message: "Payment successful and order fulfilled.",
      };
    } else {
      console.error(`❌ Payment Verification Failed: Order ${orderId}`);
      // TODO: Log failure details to a separate table
      return {
        verified: false,
        message: "Verification failed due to signature mismatch.",
      };
    }
  },
});

export const processPaymentSuccess = action({
  args: {
    sponsorshipId: v.id("sponsorships"),
    paymentId: v.string(),
    orderId: v.string(),
    signature: v.string(), // CRITICAL for verification
  },
  handler: async (
    ctx: ActionCtx,
    args: {
      sponsorshipId: Id<"sponsorships">;
      paymentId: string;
      orderId: string;
      signature: string;
    }
  ): Promise<{ success: boolean }> => {
    // 1. Call the verification Action (defined in your convex/payment.ts)
    const isVerified = await ctx.runAction(verifyRazorpayPayment as any, {
      orderId: args.orderId,
      paymentId: args.paymentId,
      signature: args.signature,
      sponsorshipId: args.sponsorshipId,
    });

    if (!isVerified) {
      throw new ConvexError(
        "Payment verification failed due to signature mismatch."
      );
    } // 2. CRITICAL: Call the NEW consolidated fulfillment mutation.

    await ctx.runMutation(internal.sponsorships._fulfillSponsorshipInternal, {
      sponsorshipId: args.sponsorshipId,
      razorpayPaymentId: args.paymentId, // Pass payment details
      razorpayOrderId: args.orderId,
    });

    return { success: true };
  },
});
