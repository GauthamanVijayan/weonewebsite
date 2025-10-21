export interface Zone {
  _id: string;
  name: string;
}

export interface District {
  _id: string;
  name: string;
  zoneId: string;
  zoneName?: string;
}

export interface LocalBody {
  _id: string;
  name: string;
  type: 'P' | 'M' | 'C';
  districtId: string;
  districtName?: string;
}

export interface Ward {
    _id: string;
    wardName: string;
    localBodyId: string;
    localBodyName: string;
    localBodyType: 'P' | 'M' | 'C';
    type: 'Urban' | 'Rural';
    districtName: string;
    zoneName: string;
    isSponsored: boolean; // ✅ Now properly calculated
    sponsoredUntil: number; // ✅ Latest end date of all sponsorships
    sponsoredExecutivesCount: number; // ✅ Total executives sponsored
    availableExecutives: number; // ✅ Remaining slots
    isPendingSponsorship?: boolean; // ✅ Has pending sponsorship (3-day lock)
}
export interface CartItem {
    ward: Ward;
    executivesSponsored: number;
    monthlyRate: number;
    costPerMonth: number;
    startDate: Date;
    endDate: Date;
    
    // Bulk properties
    isBulk?: boolean;
    bulkLevel?: 'state' | 'zone' | 'district' | 'subdistrict' | 'type' | 'localbody';
    bulkIdentifier?: string;
    bulkWardCount?: number;
    
    // NEW: Hierarchy tracking for conflict detection
    hierarchyData?: {
        state?: string;
        zone?: string;
        district?: string;
        subdistrict?: string;
        localBodyType?: string;
        localBodyName?: string;
    };
}

export interface SponsorType {
  label: string;
  value: 'individual' | 'company';
}