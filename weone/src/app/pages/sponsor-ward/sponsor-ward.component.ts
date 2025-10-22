import { CommonModule, CurrencyPipe } from '@angular/common';
import {
    Component,
    ChangeDetectionStrategy,
    inject,
    signal,
    computed,
    effect
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { DatePickerModule, DatePicker } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

import {
    Zone,
    District,
    LocalBody,
    CartItem,
    Ward,
    BulkSponsorshipData
} from '../interfaces/sponsor.interface';
import { PaymentService } from '../services/payment.service';
import { SponsorBusinessLogicService } from '../services/sponsor-business-logic.service';
import { ValidationService } from '../services/validation.service';
import { ScrollAnimateDirective } from '../shared/scroll-animate.directive';
import {
    LOCAL_BODY_TYPE_OPTIONS,
    SPONSOR_CONFIG,
    TOAST_MESSAGES,
    ERROR_MESSAGES
} from '../constants/sponsor.constants';
import { SponsorService } from '../services/sponsor.service';

@Component({
    selector: 'app-sponsor-ward',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        CurrencyPipe,
        TableModule,
        ButtonModule,
        Select,
        DialogModule,
        InputNumberModule,
        InputTextModule,
        SelectButtonModule,
        ScrollAnimateDirective,
        DatePicker,
        ToastModule
    ],
    providers: [MessageService],
    templateUrl: './sponsor-ward.component.html',
    styleUrl: './sponsor-ward.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SponsorWardComponent {
    // Services
    sponsor = inject(SponsorService);
    private paymentService = inject(PaymentService);
    private businessLogic = inject(SponsorBusinessLogicService);
    private validationService = inject(ValidationService);
    private messageService = inject(MessageService);
    private router = inject(Router);

    // Constants
    readonly RATE_PER_EXECUTIVE = SPONSOR_CONFIG.RATE_PER_EXECUTIVE;
readonly localBodyTypeOptions = LOCAL_BODY_TYPE_OPTIONS as any;
    readonly today = new Date();
    readonly sponsorTypeOptions = signal([
        { label: 'Individual', value: 'individual' as const },
        { label: 'Company', value: 'company' as const }
    ]);

    // Selection State
    selectedZone = signal<Zone | null>(null);
    selectedDistrict = signal<District | null>(null);
    selectedSubdistrict = signal<LocalBody | null>(null);
    selectedLocalBody = signal<LocalBody | null>(null);
    selectedLocalBodyType = signal<'All' | 'P' | 'M' | 'C'>('All');
    selectedWards = signal<Ward[]>([]);
    searchText = signal('');

    // Bulk Selection State
    bulkSelectionLevel = signal<
        | 'state'
        | 'zone'
        | 'district'
        | 'subdistrict'
        | 'type'
        | 'localbody'
        | null
    >(null);
    bulkSponsorshipData = signal<BulkSponsorshipData | null>(null);
    bulkHasSponsoredWards = signal(false);
    bulkSponsoredWardsCount = signal(0);
    bulkTotalWardsCount = signal(0);
    bulkSponsoredExecutivesCount = signal(1);
    bulkSponsorshipStartDate = signal<Date | null>(null);
    bulkSponsorshipMonths = signal(1);
    isBulkSponsorDialogVisible = signal(false);

    // Cart State
    cartItems = signal<CartItem[]>([]);
    cartMessage = signal<string | null>(null);
    cartMessageTimeout: any = null;

    // Sponsor Form State
    sponsorType = signal<'individual' | 'company'>('individual');
    sponsorName = signal('');
    sponsorEmail = signal('');
    isProcessing = signal(false);

    // Individual Ward Sponsorship State
    isVolunteerDialogVisible = signal(false);
    selectedWardForSponsorship = signal<Ward | null>(null);
    sponsoredExecutivesCount = signal(1);
    sponsorshipStartDate = signal<Date | null>(null);
    sponsorshipEndDate = signal<Date | null>(null);
    sponsorshipMonths = signal(1);

    // Computed Values
    zones = this.sponsor.zones;
    districts = this.sponsor.districts;
    subDistricts = this.sponsor.subdistricts;
    wards = this.sponsor.wards;
    
    zonesLoading = this.sponsor.zonesLoading;
    districtsLoading = this.sponsor.districtsLoading;
    subdistrictsLoading = this.sponsor.subdistrictsLoading;
    wardsLoading = this.sponsor.wardsLoading;

    filteredWards = computed(() => {
        const search = this.searchText().toLowerCase();
        const allWards = this.wards();
        
        if (!search) return allWards;
        
        return allWards.filter(ward =>
            ward.wardName.toLowerCase().includes(search) ||
            (ward.wardNumber && ward.wardNumber.toString().includes(search)) ||
            ward.localBodyName.toLowerCase().includes(search)
        );
    });

    // Display computeds for bulk selection
    displayedWardCount = computed(() => {
        const data = this.bulkSponsorshipData();
        return data ? data.wardCount : this.selectedWards().length;
    });

    estimatedCostDescription = computed(() => {
        const data = this.bulkSponsorshipData();
        if (!data) return '';
        
        if (data.hasSponsoredWards) {
            return `Includes ${data.sponsoredWardsCount} sponsored/locked wards that will be queued.`;
        }
        return `All wards available for immediate sponsorship.`;
    });

    // Cart calculations
    subtotal = computed(() => {
        return this.cartItems().reduce((sum, item) => sum + item.monthlyRate, 0);
    });

    gst = computed(() => this.subtotal() * 0.18);
    
    total = computed(() => this.subtotal() + this.gst());
    
    walletBonus = computed(() => this.subtotal() * 3);

    // Bulk calculations
    bulkSelectedExecutivesTotal = computed(() => {
        const selectedCount = this.selectedWards().length;
        return selectedCount * this.bulkSponsoredExecutivesCount();
    });

    bulkSelectionCost = computed(() =>
        this.businessLogic.calculateCostPerMonth(this.bulkSelectedExecutivesTotal())
    );

    bulkMaxExecutives = computed(() => {
        const wards = this.selectedWards();
        if (wards.length === 0) return SPONSOR_CONFIG.MAX_EXECUTIVES.C;
        return this.businessLogic.calculateMinExecutives(wards);
    });

    bulkSponsorshipEndDate = computed<Date | null>(() => {
        const startDate = this.bulkSponsorshipStartDate();
        const months = this.bulkSponsorshipMonths();
        if (!startDate || months < 1) return null;
        return this.businessLogic.calculateEndDate(startDate, months);
    });

    // Individual ward calculations
    maxExecutives = computed(() => {
        const ward = this.selectedWardForSponsorship();
        if (!ward) return SPONSOR_CONFIG.MAX_EXECUTIVES.C;
        return this.businessLogic.getMaxExecutives(
            ward.localBodyType as 'P' | 'M' | 'C'
        );
    });

    // Dropdown disable state
    areDropdownsDisabled = computed(() => this.bulkSelectionLevel() !== null);
    
    stateOrZoneSelected = computed(() => {
        const level = this.bulkSelectionLevel();
        return level === 'state' || level === 'zone';
    });

    districtOrAboveSelected = computed(() => {
        const level = this.bulkSelectionLevel();
        return level === 'state' || level === 'zone' || level === 'district';
    });

    // Form validation
    isFormValid = computed(() => {
        return (
            this.sponsorName().trim().length > 0 &&
            this.sponsorEmail().trim().length > 0 &&
            this.validationService.isValidEmail(this.sponsorEmail()) &&
            this.cartItems().length > 0
        );
    });

    // Select all label
    selectAllByTypeLabel = computed(() => {
        const type = this.selectedLocalBodyType();
        if (type === 'All') return 'Select Type First';
        const label = this.businessLogic.getLocalBodyTypeLabel(type);
        return `Select All ${label}s`;
    });

    // Effects
    constructor() {
        // Watch for month changes in individual sponsorship
        effect(() => {
            const startDate = this.sponsorshipStartDate();
            const months = this.sponsorshipMonths();
            if (startDate && months >= 1) {
                const endDate = this.businessLogic.calculateEndDate(startDate, months);
                this.sponsorshipEndDate.set(endDate);
            }
        });

        // Auto-set start date for fully sponsored wards
        effect(() => {
            const ward = this.selectedWardForSponsorship();
            if (ward && ward.isSponsored && ward.availableExecutives === 0) {
                // Ward is fully sponsored/locked - queue after expiry
                const expiryDate = new Date(ward.sponsoredUntil);
                expiryDate.setDate(expiryDate.getDate() + 1); // Day after expiry
                this.sponsorshipStartDate.set(expiryDate);
            } else if (ward) {
                // Ward available - can start today or later
                this.sponsorshipStartDate.set(new Date());
            }
        });
    }

    // Selection Handlers
    onZoneChange(event: any) {
        const zone = event.value;
        this.selectedZone.set(zone);
        this.selectedDistrict.set(null);
        this.selectedSubdistrict.set(null);
        this.selectedLocalBody.set(null);
        this.sponsor.clearDistricts();
        
        if (zone) {
            this.sponsor.loadDistrictsByZone(zone.name);
        }
    }

    onDistrictChange(event: any) {
        const district = event.value;
        this.selectedDistrict.set(district);
        this.selectedSubdistrict.set(null);
        this.selectedLocalBody.set(null);
        this.sponsor.clearSubdistricts();
        
        if (district) {
            this.sponsor.loadSubdistrictsByDistrict(district.name);
        }
    }

    onSubdistrictChange(event: any) {
        const subdistrict = event.value;
        this.selectedSubdistrict.set(subdistrict);
        this.selectedLocalBody.set(null);
        this.sponsor.clearWards();
        
        if (subdistrict) {
            this.loadWards();
        }
    }

    onLocalBodyTypeChange() {
        this.selectedLocalBody.set(null);
        
        const subdistrict = this.selectedSubdistrict();
        const type = this.selectedLocalBodyType();
        
        if (subdistrict && type !== 'All') {
            this.sponsor.loadLocalBodies(subdistrict.name, type);
        } else {
            this.sponsor.clearLocalBodies();
        }
        
        this.loadWards();
    }

    onLocalBodyChange(event: any) {
        const localBody = event.value;
        this.selectedLocalBody.set(localBody);
        this.loadWards();
    }

    onSelectionChange() {
        // Called when table selection changes
        console.log('Selected wards:', this.selectedWards().length);
    }

    // Data Loading
    loadWards() {
        const subdistrict = this.selectedSubdistrict();
        const localBodyType = this.selectedLocalBodyType();
        
        if (!subdistrict) return;

        this.sponsor.loadWards({
            subdistrict: subdistrict.name,
            localBodyType: localBodyType === 'All' ? '' : localBodyType,
            searchText: this.searchText()
        });
    }

    // Bulk Selection Methods
    async selectAllWardsInState() {
        try {
            const summary = await this.sponsor.client.query(
                'wards:getStateSummary',
                {}
            );

            this.bulkSelectionLevel.set('state');
            this.bulkSponsorshipData.set({
                level: 'state',
                identifier: 'Kerala',
                wardCount: summary.totalWards,
                estimatedCost: summary.estimatedCost,
                hasSponsoredWards: summary.hasSponsoredWards || false,
                sponsoredWardsCount: summary.sponsoredWardsCount || 0
            });

            this.bulkHasSponsoredWards.set(summary.hasSponsoredWards || false);
            this.bulkSponsoredWardsCount.set(summary.sponsoredWardsCount || 0);
            this.bulkTotalWardsCount.set(summary.totalWards);

            this.selectedWards.set([]);
            
            this.messageService.add({
                severity: 'info',
                summary: 'State Selected',
                detail: `All ${summary.totalWards} wards in Kerala selected`,
                life: 3000
            });
        } catch (error) {
            console.error('Failed to select state:', error);
        }
    }

    async selectAllWardsInZone() {
        const zone = this.selectedZone();
        if (!zone) {
            this.messageService.add({
                severity: 'warn',
                summary: 'No Zone Selected',
                detail: 'Please select a zone first',
                life: 3000
            });
            return;
        }

        try {
            const summary = await this.sponsor.client.query(
                'wards:getZoneSummary',
                { zone: zone.name }
            );

            this.bulkSelectionLevel.set('zone');
            this.bulkSponsorshipData.set({
                level: 'zone',
                identifier: zone.name,
                wardCount: summary.totalWards,
                estimatedCost: summary.estimatedCost,
                hasSponsoredWards: summary.hasSponsoredWards || false,
                sponsoredWardsCount: summary.sponsoredWardsCount || 0
            });

            this.bulkHasSponsoredWards.set(summary.hasSponsoredWards || false);
            this.bulkSponsoredWardsCount.set(summary.sponsoredWardsCount || 0);
            this.bulkTotalWardsCount.set(summary.totalWards);

            this.selectedWards.set([]);
            
            this.messageService.add({
                severity: 'info',
                summary: 'Zone Selected',
                detail: `All ${summary.totalWards} wards in ${zone.name} selected`,
                life: 3000
            });
        } catch (error) {
            console.error('Failed to select zone:', error);
        }
    }

    async selectAllWardsInDistrict() {
        const district = this.selectedDistrict();
        if (!district) {
            this.messageService.add({
                severity: 'warn',
                summary: 'No District Selected',
                detail: 'Please select a district first',
                life: 3000
            });
            return;
        }

        try {
            const summary = await this.sponsor.client.query(
                'wards:getDistrictSummary',
                { district: district.name }
            );

            this.bulkSelectionLevel.set('district');
            this.bulkSponsorshipData.set({
                level: 'district',
                identifier: district.name,
                wardCount: summary.totalWards,
                estimatedCost: summary.estimatedCost,
                hasSponsoredWards: summary.hasSponsoredWards || false,
                sponsoredWardsCount: summary.sponsoredWardsCount || 0
            });

            this.bulkHasSponsoredWards.set(summary.hasSponsoredWards || false);
            this.bulkSponsoredWardsCount.set(summary.sponsoredWardsCount || 0);
            this.bulkTotalWardsCount.set(summary.totalWards);

            this.selectedWards.set([]);
            
            this.messageService.add({
                severity: 'info',
                summary: 'District Selected',
                detail: `All ${summary.totalWards} wards in ${district.name} selected`,
                life: 3000
            });
        } catch (error) {
            console.error('Failed to select district:', error);
        }
    }

  

 // 1. For Subdistrict - NO SUMMARY EXISTS, use getWardsBySubdistrict
async selectAllWardsInSubdistrict() {
    const subdistrict = this.selectedSubdistrict();
    if (!subdistrict) return;

    try {
        const wards = await this.sponsor.client.query(
            'wards:getWardsBySubdistrict',
            { subdistrict: subdistrict.name }
        );

        this.bulkSelectionLevel.set('subdistrict');
        this.bulkSponsorshipData.set({
            level: 'subdistrict',
            identifier: subdistrict.name,
            wardCount: wards.length,
            estimatedCost: wards.length * 15000,
            hasSponsoredWards: false,
            sponsoredWardsCount: 0
        });

        this.bulkHasSponsoredWards.set(false);
        this.bulkSponsoredWardsCount.set(0);
        this.bulkTotalWardsCount.set(wards.length);

        this.selectedWards.set([]);
    } catch (error) {
        console.error('Failed to select subdistrict:', error);
    }
}

// 2. For Type - CORRECT QUERY EXISTS
async selectAllWardsByType() {
    const subdistrict = this.selectedSubdistrict();
    const type = this.selectedLocalBodyType();
    
    if (!subdistrict || type === 'All') return;

    try {
        const summary = await this.sponsor.client.query(
            'wards:getWardsSummaryBySubdistrictAndType',
            { subdistrict: subdistrict.name, localBodyType: type }  // ✅ Changed 'type' to 'localBodyType'
        );

        this.bulkSelectionLevel.set('type');
        this.bulkSponsorshipData.set({
            level: 'type',
            identifier: `${subdistrict.name} - ${this.businessLogic.getLocalBodyTypeLabel(type)}`,
            wardCount: summary.totalWards,
            estimatedCost: summary.estimatedCost,
            hasSponsoredWards: false,
            sponsoredWardsCount: 0
        });

        this.bulkHasSponsoredWards.set(false);
        this.bulkSponsoredWardsCount.set(0);
        this.bulkTotalWardsCount.set(summary.totalWards);

        this.selectedWards.set([]);
    } catch (error) {
        console.error('Failed to select by type:', error);
    }
}

async selectAllWardsInLocalBody() {
    const localBody = this.selectedLocalBody();
    if (!localBody) return;

    try {
        // ✅ Use getLocalBodyWardCount with localBodyName
        const summary = await this.sponsor.client.query(
            'wards:getLocalBodyWardCount',
            { localBodyName: localBody.name }  // ✅ Correct field name
        );

        this.bulkSelectionLevel.set('localbody');
        this.bulkSponsorshipData.set({
            level: 'localbody',
            identifier: localBody.name,
            wardCount: summary.totalWards,
            estimatedCost: summary.estimatedCost,
            hasSponsoredWards: false,
            sponsoredWardsCount: 0
        });

        this.bulkHasSponsoredWards.set(false);
        this.bulkSponsoredWardsCount.set(0);
        this.bulkTotalWardsCount.set(summary.totalWards);

        this.selectedWards.set([]);
    } catch (error) {
        console.error('Failed to select local body:', error);
    }
}
    // Clear selection methods
    clearStateSelection() {
        this.bulkSelectionLevel.set(null);
        this.bulkSponsorshipData.set(null);
        this.bulkHasSponsoredWards.set(false);
        this.bulkSponsoredWardsCount.set(0);
        this.bulkTotalWardsCount.set(0);
        this.selectedWards.set([]);
    }

    clearZoneSelection() {
        this.clearStateSelection();
    }

    clearDistrictSelection() {
        this.clearStateSelection();
    }

    clearSubdistrictSelection() {
        this.clearStateSelection();
    }

    clearTypeSelection() {
        this.clearStateSelection();
    }

    clearLocalBodySelection() {
        this.clearStateSelection();
    }

    clearBulkSelection() {
        this.clearStateSelection();
    }

    // Individual Ward Sponsorship
    openVolunteerDialog(ward: Ward) {
        this.selectedWardForSponsorship.set(ward);
        this.sponsoredExecutivesCount.set(1);
        this.sponsorshipMonths.set(1);
        this.isVolunteerDialogVisible.set(true);
    }

    addToCart() {
        const ward = this.selectedWardForSponsorship();
        const startDate = this.sponsorshipStartDate();
        const endDate = this.sponsorshipEndDate();
        const executivesCount = this.sponsoredExecutivesCount();

        if (!ward || !startDate || !endDate) {
            this.messageService.add({
                ...TOAST_MESSAGES.VALIDATION_ERROR,
                detail: ERROR_MESSAGES.INVALID_DATES
            });
            return;
        }

        // Validate
        const validation = this.validationService.validateWardSponsorship({
            executivesSponsored: executivesCount,
            maxExecutives: ward.availableExecutives > 0 ? ward.availableExecutives : this.maxExecutives(),
            startDate,
            endDate
        });

        if (!validation.isValid) {
            this.messageService.add({
                ...TOAST_MESSAGES.VALIDATION_ERROR,
                detail: validation.errors.join('. ')
            });
            return;
        }

        // Check for overlap
        const overlapCheck = this.businessLogic.checkWardOverlap(
            ward._id,
            startDate,
            endDate,
            this.cartItems()
        );

        if (overlapCheck.hasOverlap) {
            this.messageService.add({
                ...TOAST_MESSAGES.CONFLICT_ERROR,
                detail: overlapCheck.message
            });
            return;
        }

        // Add to cart
        const cartItem: CartItem = {
            id: this.businessLogic.generateCartItemId(),
            ward: ward,
            executivesSponsored: executivesCount,
            monthlyRate: this.businessLogic.getMonthlyRate(),
            costPerMonth: this.businessLogic.calculateCostPerMonth(executivesCount),
            startDate: startDate,
            endDate: endDate,
            isBulk: false
        };

        this.cartItems.update(items => [...items, cartItem]);
        
        const isQueued = ward.availableExecutives === 0;
        this.messageService.add({
            ...TOAST_MESSAGES.CART_ADDED,
            detail: isQueued 
                ? `${ward.wardName} queued in cart (starts after current sponsorship)`
                : `${ward.wardName} added to cart`
        });

        this.isVolunteerDialogVisible.set(false);
    }

    // Bulk Sponsorship
    openBulkSponsorDialog() {
        const wards = this.selectedWards();
        const bulkData = this.bulkSponsorshipData();

        if (wards.length === 0 && !bulkData) {
            this.messageService.add({
                severity: 'warn',
                summary: 'No Selection',
                detail: 'Please select wards or use bulk selection',
                life: 3000
            });
            return;
        }

        this.bulkSponsoredExecutivesCount.set(1);
        this.bulkSponsorshipStartDate.set(new Date());
        this.bulkSponsorshipMonths.set(1);
        this.isBulkSponsorDialogVisible.set(true);
    }

    addSelectedWardsToCart() {
        const startDate = this.bulkSponsorshipStartDate();
        const endDate = this.bulkSponsorshipEndDate();
        const executivesCount = this.bulkSponsoredExecutivesCount();
        const bulkData = this.bulkSponsorshipData();

        if (!startDate || !endDate) {
            this.messageService.add({
                ...TOAST_MESSAGES.VALIDATION_ERROR,
                detail: ERROR_MESSAGES.INVALID_DATES
            });
            return;
        }

        // Validate
        const validation = this.validationService.validateBulkSponsorship({
            selectedWards: bulkData ? [bulkData] : this.selectedWards(),
            executivesCount,
            maxExecutives: this.bulkMaxExecutives(),
            startDate,
            endDate
        });

        if (!validation.isValid) {
            this.messageService.add({
                ...TOAST_MESSAGES.VALIDATION_ERROR,
                detail: validation.errors.join('. ')
            });
            return;
        }

        if (bulkData) {
            this.addBulkSelectionToCart(bulkData, executivesCount, startDate, endDate);
        } else {
            this.addMultipleWardsToCart(this.selectedWards(), executivesCount, startDate, endDate);
        }

        this.isBulkSponsorDialogVisible.set(false);
        this.selectedWards.set([]);
        this.clearBulkSelection();
    }

    private addBulkSelectionToCart(
        bulkData: BulkSponsorshipData,
        executivesCount: number,
        startDate: Date,
        endDate: Date
    ) {
        const hierarchyData = this.businessLogic.buildHierarchyData(
            bulkData.level as any,
            {
                zone: this.selectedZone(),
                district: this.selectedDistrict(),
                subdistrict: this.selectedSubdistrict(),
                localBodyType: this.selectedLocalBodyType(),
                localBody: this.selectedLocalBody()
            }
        );

        const conflictCheck = this.businessLogic.checkHierarchyConflict(
            bulkData.level,
            hierarchyData,
            this.cartItems()
        );

        if (conflictCheck.hasConflict) {
            this.messageService.add({
                ...TOAST_MESSAGES.CONFLICT_ERROR,
                detail: conflictCheck.conflictMessage
            });
            return;
        }

        const monthlyRate = this.businessLogic.getMonthlyRate();
        const costPerMonth = this.businessLogic.calculateCostPerMonth(
            bulkData.wardCount * executivesCount
        );

        const cartItem: CartItem = {
            id: this.businessLogic.generateCartItemId(),
            isBulk: true,
            bulkLevel: bulkData.level,
            bulkIdentifier: bulkData.identifier,
            bulkWardCount: bulkData.wardCount,
            hierarchyData: hierarchyData,
            executivesSponsored: bulkData.wardCount * executivesCount,
            monthlyRate: monthlyRate,
            costPerMonth: costPerMonth,
            startDate: startDate,
            endDate: endDate,
            displayName: `${bulkData.level}: ${bulkData.identifier} (${bulkData.wardCount} wards)`
        };

        this.cartItems.update(items => [...items, cartItem]);
        
        const queueInfo = bulkData.hasSponsoredWards 
            ? ` (${bulkData.sponsoredWardsCount} wards queued)`
            : '';
        
        this.messageService.add({
            ...TOAST_MESSAGES.CART_ADDED,
            detail: `Bulk selection added to cart${queueInfo}`
        });
    }

    private addMultipleWardsToCart(
        wards: Ward[],
        executivesCount: number,
        startDate: Date,
        endDate: Date
    ) {
        const overlapCheck = this.businessLogic.checkBulkOverlap(
            wards,
            startDate,
            endDate,
            this.cartItems()
        );

        if (overlapCheck.hasOverlap) {
            this.messageService.add({
                ...TOAST_MESSAGES.CONFLICT_ERROR,
                detail: overlapCheck.message
            });
            return;
        }

        const monthlyRate = this.businessLogic.getMonthlyRate();

        const newCartItems = wards.map(ward => ({
            id: this.businessLogic.generateCartItemId(),
            ward: ward,
            executivesSponsored: executivesCount,
            monthlyRate: monthlyRate,
            costPerMonth: this.businessLogic.calculateCostPerMonth(executivesCount),
            startDate: startDate,
            endDate: endDate,
            isBulk: false
        }));

        this.cartItems.update(items => [...items, ...newCartItems]);
        
        this.messageService.add({
            ...TOAST_MESSAGES.CART_ADDED,
            detail: `${wards.length} wards added to cart`
        });
    }

    // Cart Management
removeFromCart(itemId: string) {
    this.cartItems.update(items => 
        items.filter(item => {
            // Handle both individual and bulk items
            if (item.isBulk) {
                return item.id !== itemId;
            }
            return item.ward?._id !== itemId;
        })
    );
    
    this.messageService.add({
        ...TOAST_MESSAGES.CART_REMOVED,
        detail: 'Item removed from cart'
    });
}
    clearCart() {
        this.cartItems.set([]);
        this.messageService.add({
            severity: 'info',
            summary: 'Cart Cleared',
            detail: 'All items removed from cart',
            life: 2000
        });
    }

    // Payment & Submission
    async proceedToPayment() {
        const validation = this.validationService.validateSponsorForm({
            sponsorName: this.sponsorName(),
            sponsorEmail: this.sponsorEmail(),
            cartItems: this.cartItems()
        });

        if (!validation.isValid) {
            this.messageService.add({
                ...TOAST_MESSAGES.VALIDATION_ERROR,
                detail: validation.errors.join('. ')
            });
            return;
        }

        this.isProcessing.set(true);

        try {
            const sponsorshipId = await this.sponsor.createSponsorship({
                sponsorName: this.sponsorName(),
                sponsorEmail: this.sponsorEmail(),
                totalAmount: this.total(),
                cart: this.cartItems(),
                sponsorshipDurationMonths: SPONSOR_CONFIG.DEFAULT_SPONSORSHIP_MONTHS
            });

            const order = await this.paymentService.createOrder({
                sponsorshipId,
                amount: this.paymentService.formatAmountToPaise(this.total()),
                sponsorName: this.sponsorName(),
                sponsorEmail: this.sponsorEmail()
            });

            await this.paymentService.openPaymentModal(
                order.id,
                order.amount,
                this.sponsorName(),
                this.sponsorEmail(),
                (response) => this.handlePaymentSuccess(sponsorshipId, response),
                () => this.handlePaymentDismiss()
            );
        } catch (error) {
            console.error('Sponsorship submission failed:', error);
            this.isProcessing.set(false);
        }
    }

    private async handlePaymentSuccess(sponsorshipId: string, response: any) {
        try {
            await this.paymentService.processPaymentSuccess({
                sponsorshipId,
                paymentId: response.razorpay_payment_id,
                orderId: response.razorpay_order_id,
                signature: response.razorpay_signature
            });

            this.clearCart();
            this.sponsorName.set('');
            this.sponsorEmail.set('');
            
            this.router.navigate(['/sponsorship-success']);
        } catch (error) {
            console.error('Payment verification failed:', error);
        } finally {
            this.isProcessing.set(false);
        }
    }

    private handlePaymentDismiss() {
        this.paymentService.handlePaymentCancellation();
        this.isProcessing.set(false);
    }

    // Helper Methods
    getLocalBodyTypeLabel(type: 'P' | 'M' | 'C' | 'All'): string {
        return this.businessLogic.getLocalBodyTypeLabel(type);
    }

    getMaxExecutives(type: 'P' | 'M' | 'C' | 'All'): number {
        return this.businessLogic.getMaxExecutives(type);
    }

    formatCurrency(amount: number): string {
        return this.businessLogic.formatCurrency(amount);
    }
}