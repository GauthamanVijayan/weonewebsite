// in backend/convex/wards.ts

import { query, mutation, QueryCtx, MutationCtx , internalMutation} from "./_generated/server";
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

// --- Mutation (Unchanged) ---
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
  // FIX: Explicitly type ctx as MutationCtx and args as InsertBatchArgs
  handler: async (ctx: MutationCtx, { batch }: InsertBatchArgs) => { 
    for (const ward of batch) {
      await ctx.db.insert("wards", ward);
    }
  },
});


// ===================================================================
// FULLY TYPED QUERY FUNCTIONS
// ===================================================================

/**
 * 1. Get Unique Zones
 * FIX: 'ctx' is explicitly typed as QueryCtx.
 */
export const getZones = query({
  handler: async (ctx: QueryCtx) => {
    // Explicitly cast to WardDocument array
    const allWards = (await ctx.db.query("wards").collect()) as WardDocument[];
    // Explicitly type 'ward' in the map callback
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
  // FIX: 'ctx' is explicitly typed as QueryCtx.
  handler: async (ctx: QueryCtx, { zone }: { zone?: string }) => {
    if (!zone) return [];
    // FIX: Type 'q' as 'any' for the index callback.
    const wardsInZone = (await ctx.db
      .query("wards")
      .withIndex("by_zone", (q: any) => q.eq("zone", zone))
      .collect()) as WardDocument[];
      
    // Explicitly type 'ward' in the map callback
    const uniqueDistricts = [
      ...new Set(wardsInZone.map((ward: WardDocument) => ward.district)),
    ];
    return uniqueDistricts.map((districtName, index) => ({
      _id: `district-${index}`,
      name: districtName,
      zoneId: zone,
    }));
  },
});

// NEW: Returns unique subdistricts for a given district
export const getSubdistrictsByDistrict = query({
  args: { district: v.optional(v.string()) },
  // FIX: 'ctx' is explicitly typed as QueryCtx.
  handler: async (ctx: QueryCtx, { district }: { district?: string }) => { 
    if (!district) return [];
    // FIX: Type 'q' as 'any' for the index callback.
    const wardsInDistrict = (await ctx.db
      .query("wards")
      .withIndex("by_district", (q: any) => q.eq("district", district))
      .collect()) as WardDocument[];
      
    // Explicitly type 'ward' in the map callback
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
  // FIX: 'ctx' is explicitly typed as QueryCtx.
  handler: async (ctx: QueryCtx, { subdistrict }: { subdistrict?: string }) => { 
    if (!subdistrict) {
      console.log("No subdistrict provided — returning empty array");
      return [];
    }

    console.log("Fetching wards for subdistrict:", subdistrict);

    const wardsFromDB = (await ctx.db
      .query("wards")
      // FIX: Type 'q' as 'any' for the filter callback.
      .filter((q: any) => q.eq(q.field("subdistrict"), subdistrict))
      .collect()) as WardDocument[]; 

    console.log("Raw wards fetched from DB:", wardsFromDB);

    // Map the database fields to the frontend Ward interface
    // FIX: Explicitly type 'ward' in the map callback
    const mappedWards = wardsFromDB.map((ward: WardDocument) => {
      // Use optional chaining carefully, ensuring localBodyType is present before charAt
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
  // FIX: 'ctx' is explicitly typed as QueryCtx.
  handler: async (ctx: QueryCtx, { localBody }: { localBody?: string }) => {
    if (!localBody) return [];

    const wardsFromDB = (await ctx.db
      .query("wards")
      // FIX: Type 'q' as 'any' for the index callback.
      .withIndex("by_localBody", (q: any) => q.eq("localBodyName", localBody))
      .collect()) as WardDocument[]; 

    // Map the database fields to the exact structure the frontend Ward interface needs
    // FIX: Explicitly type 'ward' in the map callback
    return wardsFromDB.map((ward: WardDocument, index: number) => {
      // Explicitly define the type based on your business logic
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
  // FIX: 'ctx' is explicitly typed as QueryCtx.
  handler: async (
    ctx: QueryCtx,
    { subdistrict, localBodyType, searchText }: GetWardsArgs
  ) => {
    // 1. Don't run the query if a subdistrict isn't selected yet.
    if (!subdistrict) {
      return [];
    }

    // 2. Start by fetching all wards for the selected subdistrict.
    let wards: WardDocument[] = (await ctx.db
      .query("wards")
      // FIX: Type 'q' as 'any' for the index callback.
      .withIndex("by_subdistrict", (q: any) => q.eq("subdistrict", subdistrict))
      .collect()) as WardDocument[];

    // 3. Apply the Local Body Type filter on the backend.
    if (localBodyType && localBodyType !== "All") {
      // FIX: Explicitly type 'ward' in the filter callback
      wards = wards.filter(
        (ward: WardDocument) =>
          ward.localBodyType.charAt(0).toUpperCase() === localBodyType
      );
    }

    // 4. Apply the Search filter on the backend.
    if (searchText) {
      const search = searchText.toLowerCase();
      // FIX: Explicitly type 'ward' in the filter callback
      wards = wards.filter(
        (ward: WardDocument) =>
          ward.wardName.toLowerCase().includes(search) ||
          ward.localBodyName.toLowerCase().includes(search)
      );
    }

    // 5. Map the final, filtered results to the frontend interface shape.
    // FIX: Use WardDocument type instead of 'any'
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
  // This uses MutationCtx and can access ctx.db
  handler: async (ctx: MutationCtx, { batch }) => { 
    for (const ward of batch) {
      await ctx.db.insert("wards", ward);
    }
  },
});