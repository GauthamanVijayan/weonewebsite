import { Injectable, inject } from '@angular/core';
import { ConvexClient } from 'convex/browser';
import { AuthService } from './auth.service';
import { signal } from '@angular/core';

export interface SponsorshipFilters {
    searchText?: string;
    zone?: string;
    district?: string;
    subdistrict?: string;
    localBodyName?: string;
    status?: string;
}

@Injectable({
    providedIn: 'root'
})
export class SecureConvexService {
    private client: any = inject(ConvexClient);
    private authService = inject(AuthService);

    public sponsorships = signal<any[]>([]);
    public sponsorshipsLoading = signal(false);
    
    // ✅ NEW: Complete filter data from wards collection
    public zones = signal<any[]>([]);
    public districts = signal<any[]>([]);
    public subdistricts = signal<any[]>([]);
    public localBodies = signal<any[]>([]);
    public filtersLoading = signal(false);

    private currentFilters = signal<SponsorshipFilters>({});

    // ✅ Load complete filter data
    public async loadFilterData() {
        this.filtersLoading.set(true);
        try {
            // Load zones
            const zonesData = await this.client.query(
                "wards:getZones" as any,
                {}
            );
            this.zones.set(zonesData || []);

            console.log('✅ Filter data loaded:', {
                zones: zonesData?.length
            });
        } catch (error: any) {
            console.error("❌ Failed to load filter data:", error);
        } finally {
            this.filtersLoading.set(false);
        }
    }

    // ✅ Load districts for selected zone
    public async loadDistrictsByZone(zone: string) {
        try {
            const districtsData = await this.client.query(
                "wards:getDistrictsByZone" as any,
                { zone }
            );
            this.districts.set(districtsData || []);
        } catch (error: any) {
            console.error("❌ Failed to load districts:", error);
            this.districts.set([]);
        }
    }

    // ✅ Load subdistricts for selected district
    public async loadSubdistrictsByDistrict(district: string) {
        try {
            const subdistrictsData = await this.client.query(
                "wards:getSubdistrictsByDistrict" as any,
                { district }
            );
            this.subdistricts.set(subdistrictsData || []);
        } catch (error: any) {
            console.error("❌ Failed to load subdistricts:", error);
            this.subdistricts.set([]);
        }
    }

    // ✅ Load local bodies for selected subdistrict
    public async loadLocalBodiesInSubdistrict(subdistrict: string) {
        try {
            // Get all local bodies in subdistrict (all types)
            const allWards = await this.client.query(
                "wards:getWardsBySubdistrict" as any,
                { subdistrict }
            );
            
            // Extract unique local bodies
            const uniqueLocalBodies = new Set<string>();
            allWards?.forEach((ward: any) => {
                if (ward.localBodyName) {
                    uniqueLocalBodies.add(ward.localBodyName);
                }
            });
            
            const localBodiesArray = Array.from(uniqueLocalBodies).sort().map((name, index) => ({
                _id: `lb-${index}`,
                name
            }));
            
            this.localBodies.set(localBodiesArray);
        } catch (error: any) {
            console.error("❌ Failed to load local bodies:", error);
            this.localBodies.set([]);
        }
    }

    public async loadMySponsorships(filters?: SponsorshipFilters) {
        this.sponsorshipsLoading.set(true);
        try {
            const userId = this.authService.getUserId();
            
            if (!userId) {
                throw new Error("Not authenticated. Please log in.");
            }

            const appliedFilters = filters || this.currentFilters();
            this.currentFilters.set(appliedFilters);

            console.log('🔍 Loading sponsorships with filters:', appliedFilters);
            
            const data = await this.client.query(
                "sponsorships:getAllSponsorshipsForAdmin" as any,
                { 
                    userId,
                    ...appliedFilters
                }
            );
            
            console.log('✅ Sponsorships loaded:', data);
            this.sponsorships.set(data || []);
        } catch (error: any) {
            console.error("❌ Failed to load sponsorships:", error);
            this.sponsorships.set([]);
        } finally {
            this.sponsorshipsLoading.set(false);
        }
    }

    public async cancelSponsorship(sponsorshipId: string): Promise<any> {
        const userId = this.authService.getUserId();
        
        if (!userId) {
            throw new Error("Not authenticated. Please log in.");
        }

        return this.client.mutation(
            "sponsorships:cancelSponsorship" as any,
            { sponsorshipId, userId }
        );
    }
}