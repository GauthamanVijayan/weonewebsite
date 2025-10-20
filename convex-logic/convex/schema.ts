// in backend/convex/schema.ts

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  wards: defineTable({
    // Fields matching your CSV headers
    wardName: v.string(),
    localBodyName: v.string(),
    localBodyType: v.string(), // For "P/M/C"
    district: v.string(),
    subdistrict: v.string(),
    zone: v.string(),
    state: v.string(),
    isSponsored: v.optional(v.boolean()),
    sponsoredUntil: v.optional(v.number()),

    // Field required by your application
    availableVolunteers: v.number(),
  })
    .index("by_district", ["district"])
    .index("by_localBody", ["localBodyName"])
    .index("by_zone", ["zone"])
    .index("by_subdistrict", ["subdistrict"])
    .index("by_sponsored_until", ["sponsoredUntil"])
    .index("by_subdistrict_and_type", ["subdistrict", "localBodyType"]),

  sponsorships: defineTable({
    sponsorName: v.string(),
    sponsorEmail: v.string(),
    totalAmount: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("active"),
      v.literal("expired")
    ),
    sponsorshipDurationMonths: v.number(),
    singleSponsoredWardId: v.optional(v.id("wards")),
    cart: v.array(v.any()),
    userId: v.string(),
    startDate: v.optional(v.number()), // NEW: Sponsorship start date
    endDate: v.optional(v.number()), // NEW: Sponsorship end date
  }).index("by_userId", ["userId"]),
});
