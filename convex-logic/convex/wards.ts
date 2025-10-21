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
    
    // ✅ Normalize zone names (capitalize first letter, lowercase rest)
    const normalizeZone = (zone: string) => {
      if (!zone) return '';
      return zone.charAt(0).toUpperCase() + zone.slice(1).toLowerCase();
    };
    
    // Create a map to handle case-insensitive uniqueness
    const zoneMap = new Map<string, string>();
    
    allWards.forEach((ward: WardDocument) => {
      const originalZone = ward.zone;
      const normalizedZone = normalizeZone(originalZone);
      
      // Store the normalized version (this automatically deduplicates)
      if (!zoneMap.has(normalizedZone)) {
        zoneMap.set(normalizedZone, normalizedZone);
      }
    });
    
    // Convert map to array and sort
    const uniqueZones = Array.from(zoneMap.values()).sort();
    
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
    
    // ✅ Helper function
    const normalizeText = (text: string) => {
      if (!text) return '';
      return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    };
    
    const normalizedZone = normalizeText(zone);
    
    // Fetch all wards and filter by normalized zone name
    const allWards = (await ctx.db.query("wards").collect()) as WardDocument[];
    
    const wardsInZone = allWards.filter((ward: WardDocument) => 
      normalizeText(ward.zone) === normalizedZone
    );
    
    // Normalize district names and deduplicate
    const districtMap = new Map<string, string>();
    
    wardsInZone.forEach((ward: WardDocument) => {
      const normalizedDistrict = normalizeText(ward.district);
      if (!districtMap.has(normalizedDistrict)) {
        districtMap.set(normalizedDistrict, normalizedDistrict);
      }
    });
    
    const uniqueDistricts = Array.from(districtMap.values()).sort();
    
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
  handler: async (ctx: QueryCtx, { district }: { district?: string }) => {
    if (!district) return [];
    
    const normalizeText = (text: string) => {
      if (!text) return '';
      return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    };
    
    const normalizedDistrict = normalizeText(district);
    
    const allWards = (await ctx.db.query("wards").collect()) as WardDocument[];
    
    const wardsInDistrict = allWards.filter((ward: WardDocument) => 
      normalizeText(ward.district) === normalizedDistrict
    );
    
    // Normalize subdistrict names
    const subdistrictMap = new Map<string, string>();
    
    wardsInDistrict.forEach((ward: WardDocument) => {
      const normalizedSubdistrict = normalizeText(ward.subdistrict);
      if (!subdistrictMap.has(normalizedSubdistrict)) {
        subdistrictMap.set(normalizedSubdistrict, normalizedSubdistrict);
      }
    });
    
    const uniqueSubdistricts = Array.from(subdistrictMap.values()).sort();

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
    if (!subdistrict) {
      return [];
    }

    let wards = (await ctx.db
      .query("wards")
      .withIndex("by_subdistrict", (q: any) => q.eq("subdistrict", subdistrict))
      .collect()) as WardDocument[];

    // Apply filters
    if (localBodyType && localBodyType !== "All") {
      wards = wards.filter(
        (ward: WardDocument) =>
          ward.localBodyType.charAt(0).toUpperCase() === localBodyType
      );
    }

    if (searchText) {
      const search = searchText.toLowerCase();
      wards = wards.filter(
        (ward: WardDocument) =>
          ward.wardName.toLowerCase().includes(search) ||
          ward.localBodyName.toLowerCase().includes(search)
      );
    }

    // ✅ NEW: Calculate sponsorship status for each ward
    const currentTime = Date.now();
    const threeDaysInMs = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds

    const wardsWithSponsorshipStatus = await Promise.all(
      wards.map(async (ward: WardDocument) => {
        // Get all sponsorships that include this ward
        const allSponsorships = await ctx.db
          .query("sponsorships")
          .collect();

        let totalSponsoredExecutives = 0;
        let latestEndDate = 0;
        let isPending = false;

        allSponsorships.forEach((sponsorship: any) => {
          // ✅ Check if sponsorship is active OR pending (with 3-day lock)
          const isActiveLocked = 
            sponsorship.status === "active" || 
            (sponsorship.status === "pending" && 
             sponsorship._creationTime && 
             (currentTime - sponsorship._creationTime) < threeDaysInMs);

          if (!isActiveLocked) return;

          // Check if this sponsorship's cart contains our ward
          sponsorship.cart?.forEach((cartItem: any) => {
            const itemWard = cartItem.ward;
            
            // Match ward by name and local body
            const isMatchingWard = 
              itemWard?.wardName === ward.wardName &&
              itemWard?.localBodyName === ward.localBodyName;

            if (isMatchingWard) {
              totalSponsoredExecutives += cartItem.executivesSponsored || 0;
              
              // Track the latest end date
              let itemEndDate = 0;
              if (cartItem.endDate) {
                // Handle both ISO string and timestamp
                itemEndDate = typeof cartItem.endDate === 'string' 
                  ? new Date(cartItem.endDate).getTime()
                  : cartItem.endDate;
              }
              
              if (itemEndDate > latestEndDate) {
                latestEndDate = itemEndDate;
              }

              if (sponsorship.status === "pending") {
                isPending = true;
              }
            }
          });
        });

        const typeCode = ward.localBodyType.charAt(0).toUpperCase() as "P" | "M" | "C";
        
        // Determine max executives for this ward
        const maxExecutives = typeCode === 'C' ? 5 : typeCode === 'M' ? 3 : 1;

        return {
          _id: ward._id.toString(),
          wardName: ward.wardName,
          localBodyId: ward.localBodyName,
          localBodyName: ward.localBodyName,
          localBodyType: typeCode,
          type: (typeCode === "P" ? "Rural" : "Urban") as "Urban" | "Rural",
          districtName: ward.district,
          zoneName: ward.zone,
          isSponsored: totalSponsoredExecutives > 0,
          sponsoredUntil: latestEndDate,
          sponsoredExecutivesCount: totalSponsoredExecutives,
          availableExecutives: Math.max(0, maxExecutives - totalSponsoredExecutives),
          isPendingSponsorship: isPending,
        };
      })
    );

    return wardsWithSponsorshipStatus;
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