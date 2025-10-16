// in weone/src/app/pages/services/sponsor.service.ts

import { Injectable, signal, inject } from '@angular/core';
import { ConvexClient } from 'convex/browser';
import { environment } from 'src/environments/environment';

import {
    Zone,
    District,
    LocalBody,
    Ward
} from '../interfaces/sponsor.interface';
import { AuthService } from './auth.service';

@Injectable({
    providedIn: 'root'
})
export class ConvexService {
    private client = inject(ConvexClient); // Loading states
    private authService = inject(AuthService);

    zonesLoading = signal(false);
    districtsLoading = signal(false);
    subdistrictsLoading = signal(false); // RENAMED for clarity
    wardsLoading = signal(false); // Data signals

    zones = signal<Zone[]>([]);
    districts = signal<District[]>([]);
    subdistricts = signal<LocalBody[]>([]); // RENAMED for clarity
    wards = signal<Ward[]>([]);

    constructor() {
        this.loadZones();
    }

    async loadZones() {
        this.zonesLoading.set(true);
        try {
            // Correct, already using colon
            const zonesFromDB = await this.client.query('wards:getZones', {}); // --- FIX FOR DUPLICATE ZONES ---
            const uniqueZonesMap = new Map<string, Zone>();
            for (const zone of zonesFromDB) {
                const key = zone.name.toLowerCase(); // Use a lowercase key for matching
                if (!uniqueZonesMap.has(key)) {
                    uniqueZonesMap.set(key, zone);
                }
            }
            const uniqueZones = Array.from(uniqueZonesMap.values()); // --- END FIX ---
            this.zones.set(uniqueZones);
        } finally {
            this.zonesLoading.set(false);
        }
    }

    async loadDistrictsByZone(zoneName: string) {
        this.districtsLoading.set(true);
        this.clearDistricts();
        try {
            // 🎯 FIX: Changed dot (.) to colon (:)
            const districts = await this.client.query(
                'wards:getDistrictsByZone',
                { zone: zoneName }
            );
            this.districts.set(districts as District[]);
        } finally {
            this.districtsLoading.set(false);
        }
    } // UPDATED: Fetches subdistricts now

    async loadSubdistrictsByDistrict(districtName: string) {
        this.subdistrictsLoading.set(true);
        this.clearSubdistricts();
        try {
            // 🎯 FIX: Changed dot (.) to colon (:)
            const subdistricts = await this.client.query(
                'wards:getSubdistrictsByDistrict',
                { district: districtName }
            );
            this.subdistricts.set(subdistricts as LocalBody[]);
        } finally {
            this.subdistrictsLoading.set(false);
        }
    } // UPDATED: Fetches wards by subdistrict

    async loadWards(filters: {
        subdistrict: string;
        localBodyType: string;
        searchText: string;
    }) {
        this.wardsLoading.set(true);
        this.clearWards();
        try {
            // 🎯 FIX: Changed dot (.) to colon (:)
            const wards = await this.client.query('wards:getWards', filters);
            this.wards.set(wards);
        } catch (error) {
            console.error('Error loading wards:', error);
            this.wards.set([]);
        } finally {
            this.wardsLoading.set(false);
        }
    }
    private mapLocalBodyType(type: string): 'P' | 'M' | 'C' {
        const normalized = type.toLowerCase().trim();
        if (normalized.includes('panchay')) return 'P'; // Handles both "Panchayat" and "Panchayath"
        if (normalized.includes('munic')) return 'M';
        if (normalized.includes('corp')) return 'C'; // Fallback
        return 'P';
    }

    clearDistricts() {
        this.districts.set([]);
        this.clearSubdistricts();
    }

    clearSubdistricts() {
        this.subdistricts.set([]);
        this.clearWards();
    }

    clearWards() {
        this.wards.set([]);
    }
}
