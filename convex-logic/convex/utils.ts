// backend/convex/utils.ts (Run this once, then delete the action)
"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import bcrypt from "bcryptjs";

export const hashPassword = action({
  args: { password: v.string() },
  handler: async (ctx, { password }) => {
    // 10 rounds is standard for security
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // Log the hash to the console; you will copy this value
    console.log("GENERATED HASH:", passwordHash); 
    
    return passwordHash;
  },
});