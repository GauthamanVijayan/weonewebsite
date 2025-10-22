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
    wardNumber?: string;
    localBodyId: string;
    localBodyName: string;
    localBodyType: 'P' | 'M' | 'C';
    type: 'Urban' | 'Rural';
    districtName: string;
    zoneName: string;
    isSponsored: boolean;
    sponsoredUntil: number; // Timestamp
    sponsoredExecutivesCount: number;
    availableExecutives: number;
    isPendingSponsorship?: boolean;
}

export interface CartItem {
    id: string;
    ward?: Ward; // Optional for bulk items
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
    displayName?: string; // For bulk items
    
    // Hierarchy tracking for conflict detection
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

export interface BulkSponsorshipData {
    level: 'state' | 'zone' | 'district' | 'subdistrict' | 'type' | 'localbody';
    identifier: string;
    wardCount: number;
    estimatedCost: number;
    hasSponsoredWards?: boolean;
    sponsoredWardsCount?: number;
}