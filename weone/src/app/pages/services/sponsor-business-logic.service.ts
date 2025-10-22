import { Injectable } from '@angular/core';
import { CartItem, Ward, LocalBody, Zone, District } from '../interfaces/sponsor.interface';
import { SPONSOR_CONFIG, LOCAL_BODY_TYPE_LABELS } from '../constants/sponsor.constants';

export interface ConflictResult {
    hasConflict: boolean;
    conflictMessage: string;
    conflictingItem?: CartItem;
}

export interface OverlapResult {
    hasOverlap: boolean;
    message: string;
    conflictingWards?: string[];
}

export interface HierarchyData {
    state?: string;
    zone?: string;
    district?: string;
    subdistrict?: string;
    localBodyType?: 'P' | 'M' | 'C';
    localBodyName?: string;
}

@Injectable({
    providedIn: 'root'
})
export class SponsorBusinessLogicService {
    /**
     * Get maximum executives allowed for a local body type
     */
    getMaxExecutives(type: 'P' | 'M' | 'C' | 'All'): number {
        if (type === 'All') {
            return Math.max(...Object.values(SPONSOR_CONFIG.MAX_EXECUTIVES));
        }
        return SPONSOR_CONFIG.MAX_EXECUTIVES[type];
    }

    /**
     * Calculate monthly rate (base rate per executive)
     */
    getMonthlyRate(): number {
        return SPONSOR_CONFIG.RATE_PER_EXECUTIVE;
    }

    /**
     * Calculate cost per month based on number of executives
     */
    calculateCostPerMonth(executives: number): number {
        return executives * SPONSOR_CONFIG.RATE_PER_EXECUTIVE;
    }

    /**
     * Calculate total cost for entire sponsorship period
     */
    calculateTotalCost(executives: number, months: number): number {
        return this.calculateCostPerMonth(executives) * months;
    }

    /**
     * Calculate cost based on number of executives (legacy - use calculateCostPerMonth)
     */
    calculateCost(executives: number): number {
        return this.calculateCostPerMonth(executives);
    }

    /**
     * Calculate total executives for selected wards
     */
    calculateTotalExecutives(wards: Ward[], executivesPerWard: number): number {
        return wards.length * executivesPerWard;
    }

    /**
     * Calculate total cost for cart
     */
    calculateCartTotal(cartItems: CartItem[]): number {
        return cartItems.reduce((sum, item) => {
            const cost = this.calculateCost(item.executivesSponsored);
            return sum + cost;
        }, 0);
    }

    /**
     * Calculate total executives in cart
     */
    calculateCartExecutivesTotal(cartItems: CartItem[]): number {
        return cartItems.reduce((sum, item) => sum + item.executivesSponsored, 0);
    }

    /**
     * Get local body type label
     */
    getLocalBodyTypeLabel(type: 'P' | 'M' | 'C' | 'All'): string {
        return LOCAL_BODY_TYPE_LABELS[type] || type;
    }

    /**
     * Map local body type string to code
     */
    mapLocalBodyType(type: string): 'P' | 'M' | 'C' {
        const normalized = type.toLowerCase().trim();
        if (normalized.includes('panchay')) return 'P';
        if (normalized.includes('munic')) return 'M';
        if (normalized.includes('corp')) return 'C';
        return 'P'; // Default fallback
    }

    /**
     * Build hierarchy data based on selection level
     */
    buildHierarchyData(
        level: 'state' | 'zone' | 'district' | 'subdistrict' | 'type' | 'localbody',
        selections: {
            zone?: Zone | null;
            district?: District | null;
            subdistrict?: LocalBody | null;
            localBodyType?: 'All' | 'P' | 'M' | 'C';
            localBody?: LocalBody | null;
        }
    ): HierarchyData {
        const hierarchy: HierarchyData = {
            state: 'Kerala' // Always Kerala for this app
        };

        if (level === 'state') {
            return hierarchy;
        }

        if (selections.zone) {
            hierarchy.zone = selections.zone.name;
        }

        if (level === 'zone') {
            return hierarchy;
        }

        if (selections.district) {
            hierarchy.district = selections.district.name;
        }

        if (level === 'district') {
            return hierarchy;
        }

        if (selections.subdistrict) {
            hierarchy.subdistrict = selections.subdistrict.name;
        }

        if (level === 'subdistrict') {
            return hierarchy;
        }

        if (selections.localBodyType && selections.localBodyType !== 'All') {
            hierarchy.localBodyType = selections.localBodyType;
        }

        if (level === 'type') {
            return hierarchy;
        }

        if (selections.localBody) {
            hierarchy.localBodyName = selections.localBody.name;
        }

        return hierarchy;
    }

    /**
     * Check for hierarchy conflicts in cart
     */
    checkHierarchyConflict(
        newLevel: 'state' | 'zone' | 'district' | 'subdistrict' | 'type' | 'localbody',
        newHierarchy: HierarchyData,
        existingCartItems: CartItem[]
    ): ConflictResult {
        for (const item of existingCartItems) {
            if (!item.isBulk || !item.bulkLevel) {
                continue; // Skip individual ward items
            }

            const existingHierarchy = item.hierarchyData || {};

            // STATE level conflicts
            if (item.bulkLevel === 'state') {
                return {
                    hasConflict: true,
                    conflictMessage: `Cannot add ${newLevel} selection. Entire state of Kerala is already in cart.`,
                    conflictingItem: item
                };
            }

            if (newLevel === 'state') {
                return {
                    hasConflict: true,
                    conflictMessage: `Cannot add entire state. Cart already contains ${item.bulkLevel} level selection.`,
                    conflictingItem: item
                };
            }

            // ZONE level conflicts
            if (
                item.bulkLevel === 'zone' &&
                existingHierarchy.zone === newHierarchy.zone
            ) {
                return {
                    hasConflict: true,
                    conflictMessage: `Cannot add ${newLevel} selection. Zone "${existingHierarchy.zone}" is already in cart.`,
                    conflictingItem: item
                };
            }

            if (
                newLevel === 'zone' &&
                newHierarchy.zone === existingHierarchy.zone
            ) {
                return {
                    hasConflict: true,
                    conflictMessage: `Cannot add zone "${newHierarchy.zone}". Cart already contains ${item.bulkLevel} level selection from this zone.`,
                    conflictingItem: item
                };
            }

            // DISTRICT level conflicts
            if (
                item.bulkLevel === 'district' &&
                existingHierarchy.district === newHierarchy.district
            ) {
                return {
                    hasConflict: true,
                    conflictMessage: `Cannot add ${newLevel} selection. District "${existingHierarchy.district}" is already in cart.`,
                    conflictingItem: item
                };
            }

            if (
                newLevel === 'district' &&
                newHierarchy.district === existingHierarchy.district
            ) {
                return {
                    hasConflict: true,
                    conflictMessage: `Cannot add district "${newHierarchy.district}". Cart already contains ${item.bulkLevel} level selection from this district.`,
                    conflictingItem: item
                };
            }

            // SUBDISTRICT level conflicts
            if (
                item.bulkLevel === 'subdistrict' &&
                existingHierarchy.subdistrict === newHierarchy.subdistrict
            ) {
                return {
                    hasConflict: true,
                    conflictMessage: `Cannot add ${newLevel} selection. Subdistrict "${existingHierarchy.subdistrict}" is already in cart.`,
                    conflictingItem: item
                };
            }

            if (
                newLevel === 'subdistrict' &&
                newHierarchy.subdistrict === existingHierarchy.subdistrict
            ) {
                return {
                    hasConflict: true,
                    conflictMessage: `Cannot add subdistrict "${newHierarchy.subdistrict}". Cart already contains ${item.bulkLevel} level selection from this subdistrict.`,
                    conflictingItem: item
                };
            }

            // TYPE level conflicts (same subdistrict + same type)
            if (
                item.bulkLevel === 'type' &&
                existingHierarchy.subdistrict === newHierarchy.subdistrict &&
                existingHierarchy.localBodyType === newHierarchy.localBodyType
            ) {
                return {
                    hasConflict: true,
                    conflictMessage: `Cannot add ${newLevel} selection. ${this.getLocalBodyTypeLabel(existingHierarchy.localBodyType as any)}s in ${existingHierarchy.subdistrict} are already in cart.`,
                    conflictingItem: item
                };
            }

            // LOCAL BODY conflicts (exact match on subdistrict + type + name)
            if (
                item.bulkLevel === 'localbody' &&
                existingHierarchy.subdistrict === newHierarchy.subdistrict &&
                existingHierarchy.localBodyType === newHierarchy.localBodyType &&
                existingHierarchy.localBodyName === newHierarchy.localBodyName
            ) {
                return {
                    hasConflict: true,
                    conflictMessage: `Cannot add. Local body "${existingHierarchy.localBodyName}" in ${existingHierarchy.subdistrict} is already in cart.`,
                    conflictingItem: item
                };
            }
        }

        return { hasConflict: false, conflictMessage: '' };
    }

    /**
     * Check if a single ward has date overlap with cart items
     */
    checkWardOverlap(
        wardId: string,
        newStartDate: Date,
        newEndDate: Date,
        cartItems: CartItem[]
    ): OverlapResult {
        const existingItem = cartItems.find(
            (item) => !item.isBulk && item.ward?._id === wardId
        );

        if (!existingItem) {
            return { hasOverlap: false, message: '' };
        }

        const existingStart = existingItem.startDate.getTime();
        const existingEnd = existingItem.endDate.getTime();
        const newStart = newStartDate.getTime();
        const newEnd = newEndDate.getTime();

        // Check if dates overlap
        const hasOverlap = newStart <= existingEnd && newEnd >= existingStart;

        if (hasOverlap) {
            return {
                hasOverlap: true,
                message: `This ward is already in your cart with sponsorship from ${existingItem.startDate.toLocaleDateString()} to ${existingItem.endDate.toLocaleDateString()}. Please choose different dates or remove the existing item first.`
            };
        }

        return { hasOverlap: false, message: '' };
    }

    /**
     * Check if bulk selection has overlapping dates with existing cart items
     */
    checkBulkOverlap(
        wards: Ward[],
        newStartDate: Date,
        newEndDate: Date,
        cartItems: CartItem[]
    ): OverlapResult {
        const conflictingWards: string[] = [];

        for (const ward of wards) {
            const overlap = this.checkWardOverlap(
                ward._id,
                newStartDate,
                newEndDate,
                cartItems
            );
            if (overlap.hasOverlap) {
                conflictingWards.push(ward.wardName);
            }
        }

        if (conflictingWards.length > 0) {
            return {
                hasOverlap: true,
                message: `${conflictingWards.length} ward(s) already in cart with overlapping dates: ${conflictingWards.slice(0, 3).join(', ')}${conflictingWards.length > 3 ? '...' : ''}`,
                conflictingWards
            };
        }

        return { hasOverlap: false, message: '', conflictingWards: [] };
    }

    /**
     * Calculate end date based on start date and months
     */
    calculateEndDate(startDate: Date, months: number): Date {
        const endDate = new Date(startDate);
        endDate.setMonth(startDate.getMonth() + months);
        return endDate;
    }

    /**
     * Calculate months between two dates
     */
    calculateMonthsBetween(startDate: Date, endDate: Date): number {
        const yearsDiff = endDate.getFullYear() - startDate.getFullYear();
        const monthsDiff = endDate.getMonth() - startDate.getMonth();
        return yearsDiff * 12 + monthsDiff;
    }

    /**
     * Validate sponsor form data
     */
    validateSponsorForm(data: {
        sponsorName: string;
        sponsorEmail: string;
        cartItems: CartItem[];
    }): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!data.sponsorName?.trim()) {
            errors.push('Sponsor name is required');
        }

        if (!data.sponsorEmail?.trim()) {
            errors.push('Email address is required');
        } else if (!this.isValidEmail(data.sponsorEmail)) {
            errors.push('Please enter a valid email address');
        }

        if (data.cartItems.length === 0) {
            errors.push('Cart is empty. Please add wards to sponsor');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate email format
     */
    private isValidEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Generate cart item ID
     */
    generateCartItemId(): string {
        return `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Calculate minimum allowed executives for selected wards
     */
    calculateMinExecutives(wards: Ward[]): number {
        if (wards.length === 0) {
            return 1;
        }

        const maxValues = wards.map((ward) =>
            this.getMaxExecutives(ward.localBodyType as 'P' | 'M' | 'C')
        );

        return Math.min(...maxValues);
    }

    /**
     * Format currency in INR
     */
    formatCurrency(amount: number): string {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    }
}