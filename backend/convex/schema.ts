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
    
    // Field required by your application
    availableVolunteers: v.number(), 
  })
  .index("by_district", ["district"])
  .index("by_localBody", ["localBodyName"])
  .index("by_zone", ["zone"])
  .index("by_subdistrict", ["subdistrict"]),
  
});