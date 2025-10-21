// backend/convex/razorpay.utils.ts

"use node"; 
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import crypto from "crypto";

// Get the key that is shared across the Convex app
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

// 🎯 This is a secure, private utility function (internalAction)
export const _verifySignatureInternal = internalAction({
  args: {
    orderId: v.string(),
    paymentId: v.string(),
    signature: v.string(),
  },
  handler: async (ctx, { orderId, paymentId, signature }) => {
    if (!RAZORPAY_KEY_SECRET) {
      // Safely throw an error if the secret is missing
      throw new Error("Razorpay secret key is not configured for verification.");
    }
    
    // Perform the cryptographic signature check
    const shasum = crypto.createHmac("sha256", RAZORPAY_KEY_SECRET);
    shasum.update(`${orderId}|${paymentId}`);
    const digest = shasum.digest("hex");
    
    return digest === signature; // Returns boolean
  },
});