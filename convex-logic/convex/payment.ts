// backend/convex/payment.ts

"use node"; 

import { action, ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import Razorpay from 'razorpay'; 
import { Id } from "./_generated/dataModel"; // Import Id for type safety
import { internalAction } from "./_generated/server";
import crypto from 'crypto';
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
    console.warn("RAZORPAY SDK NOT INITIALIZED: Missing or placeholder keys in environment.");
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

    if (!razorpay) {
        throw new Error("Payment service is unavailable due to missing server configuration.");
    }
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
        // 2. Create the Order on Razorpay's server
        const order = await razorpay.orders.create(orderOptions);

        // 3. Return the Order ID needed by the frontend to open the payment modal
        return { orderId: order.id, amount: order.amount }; 
    } catch (error) {
        console.error("Razorpay Order Creation Failed:", error);
        throw new Error("Failed to create payment order.");
    }
  },
});

export const verifyRazorpayPayment = internalAction({
    args: {
        orderId: v.string(),
        paymentId: v.string(),
        signature: v.string(),
    },
    handler: async (ctx, { orderId, paymentId, signature }) => {
        // This payload structure is what Razorpay uses for verification
        const shasum = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!);
        shasum.update(`${orderId}|${paymentId}`);
        const digest = shasum.digest('hex');

        // CRITICAL: Check if the calculated signature matches the signature received from Razorpay
        const isVerified = digest === signature;
        
        return isVerified; 
    },
});