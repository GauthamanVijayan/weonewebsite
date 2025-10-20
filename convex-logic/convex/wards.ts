// in backend/convex/wards.ts

import {
  query,
  mutation,
  QueryCtx,
  MutationCtx,
  internalMutation,
} from "./_generated/server";
import { v } from "convex/values";

// --- Type Definitions for Strict Mode Fixes ---

// Define the shape of a Ward document as retrieved from the DB
type WardDocument = {
  wardName: string;
  localBodyName: string;
  localBodyType: string;
  district: string;
  subdistrict: string;
  zone: string;
  state: string;
  availableVolunteers: number;
  _id: any;
  _creationTime: number;
};
type InsertBatchArgs = {
  batch: {
    wardName: string;
    localBodyName: string;
    localBodyType: string;
    district: string;
    subdistrict: string;
    zone: string;
    state: string;
    availableVolunteers: number;
  }[];
};

// Define the argument type for the main filtering query
type GetWardsArgs = {
  subdistrict?: string;
  localBodyType?: string;
  searchText?: string;
};

// --- Standard Mutation (can be called by frontend) ---
export const insertBatch = mutation({
  args: {
    batch: v.array(
      v.object({
        wardName: v.string(),
        localBodyName: v.string(),
        localBodyType: v.string(),
        district: v.string(),
        subdistrict: v.string(),
        zone: v.string(),
        state: v.string(),
        availableVolunteers: v.number(),
      })
    ),
  },
  handler: async (ctx: MutationCtx, { batch }: InsertBatchArgs) => {
    for (const ward of batch) {
      await ctx.db.insert("wards", {
        ...ward,
        isSponsored: false, // Default to not sponsored
      });
    }
  },
});

// --- Internal Mutation (used by the import Action) ---
export const insertImportBatch = internalMutation({
  args: {
    batch: v.array(
      v.object({
        wardName: v.string(),
        localBodyName: v.string(),
        localBodyType: v.string(),
        district: v.string(),
        subdistrict: v.string(),
        zone: v.string(),
        state: v.string(),
        availableVolunteers: v.number(),
      })
    ),
  },
  handler: async (ctx: MutationCtx, { batch }: InsertBatchArgs) => {
    for (const ward of batch) {
      await ctx.db.insert("wards", {
        ...ward,
        isSponsored: false, // Default to not sponsored
      });
    }
  },
});

// ===================================================================
// FULLY TYPED QUERY FUNCTIONS
// ===================================================================

/**
 * 1. Get Unique Zones
 */
export const getZones = query({
  handler: async (ctx: QueryCtx) => {
    const allWards = (await ctx.db.query("wards").collect()) as WardDocument[];
    const uniqueZones = [
      ...new Set(allWards.map((ward: WardDocument) => ward.zone)),
    ];
    return uniqueZones.map((zoneName, index) => ({
      _id: `zone-${index}`,
      name: zoneName,
    }));
  },
});

// Returns unique districts for a given zone
export const getDistrictsByZone = query({
  args: { zone: v.optional(v.string()) },
  handler: async (ctx: QueryCtx, { zone }: { zone?: string }) => {
    if (!zone) return [];
    const wardsInZone = (await ctx.db
      .query("wards")
      .withIndex("by_zone", (q: any) => q.eq("zone", zone))
      .collect()) as WardDocument[];
    const uniqueDistricts = [
      ...new Set(wardsInZone.map((ward: WardDocument) => ward.district)),
    ];
    return uniqueDistricts.map((districtName, index) => ({
      _id: `district-${index}`,
      name: districtName,
      zoneId: zone, // Uses the parameter 'zone' correctly
    }));
  },
});

// NEW: Returns unique subdistricts for a given district
export const getSubdistrictsByDistrict = query({
  args: { district: v.optional(v.string()) },
  handler: async (ctx: QueryCtx, { district }: { district?: string }) => {
    if (!district) return [];
    const wardsInDistrict = (await ctx.db
      .query("wards")
      .withIndex("by_district", (q: any) => q.eq("district", district))
      .collect()) as WardDocument[];
    const uniqueSubdistricts = [
      ...new Set(wardsInDistrict.map((ward: WardDocument) => ward.subdistrict)),
    ];

    return uniqueSubdistricts.map((subdistrictName, index) => ({
      _id: `subdistrict-${index}`,
      name: subdistrictName,
      type: "P",
      districtId: district,
    }));
  },
});

export const getWardsBySubdistrict = query({
  args: { subdistrict: v.optional(v.string()) },
  handler: async (ctx: QueryCtx, { subdistrict }: { subdistrict?: string }) => {
    if (!subdistrict) {
      console.log("No subdistrict provided — returning empty array");
      return [];
    }

    console.log("Fetching wards for subdistrict:", subdistrict);

    const wardsFromDB = (await ctx.db
      .query("wards")
      .filter((q: any) => q.eq(q.field("subdistrict"), subdistrict))
      .collect()) as WardDocument[];

    console.log("Raw wards fetched from DB:", wardsFromDB); // Map the database fields to the frontend Ward interface

    const mappedWards = wardsFromDB.map((ward: WardDocument) => {
      const typeCode = ward.localBodyType?.charAt(0)?.toUpperCase() as
        | "P"
        | "M"
        | "C"
        | undefined;

      console.log("Mapping ward:", {
        wardName: ward.wardName,
        localBodyName: ward.localBodyName,
        localBodyType: ward.localBodyType,
        typeCode,
      });

      return {
        _id: ward._id.toString(),
        wardName: ward.wardName,
        localBodyId: ward.localBodyName,
        localBodyName: ward.localBodyName,
        localBodyType: typeCode,
        type: (typeCode === "P" ? "Rural" : "Urban") as "Urban" | "Rural",
        districtName: ward.district,
        zoneName: ward.zone,
      };
    });

    console.log("Mapped wards to return:", mappedWards);
    return mappedWards;
  },
});

export const getWardsByLocalBody = query({
  args: { localBody: v.optional(v.string()) },
  handler: async (ctx: QueryCtx, { localBody }: { localBody?: string }) => {
    if (!localBody) return [];

    const wardsFromDB = (await ctx.db
      .query("wards")
      .withIndex("by_localBody", (q: any) => q.eq("localBodyName", localBody))
      .collect()) as WardDocument[]; // Map the database fields to the exact structure the frontend Ward interface needs

    return wardsFromDB.map((ward: WardDocument, index: number) => {
      const wardType: "Urban" | "Rural" =
        ward.localBodyType === "P" ? "Rural" : "Urban";

      return {
        _id: ward._id.toString(),
        wardName: ward.wardName,
        localBodyId: `localbody-${index}`,
        localBodyName: ward.localBodyName,
        localBodyType: ward.localBodyType as "P" | "M" | "C",
        type: wardType,
        districtName: ward.district,
        zoneName: ward.zone,
      };
    });
  },
});

/**
 * The unified query function.
 */
export const getWards = query({
  args: {
    subdistrict: v.optional(v.string()),
    localBodyType: v.optional(v.string()),
    searchText: v.optional(v.string()),
  },
  handler: async (
    ctx: QueryCtx,
    { subdistrict, localBodyType, searchText }: GetWardsArgs
  ) => {
    // 1. Don't run the query if a subdistrict isn't selected yet.
    if (!subdistrict) {
      return [];
    } // 2. Start by fetching all wards for the selected subdistrict.

    let wards = (await ctx.db // 🎯 FIX: Cast the result immediately for type propagation
      .query("wards") // 🎯 FIX A: Parameter 'q' implicitly has an 'any' type.
      .withIndex("by_subdistrict", (q: any) => q.eq("subdistrict", subdistrict)) // 🎯 FIX A: Parameter 'q' implicitly has an 'any' type.
    .filter(
    (q: any) =>
        // 🎯 FIX: Return everything EXCEPT documents where isSponsored is TRUE.
        // This includes documents where the field is false, undefined, or null.
        q.neq(q.field("isSponsored"), true) 
).collect()) as WardDocument[];

    // 3. Apply the Local Body Type filter on the backend.
    if (localBodyType && localBodyType !== "All") {
      // 🎯 FIX B: Parameter 'ward' implicitly has an 'any' type.
      wards = wards.filter(
        (ward: WardDocument) =>
          ward.localBodyType.charAt(0).toUpperCase() === localBodyType
      );
    }
    // 4. Apply the Search filter on the backend.
    if (searchText) {
      const search = searchText.toLowerCase(); // 🎯 FIX B: Parameter 'ward' implicitly has an 'any' type.
      wards = wards.filter(
        (ward: WardDocument) =>
          ward.wardName.toLowerCase().includes(search) ||
          ward.localBodyName.toLowerCase().includes(search)
      );
    }
    // 5. Map the final, filtered results to the frontend interface shape.
    return wards.map((ward: WardDocument) => {
      const typeCode = ward.localBodyType.charAt(0).toUpperCase() as
        | "P"
        | "M"
        | "C";
      return {
        _id: ward._id.toString(),
        wardName: ward.wardName,
        localBodyId: ward.localBodyName,
        localBodyName: ward.localBodyName,
        localBodyType: typeCode,
        type: (typeCode === "P" ? "Rural" : "Urban") as "Urban" | "Rural",
        districtName: ward.district,
        zoneName: ward.zone,
      };
    });
  },
});

// backend/convex/wards.ts (Add this new query)

export const getLocalBodiesBySubdistrictAndType = query({
  args: { 
    subdistrict: v.string(), 
    localBodyType: v.string() // This will be 'P', 'M', or 'C'
  },
  handler: async (ctx: QueryCtx, { subdistrict, localBodyType }: { subdistrict: string, localBodyType: string }) => {
    console.log('🔍 Querying local bodies:', { subdistrict, localBodyType });
    
    // Get all wards in this subdistrict first
    const allWardsInSubdistrict = (await ctx.db
      .query("wards")
      .withIndex("by_subdistrict", (q: any) => q.eq("subdistrict", subdistrict))
      .collect()) as WardDocument[];

    console.log('📊 Total wards in subdistrict:', allWardsInSubdistrict.length);

    // Filter by type (comparing first character)
    const wardsOfType = allWardsInSubdistrict.filter((ward: WardDocument) => {
      const firstChar = ward.localBodyType.charAt(0).toUpperCase();
      const match = firstChar === localBodyType;
      if (match) {
        console.log('✅ Match found:', ward.localBodyName, ward.localBodyType);
      }
      return match;
    });

    console.log('📊 Wards matching type:', wardsOfType.length);

    // Extract unique local body names
    const uniqueLocalBodyNames = [...new Set(
      wardsOfType.map((ward: WardDocument) => ward.localBodyName)
    )];

    console.log('🏛️ Unique local bodies:', uniqueLocalBodyNames);

    return uniqueLocalBodyNames.map((name, index) => ({
      _id: `lb-${subdistrict}-${localBodyType}-${index}`,
      name: name,
      type: localBodyType as 'P' | 'M' | 'C',
      subdistrictId: subdistrict
    }));
  },
});

export const getAllWards = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const wards = (await ctx.db
      .query("wards")
      .filter((q: any) => q.neq(q.field("isSponsored"), true))
      .collect()) as WardDocument[];

    return wards.map((ward: WardDocument) => {
      const typeCode = ward.localBodyType.charAt(0).toUpperCase() as "P" | "M" | "C";
      return {
        _id: ward._id.toString(),
        wardName: ward.wardName,
        localBodyId: ward.localBodyName,
        localBodyName: ward.localBodyName,
        localBodyType: typeCode,
        type: (typeCode === "P" ? "Rural" : "Urban") as "Urban" | "Rural",
        districtName: ward.district,
        zoneName: ward.zone,
      };
    });
  },
});

export const getWardsByZone = query({
  args: { zone: v.string() },
  handler: async (ctx: QueryCtx, { zone }: { zone: string }) => {
    const wards = (await ctx.db
      .query("wards")
      .withIndex("by_zone", (q: any) => q.eq("zone", zone))
      .filter((q: any) => q.neq(q.field("isSponsored"), true))
      .collect()) as WardDocument[];

    return wards.map((ward: WardDocument) => {
      const typeCode = ward.localBodyType.charAt(0).toUpperCase() as "P" | "M" | "C";
      return {
        _id: ward._id.toString(),
        wardName: ward.wardName,
        localBodyId: ward.localBodyName,
        localBodyName: ward.localBodyName,
        localBodyType: typeCode,
        type: (typeCode === "P" ? "Rural" : "Urban") as "Urban" | "Rural",
        districtName: ward.district,
        zoneName: ward.zone,
      };
    });
  },
});

// Get all wards by district
export const getWardsByDistrict = query({
  args: { district: v.string() },
  handler: async (ctx: QueryCtx, { district }: { district: string }) => {
    const wards = (await ctx.db
      .query("wards")
      .withIndex("by_district", (q: any) => q.eq("district", district))
      .filter((q: any) => q.neq(q.field("isSponsored"), true))
      .collect()) as WardDocument[];

    return wards.map((ward: WardDocument) => {
      const typeCode = ward.localBodyType.charAt(0).toUpperCase() as "P" | "M" | "C";
      return {
        _id: ward._id.toString(),
        wardName: ward.wardName,
        localBodyId: ward.localBodyName,
        localBodyName: ward.localBodyName,
        localBodyType: typeCode,
        type: (typeCode === "P" ? "Rural" : "Urban") as "Urban" | "Rural",
        districtName: ward.district,
        zoneName: ward.zone,
      };
    });
  },
});

export const getStateSummary = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const allWards = (await ctx.db
      .query("wards")
      .filter((q: any) => q.neq(q.field("isSponsored"), true))
      .collect()) as WardDocument[];

    // Count by type
    const panchayatCount = allWards.filter(w => w.localBodyType.charAt(0).toUpperCase() === 'P').length;
    const municipalityCount = allWards.filter(w => w.localBodyType.charAt(0).toUpperCase() === 'M').length;
    const corporationCount = allWards.filter(w => w.localBodyType.charAt(0).toUpperCase() === 'C').length;

    return {
      totalWards: allWards.length,
      breakdown: {
        panchayat: panchayatCount,
        municipality: municipalityCount,
        corporation: corporationCount
      },
      estimatedCost: allWards.length * 15000, // Per ward per month
      zones: [...new Set(allWards.map(w => w.zone))],
      districts: [...new Set(allWards.map(w => w.district))]
    };
  },
});

// Similar summaries for zone and district
export const getZoneSummary = query({
  args: { zone: v.string() },
  handler: async (ctx: QueryCtx, { zone }: { zone: string }) => {
    const wards = (await ctx.db
      .query("wards")
      .withIndex("by_zone", (q: any) => q.eq("zone", zone))
      .filter((q: any) => q.neq(q.field("isSponsored"), true))
      .collect()) as WardDocument[];

    const panchayatCount = wards.filter(w => w.localBodyType.charAt(0).toUpperCase() === 'P').length;
    const municipalityCount = wards.filter(w => w.localBodyType.charAt(0).toUpperCase() === 'M').length;
    const corporationCount = wards.filter(w => w.localBodyType.charAt(0).toUpperCase() === 'C').length;

    return {
      zone,
      totalWards: wards.length,
      breakdown: {
        panchayat: panchayatCount,
        municipality: municipalityCount,
        corporation: corporationCount
      },
      estimatedCost: wards.length * 15000
    };
  },
});

export const getDistrictSummary = query({
  args: { district: v.string() },
  handler: async (ctx: QueryCtx, { district }: { district: string }) => {
    const wards = (await ctx.db
      .query("wards")
      .withIndex("by_district", (q: any) => q.eq("district", district))
      .filter((q: any) => q.neq(q.field("isSponsored"), true))
      .collect()) as WardDocument[];

    const panchayatCount = wards.filter(w => w.localBodyType.charAt(0).toUpperCase() === 'P').length;
    const municipalityCount = wards.filter(w => w.localBodyType.charAt(0).toUpperCase() === 'M').length;
    const corporationCount = wards.filter(w => w.localBodyType.charAt(0).toUpperCase() === 'C').length;

    return {
      district,
      totalWards: wards.length,
      breakdown: {
        panchayat: panchayatCount,
        municipality: municipalityCount,
        corporation: corporationCount
      },
      estimatedCost: wards.length * 15000
    };
  },
});export const getWardsSummaryBySubdistrictAndType = query({
  args: { 
    subdistrict: v.string(), 
    localBodyType: v.string() 
  },
  handler: async (ctx: QueryCtx, { subdistrict, localBodyType }: { subdistrict: string, localBodyType: string }) => {
    const allWardsInSubdistrict = (await ctx.db
      .query("wards")
      .withIndex("by_subdistrict", (q: any) => q.eq("subdistrict", subdistrict))
      .filter((q: any) => q.neq(q.field("isSponsored"), true))
      .collect()) as WardDocument[];

    const wardsOfType = allWardsInSubdistrict.filter((ward: WardDocument) => {
      const firstChar = ward.localBodyType.charAt(0).toUpperCase();
      return firstChar === localBodyType;
    });

    return {
      subdistrict,
      localBodyType,
      totalWards: wardsOfType.length,
      estimatedCost: wardsOfType.length * 15000
    };
  },
});