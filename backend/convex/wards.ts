// in backend/convex/wards.ts

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

type WardDocument = {
  wardName: string;
  localBodyName: string;
  localBodyType: string;
  district: string;
  subdistrict: string;
  zone: string;
  state: string;
  availableVolunteers: number;
  _id: any; // Include standard Convex fields
  _creationTime: number;
};
// This is your existing mutation for importing data. It remains unchanged.
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
  handler: async (ctx, { batch }) => {
    for (const ward of batch) {
      await ctx.db.insert("wards", ward);
    }
  },
});

// ===================================================================
// CORRECTED QUERY FUNCTIONS FOR ANGULAR FRONTEND
// ===================================================================

/**
 * 1. Get Unique Zones
 * FIX: Returns '_id' instead of 'id' to match the Zone interface.
 */
export const getZones = query({
  handler: async (ctx) => {
    const allWards = await ctx.db.query("wards").collect();
    const uniqueZones = [...new Set(allWards.map((ward) => ward.zone))];
    return uniqueZones.map((zoneName, index) => ({ _id: `zone-${index}`, name: zoneName }));
  },
});

// Returns unique districts for a given zone
export const getDistrictsByZone = query({
  args: { zone: v.optional(v.string()) },
  handler: async (ctx, { zone }) => {
    if (!zone) return [];
    const wardsInZone = await ctx.db.query("wards").withIndex("by_zone", (q) => q.eq("zone", zone)).collect();
    const uniqueDistricts = [...new Set(wardsInZone.map((ward) => ward.district))];
    return uniqueDistricts.map((districtName, index) => ({ _id: `district-${index}`, name: districtName, zoneId: zone }));
  },
});

// NEW: Returns unique subdistricts for a given district
export const getSubdistrictsByDistrict = query({
  args: { district: v.optional(v.string()) },
  handler: async (ctx, { district }) => {
    if (!district) return [];
    const wardsInDistrict = await ctx.db.query("wards").withIndex("by_district", (q) => q.eq("district", district)).collect();
    const uniqueSubdistricts = [...new Set(wardsInDistrict.map((ward) => ward.subdistrict))];
    
    
    return uniqueSubdistricts.map((subdistrictName, index) => ({
      _id: `subdistrict-${index}`,
      name: subdistrictName,
      type: 'P', 
      districtId: district,
    }));
  },
});

export const getWardsBySubdistrict = query({
  args: { subdistrict: v.optional(v.string()) },
  handler: async (ctx, { subdistrict }) => {
    if (!subdistrict) {
      console.log("No subdistrict provided — returning empty array");
      return [];
    }

    console.log("Fetching wards for subdistrict:", subdistrict);

    const wardsFromDB = await ctx.db
      .query("wards")
      .filter(q => q.eq(q.field("subdistrict"), subdistrict))
      .collect();

    console.log("Raw wards fetched from DB:", wardsFromDB);

    // Map the database fields to the frontend Ward interface
    const mappedWards = wardsFromDB.map((ward) => {
      const typeCode = ward.localBodyType?.charAt(0)?.toUpperCase() as 'P' | 'M' | 'C' | undefined;

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
        type: typeCode === 'P' ? 'Rural' : 'Urban' as 'Urban' | 'Rural',
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
  handler: async (ctx, { localBody }) => {
    if (!localBody) return [];
    
    const wardsFromDB = await ctx.db
      .query("wards")
      .withIndex("by_localBody", (q) => q.eq("localBodyName", localBody))
      .collect();

    // Map the database fields to the exact structure the frontend Ward interface needs
    return wardsFromDB.map((ward, index) => {
        // --- FIX IS HERE ---
        // Explicitly define the type based on your business logic
        const wardType: 'Urban' | 'Rural' = ward.localBodyType === 'P' ? 'Rural' : 'Urban';

        return {
            _id: ward._id.toString(),
            wardName: ward.wardName,
            localBodyId: `localbody-${index}`, // Construct a stable ID
            localBodyName: ward.localBodyName,
            localBodyType: ward.localBodyType as "P" | "M" | "C",
            type: wardType, // Use the correctly typed variable
            districtName: ward.district,
            zoneName: ward.zone,
        };
    });
  },
});

export const getWards = query({
  args: {
    subdistrict: v.optional(v.string()),
    localBodyType: v.optional(v.string()),
    searchText: v.optional(v.string()),
  },
  handler: async (ctx, { subdistrict, localBodyType, searchText }) => {
    // 1. Don't run the query if a subdistrict isn't selected yet.
    if (!subdistrict) {
      return [];
    }

    // 2. Start by fetching all wards for the selected subdistrict.
       let wards: WardDocument[] = await ctx.db // 👈 Explicitly type the array here
      .query("wards")
      .withIndex("by_subdistrict", q => q.eq("subdistrict", subdistrict))
      .collect() as WardDocument[]; // 👈 Cast the result


    // 3. Apply the Local Body Type filter on the backend.
    if (localBodyType && localBodyType !== 'All') {
      wards = wards.filter((ward: WardDocument) => ward.localBodyType.charAt(0).toUpperCase() === localBodyType);
    }

    // 4. Apply the Search filter on the backend.
    if (searchText) {
      const search = searchText.toLowerCase();
      wards = wards.filter(ward =>
        ward.wardName.toLowerCase().includes(search) ||
        ward.localBodyName.toLowerCase().includes(search)
      );
    }

    // 5. Map the final, filtered results to the frontend interface shape.
    return wards.map((ward:any) => {
      const typeCode = ward.localBodyType.charAt(0).toUpperCase() as 'P' | 'M' | 'C';
      return {
        _id: ward._id.toString(),
        wardName: ward.wardName,
        localBodyId: ward.localBodyName,
        localBodyName: ward.localBodyName,
        localBodyType: typeCode,
        type: (typeCode === 'P' ? 'Rural' : 'Urban') as 'Urban' | 'Rural',
        districtName: ward.district,
        zoneName: ward.zone,
      };
    });
  },
});
