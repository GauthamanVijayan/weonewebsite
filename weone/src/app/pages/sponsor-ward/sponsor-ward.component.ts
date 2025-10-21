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
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { DatePickerModule, DatePicker } from 'primeng/datepicker';
import {
    Zone,
    District,
    LocalBody,
    SponsorType,
    CartItem,
    Ward
} from '../interfaces/sponsor.interface';
import { ConvexService } from '../services/sponsor.service';
import { ScrollAnimateDirective } from '../shared/scroll-animate.directive';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { Router } from '@angular/router';
import { environment } from 'src/environments/environment';

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
    // Inject Convex Service
    private messageService = inject(MessageService);
    convex = inject(ConvexService);
    private readonly RATE_PER_EXECUTIVE = 15000;
    private router=inject(Router)
    // ==========================================
    // SIGNALS - Selection State
    // ==========================================
    selectedZone = signal<Zone | null>(null);
    selectedDistrict = signal<District | null>(null);
    selectedSubdistrict = signal<LocalBody | null>(null); // NEW
    selectedWards = signal<Ward[]>([]);
    selectedLocalBodyType = signal<'All' | 'P' | 'M' | 'C'>('All');
    selectedLocalBody = signal<LocalBody | null>(null);
    localBodyTypeOptions = signal([
        { label: 'All Types', value: 'All' },
        { label: 'Panchayat', value: 'P' },
        { label: 'Municipality', value: 'M' },
        { label: 'Corporation', value: 'C' }
    ]);

    bulkSelectedExecutivesTotal = computed(() => {
        const selectedCount = this.selectedWards().length;
        // We assume the user wants 1 executive per ward initially if the dialog hasn't been opened.
        return selectedCount * this.bulkSponsoredExecutivesCount();
    });
    bulkSelectionCost = computed(() => {
        return this.bulkSelectedExecutivesTotal() * this.RATE_PER_EXECUTIVE;
    });
    cartExecutivesTotal = computed(() => {
        return this.cartItems().reduce(
            (sum, item) => sum + item.executivesSponsored,
            0
        );
    });
    bulkMaxExecutives = computed(() => {
        const wards = this.selectedWards();
        if (wards.length === 0) {
            return 5; // Default to highest possible value when nothing is selected
        }

        // Get the maximum allowed executive count for every selected ward
        const maxValues = wards.map((ward) =>
            this.getMaxExecutives(ward.localBodyType as 'P' | 'M' | 'C')
        );

        // Return the minimum value from the resulting array (the most restrictive constraint)
        return Math.min(...maxValues);
    });
    isBulkSponsorDialogVisible = signal(false);
    bulkSponsoredExecutivesCount = signal(1);
    bulkSponsorshipStartDate = signal<Date | null>(null);
    bulkSponsorshipEndDate = computed<Date | null>(() => {
        const startDate = this.bulkSponsorshipStartDate();
        const months = this.bulkSponsorshipMonths();
        if (!startDate || months < 1) return null;

        const endDate = new Date(startDate);
        endDate.setMonth(startDate.getMonth() + months);
        return endDate;
    }); // ==========================================
    // COMPUTED - Data from Service
    // ==========================================
    zones = this.convex.zones;
    zonesLoading = this.convex.zonesLoading;

    districts = this.convex.districts;
    subDistricts = this.convex.subdistricts;
    districtsLoading = this.convex.districtsLoading;
    subdistrictsLoading = this.convex.subdistrictsLoading;
    // localBodies = this.convex.localBodies;
    // localBodiesLoading = this.convex.localBodiesLoading;

    wards = this.convex.wards;
    wardsLoading = this.convex.wardsLoading;
    searchText = signal('');
    cartMessage = signal<string | null>(null);
    cartMessageTimeout: any = null;
    sponsorshipMonths = signal(1);
    bulkSponsorshipMonths = signal(1);

    stateSummary = signal<any>(null);
    bulkSponsorshipData = signal<{
        level:
            | 'state'
            | 'zone'
            | 'district'
            | 'type'
            | 'subdistrict'
            | 'localbody';
        identifier: string;
        wardCount: number;
        estimatedCost: number;
    } | null>(null);

    // ==========================================
    // SIGNALS - Sponsor Form
    // ==========================================
    sponsorType = signal<'individual' | 'company'>('individual');
    sponsorName = signal('');
    sponsorEmail = signal('');
    today = new Date();

    minEndDate = computed(() => {
        const startDate = this.sponsorshipStartDate();
        if (!startDate) return this.today;
        // Set minimum end date to be 1 month after the start date
        const minDate = new Date(startDate);
        minDate.setMonth(minDate.getMonth() + 1);
        return minDate;
    });
    bulkMinEndDate = computed(() => {
        const startDate = this.bulkSponsorshipStartDate();
        if (!startDate) return this.today;
        const minDate = new Date(startDate);
        minDate.setMonth(minDate.getMonth() + 1);
        return minDate;
    });
    selectedState = signal<boolean>(false);

    // NEW: Computed to check if "Select All" was used
    bulkSelectionLevel = signal<
        | 'state'
        | 'zone'
        | 'district'
        | 'subdistrict'
        | 'type'
        | 'localbody'
        | null
    >(null);
    stateOrZoneSelected = computed(() => {
        return (
            this.bulkSelectionLevel() === 'state' ||
            this.bulkSelectionLevel() === 'zone'
        );
    });

    districtOrAboveSelected = computed(() => {
        const level = this.bulkSelectionLevel();
        return level === 'state' || level === 'zone' || level === 'district';
    });

    // NEW: Check if dropdowns should be disabled
    areDropdownsDisabled = computed(() => {
        return this.bulkSelectionLevel() !== null;
    });
    async selectAllWardsInState() {
        const summary = await this.convex.client.query(
            'wards:getStateSummary',
            {}
        );

        this.bulkSelectionLevel.set('state');
        this.bulkSponsorshipData.set({
            level: 'state',
            identifier: 'Kerala',
            wardCount: summary.totalWards,
            estimatedCost: summary.estimatedCost
        });

        this.selectedWards.set([]);
    }

    filteredWards = computed(() => {
        const allWards = this.wards();
        const search = this.searchText().toLowerCase();
        const localBody = this.selectedLocalBody();

        let wardsToDisplay = allWards;

        // If a specific local body is selected, filter by it
        if (localBody) {
            wardsToDisplay = wardsToDisplay.filter(
                (ward) => ward.localBodyName === localBody.name
            );
        }

        // Apply search filter
        if (search) {
            wardsToDisplay = wardsToDisplay.filter(
                (ward) =>
                    ward.wardName.toLowerCase().includes(search) ||
                    ward.localBodyName.toLowerCase().includes(search)
            );
        }

        return wardsToDisplay;
    });
    constructor() {}
    sponsorTypeOptions = signal<SponsorType[]>([
        { label: 'Individual', value: 'individual' },
        { label: 'Company', value: 'company' }
    ]);

    // ==========================================
    // SIGNALS - Cart & Dialog
    // ==========================================
    cartItems = signal<CartItem[]>([]);
    isVolunteerDialogVisible = signal(false);
    selectedWardForSponsorship = signal<Ward | null>(null);
    sponsoredExecutivesCount = signal(1);
    sponsorshipStartDate = signal<Date | null>(null);
    sponsorshipEndDate = computed<Date | null>(() => {
        const startDate = this.sponsorshipStartDate();
        const months = this.sponsorshipMonths();
        if (!startDate || months < 1) return null;

        const endDate = new Date(startDate);
        // CRITICAL FIX: Add months to the date object
        endDate.setMonth(startDate.getMonth() + months);
        return endDate;
    });
    // ==========================================
    // COMPUTED - Max Executives
    // ==========================================
    maxExecutives = computed(() => {
        const ward = this.selectedWardForSponsorship();
        if (!ward) return 1;

        switch (ward.localBodyType) {
            case 'C':
                return 5;
            case 'M':
                return 3;
            case 'P':
                return 1;
            default:
                return 1;
        }
    });
    selectAllByTypeLabel = computed(() => {
        const type = this.selectedLocalBodyType();
        if (type === 'All') return 'Select All by Type';
        return `Select All ${this.getLocalBodyTypeLabel(type as any)}s`;
    });
    // Helper to get max executives for any ward
    getMaxExecutives(localBodyType: 'P' | 'M' | 'C'): number {
        switch (localBodyType) {
            case 'C':
                return 5;
            case 'M':
                return 3;
            case 'P':
                return 1;
            default:
                return 1;
        }
    }

    onLocalBodyTypeChange() {
        console.log('🔄 Type changed:', this.selectedLocalBodyType());

        this.selectedLocalBody.set(null);
        this.convex.clearWards();
        this.convex.localBodies.set([]);

        const subdistrict = this.selectedSubdistrict();
        const type = this.selectedLocalBodyType();

        if (!subdistrict) {
            console.log('⚠️ No subdistrict selected');
            return;
        }

        if (type !== 'All') {
            // Load local bodies for the selected type
            console.log('📥 Loading local bodies for type:', type);
            this.convex.loadLocalBodies(subdistrict.name, type);

            // Also load wards filtered by type
            this.convex.loadWards({
                subdistrict: subdistrict.name,
                localBodyType: type,
                searchText: this.searchText()
            });
        } else {
            // Load all wards when type is 'All'
            console.log('📥 Loading all wards');
            this.convex.loadWards({
                subdistrict: subdistrict.name,
                localBodyType: 'All',
                searchText: this.searchText()
            });
        }
    }

    onLocalBodyChange(event: { value: LocalBody | null }) {
        console.log('🏛️ Local body changed:', event.value);

        this.convex.clearWards();

        const localBody = this.selectedLocalBody();
        const subdistrict = this.selectedSubdistrict();

        if (localBody && subdistrict) {
            // Load only wards for this specific local body
            this.convex.loadWards({
                subdistrict: subdistrict.name,
                localBodyType: localBody.type,
                searchText: this.searchText()
            });
        }
    }
    onSelectionChange() {
        // This logic ensures the bulk sponsored executives count does not exceed the limit
        const currentBulkCount = this.bulkSponsoredExecutivesCount();
        const maxAllowed = this.bulkMaxExecutives();

        // If the currently set count exceeds the new, more restrictive max, reset it.
        if (currentBulkCount > maxAllowed) {
            this.bulkSponsoredExecutivesCount.set(maxAllowed);
        }
    }

    clearCart() {
        this.cartItems.set([]);
    }
    // ==========================================
    // COMPUTED - Cart Calculations
    // ==========================================
    subtotal = computed(() => {
        return this.cartItems().reduce((sum, item) => {
            return sum + item.costPerMonth;
        }, 0);
    });

    gst = computed(() => {
        return Math.round(this.subtotal() * 0.18);
    });

    total = computed(() => {
        return this.subtotal() + this.gst();
    });

    walletBonus = computed(() => {
        return this.total() * 3;
    });

    isFormValid = computed(() => {
        return (
            this.sponsorName().trim() !== '' &&
            this.sponsorEmail().trim() !== '' &&
            this.cartItems().length > 0
        );
    });

    // ==========================================
    // SELECTION HANDLERS
    // ==========================================
    onZoneChange(event: { value: Zone | null }) {
        this.selectedDistrict.set(null);
        this.selectedSubdistrict.set(null);
        this.selectedLocalBodyType.set('All');
        this.selectedLocalBody.set(null);

        this.convex.clearDistricts();

        if (event.value) {
            this.convex.loadDistrictsByZone(event.value.name);
        }
    }
    selectAllWardsInLocalBody() {
        const selectedLocalBody = this.selectedLocalBody();
        if (!selectedLocalBody) return;

        this.bulkSelectionLevel.set('localbody');

        const wardsInLocalBody = this.filteredWards().filter(
            (ward) => ward.localBodyName === selectedLocalBody.name
        );

        this.selectedWards.set(wardsInLocalBody);
        this.onSelectionChange();
    }
    clearSelection() {
        this.selectedWards.set([]);
        this.bulkSelectionLevel.set(null);
    }
    onDistrictChange(event: { value: District | null }) {
        this.selectedSubdistrict.set(null);
        this.selectedLocalBodyType.set('All');
        this.selectedLocalBody.set(null);

        this.convex.clearSubdistricts();

        if (event.value) {
            this.convex.loadSubdistrictsByDistrict(event.value.name);
        }
    }

    onSubdistrictChange(event: { value: LocalBody | null }) {
        this.selectedLocalBodyType.set('All');
        this.selectedLocalBody.set(null);

        this.convex.clearWards();
        this.convex.localBodies.set([]);

        const subdistrict = this.selectedSubdistrict();

        if (subdistrict) {
            // Load all wards when subdistrict is selected (type defaults to 'All')
            this.convex.loadWards({
                subdistrict: subdistrict.name,
                localBodyType: 'All',
                searchText: this.searchText()
            });
        }
    }

    isBulkQueued = computed(() => {
    const today = new Date();
    // Check if the calculated start date is more than one day in the future
    return this.bulkSponsorshipStartDate() && this.bulkSponsorshipStartDate()!.getTime() > today.getTime() + 86400000;
});
    // ==========================================
    // DIALOG HANDLERS
    // ==========================================
// in sponsor-ward.component.ts
hasQueuedWardsInSelection = computed(() => {
    return this.selectedWards().some(ward => ward.isSponsored);
});

openVolunteerDialog(ward: Ward) {
    this.selectedWardForSponsorship.set(ward);
    this.isVolunteerDialogVisible.set(true);
    
    console.log('🔍 Ward Sponsorship Details:', {
        wardName: ward.wardName,
        isSponsored: ward.isSponsored,
        sponsoredUntil: ward.sponsoredUntil,
        sponsoredExecutivesCount: ward.sponsoredExecutivesCount,
        availableExecutives: ward.availableExecutives,
        isPendingSponsorship: ward.isPendingSponsorship,
        maxExecutives: this.getMaxExecutives(ward.localBodyType)
    });
    
    // ✅ Check if ward has ANY sponsored executives (including pending with 3-day lock)
    if (ward.isSponsored && ward.sponsoredUntil && ward.sponsoredUntil > 0) {
        const currentEndDate = new Date(ward.sponsoredUntil);
        const dayAfterEnd = new Date(currentEndDate);
        dayAfterEnd.setDate(dayAfterEnd.getDate() + 1);
        
        const maxExecs = this.getMaxExecutives(ward.localBodyType);
        const available = ward.availableExecutives || 0;
        
        if (available > 0) {
            // Partial sponsorship - some slots available
            this.sponsorshipStartDate.set(new Date()); // Can start today
            
            this.messageService.add({
                severity: 'info',
                summary: ward.isPendingSponsorship ? 'Pending Sponsorship (3-Day Lock)' : 'Partial Sponsorship',
                detail: `${ward.sponsoredExecutivesCount} of ${maxExecs} executives are ${ward.isPendingSponsorship ? 'pending/locked' : 'sponsored'} until ${currentEndDate.toLocaleDateString()}. You can sponsor the remaining ${available} executive(s) immediately.`,
                life: 7000
            });
            
            // Set count to available slots
            this.sponsoredExecutivesCount.set(Math.min(1, available));
        } else {
            // Fully sponsored - must queue
            this.sponsorshipStartDate.set(dayAfterEnd);
            
            this.messageService.add({
                severity: 'warn',
                summary: ward.isPendingSponsorship ? 'Fully Locked (Pending Payment)' : 'Fully Sponsored',
                detail: `All ${maxExecs} executives are ${ward.isPendingSponsorship ? 'locked (pending payment)' : 'sponsored'} until ${currentEndDate.toLocaleDateString()}. Your sponsorship will be queued and start on ${dayAfterEnd.toLocaleDateString()}.`,
                life: 7000
            });
            
            // Reset to 1 for queued sponsorship
            this.sponsoredExecutivesCount.set(1);
        }
    } else {
        // Not sponsored - can start today
        this.sponsorshipStartDate.set(new Date());
        this.sponsoredExecutivesCount.set(1);
    }
}
    addToCart() {
        const ward = this.selectedWardForSponsorship();
        const count = this.sponsoredExecutivesCount();
        const startDate = this.sponsorshipStartDate();
        const endDate = this.sponsorshipEndDate();

        if (!ward || count < 1 || !startDate || !endDate) {
            this.messageService.add({
                severity: 'error',
                summary: 'Missing Information',
                detail: 'Please fill in all required fields',
                life: 3000
            });
            return;
        }

        // Check conflict with bulk selections
        const wardHierarchy = {
            state: 'Kerala',
            zone: ward.zoneName,
            district: ward.districtName
        };

        const conflict = this.checkCartConflict(wardHierarchy, 'individual');
        if (conflict.hasConflict) {
            this.messageService.add({
                severity: 'error',
                summary: 'Cannot Add Ward',
                detail: conflict.conflictMessage,
                life: 5000
            });
            return;
        }

        // Check if already in cart
        const existingIndex = this.cartItems().findIndex(
            (item) => !item.isBulk && item.ward._id === ward._id
        );

        const newItem: CartItem = {
            ward,
            executivesSponsored: count,
            monthlyRate: 15000,
            costPerMonth: count * 15000,
            startDate,
            endDate
        };

        const action = this.upsertCartItem(newItem);

        if (existingIndex > -1) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Already in Cart',
                detail: `${ward.wardName} was already in cart. Updated details.`,
                life: 4000
            });
        } else {
            this.messageService.add({
                severity: 'success',
                summary: 'Added to Cart',
                detail: `${ward.wardName} added successfully`,
                life: 3000
            });
        }

        this.isVolunteerDialogVisible.set(false);
    }

    openBulkSponsorDialog() {
        // Set default dates
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(startDate.getMonth() + 1);
        this.bulkSponsorshipStartDate.set(startDate);
        this.bulkSponsoredExecutivesCount.set(1);
        this.bulkSponsorshipMonths.set(1);
        this.isBulkSponsorDialogVisible.set(true);
    }

    async selectAllWardsInZone() {
        const selectedZone = this.selectedZone();
        if (!selectedZone) return;

        const summary = await this.convex.client.query('wards:getZoneSummary', {
            zone: selectedZone.name
        });

        this.bulkSelectionLevel.set('zone');
        this.bulkSponsorshipData.set({
            level: 'zone',
            identifier: selectedZone.name,
            wardCount: summary.totalWards,
            estimatedCost: summary.estimatedCost
        });

        this.selectedWards.set([]);
    }

    async selectAllWardsInDistrict() {
        const selectedDistrict = this.selectedDistrict();
        if (!selectedDistrict) return;

        const summary = await this.convex.client.query(
            'wards:getDistrictSummary',
            {
                district: selectedDistrict.name
            }
        );

        this.bulkSelectionLevel.set('district');
        this.bulkSponsorshipData.set({
            level: 'district',
            identifier: selectedDistrict.name,
            wardCount: summary.totalWards,
            estimatedCost: summary.estimatedCost
        });

        this.selectedWards.set([]);
    }

    displayedWardCount = computed(() => {
        const bulkData = this.bulkSponsorshipData();
        if (bulkData) {
            return bulkData.wardCount;
        }
        return this.selectedWards().length;
    });

    displayedEstimatedCost = computed(() => {
        const bulkData = this.bulkSponsorshipData();
        if (bulkData) {
            return bulkData.estimatedCost * this.bulkSponsoredExecutivesCount();
        }
        return this.bulkSelectionCost();
    });

    estimatedCostDescription = computed(() => {
        const level = this.bulkSelectionLevel();
        const execCount = this.bulkSponsoredExecutivesCount();

        if (level) {
            return `Based on ${execCount} executive${execCount > 1 ? 's' : ''} per ward (₹15,000/executive/month). Actual cost varies: Panchayat=1, Municipality=3, Corporation=5 executives.`;
        }
        return '';
    });
    async selectAllWardsInSubdistrict() {
        const selectedSubdistrict = this.selectedSubdistrict();
        if (!selectedSubdistrict) return;

        this.bulkSelectionLevel.set('subdistrict');

        // Can load actual wards (under 8K limit)
        this.selectedWards.set(this.filteredWards());
        this.onSelectionChange();
    }

    async selectAllWardsByType() {
        const selectedSubdistrict = this.selectedSubdistrict();
        const selectedType = this.selectedLocalBodyType();

        if (!selectedSubdistrict || selectedType === 'All') return;

        const summary = await this.convex.client.query(
            'wards:getWardsSummaryBySubdistrictAndType',
            {
                subdistrict: selectedSubdistrict.name,
                localBodyType: selectedType
            }
        );

        this.bulkSelectionLevel.set('type');
        this.bulkSponsorshipData.set({
            level: 'type',
            identifier: `${selectedSubdistrict.name} - ${this.getLocalBodyTypeLabel(selectedType as any)}`,
            wardCount: summary.totalWards,
            estimatedCost: summary.estimatedCost
        });

        this.selectedWards.set([]);
    }

    async addToCartBulk(): Promise<void> {
    const wardsToAdd = this.selectedWards();
    const count = this.sponsoredExecutivesCount(); // Assuming single count for all
    const startDate = this.sponsorshipStartDate();
    const endDate = this.sponsorshipEndDate();
    
    

    if (wardsToAdd.length === 0) {
        this.messageService.add({ severity: 'warn', summary: 'Selection Empty', detail: 'Please select at least one ward.', life: 3000 });
        return;
    }
    if (count < 1 || !startDate || !endDate) {
        this.messageService.add({ severity: 'error', summary: 'Missing Details', detail: 'Please set sponsorship count and dates.', life: 4000 });
        return;
    }

    let successes = 0;
    let conflicts = 0;

    for (const ward of wardsToAdd) {
        // NOTE: We must skip the dialog logic and execute the core cart logic
        
        const wardHierarchy = {
            state: 'Kerala',
            zone: ward.zoneName,
            district: ward.districtName
        };

        const conflict = this.checkCartConflict(wardHierarchy, 'individual');
        if (conflict.hasConflict) {
            conflicts++;
            continue; // Skip this ward, proceed to the next
        }

        const newItem: CartItem = {
            ward,
            executivesSponsored: count,
            monthlyRate: 15000,
            costPerMonth: count * 15000,
            startDate,
            endDate
        };

        this.upsertCartItem(newItem); // Execute the core logic
        successes++;
    }

    if (successes > 0) {
        this.messageService.add({
            severity: 'success',
            summary: 'Bulk Add Success',
            detail: `${successes} ward(s) successfully added to cart.`,
            life: 4000
        });
    }
    if (conflicts > 0) {
        this.messageService.add({
            severity: 'warn',
            summary: 'Skipped Wards',
            detail: `${conflicts} ward(s) skipped due to bulk conflict or existing area sponsorship.`,
            life: 6000
        });
    }

    this.selectedWards.set([]); // Clear selection after adding
}

    clearStateSelection() {
        if (this.bulkSelectionLevel() === 'state') {
            this.clearSelection();
        }
    }

    clearZoneSelection() {
        if (this.bulkSelectionLevel() === 'zone') {
            this.clearSelection();
        }
    }

    clearDistrictSelection() {
        if (this.bulkSelectionLevel() === 'district') {
            this.clearSelection();
        }
    }

    clearSubdistrictSelection() {
        if (this.bulkSelectionLevel() === 'subdistrict') {
            this.clearSelection();
        }
    }

    clearTypeSelection() {
        if (this.bulkSelectionLevel() === 'type') {
            this.clearSelection();
        }
    }

    clearLocalBodySelection() {
        if (this.bulkSelectionLevel() === 'localbody') {
            this.clearSelection();
        }
    }
availableExecutives = computed(() => {
    const ward = this.selectedWardForSponsorship();
    if (!ward) return 1;

    // ✅ Use the pre-calculated value from backend
    return ward.availableExecutives || this.maxExecutives();
});
  addSelectedWardsToCart() {
    const bulkData = this.bulkSponsorshipData();
    const count = this.bulkSponsoredExecutivesCount();
    const startDate = this.bulkSponsorshipStartDate();
    const endDate = this.bulkSponsorshipEndDate();

    if (!startDate || !endDate || count < 1) {
        this.messageService.add({
            severity: 'error',
            summary: 'Missing Information',
            detail: 'Please fill in all required fields',
            life: 3000
        });
        return;
    }

    if (bulkData) {
        console.log('📦 Adding bulk selection to cart:', bulkData);

        // BUILD HIERARCHY DATA
        const hierarchyData = this.buildHierarchyData(bulkData.level);

        // CHECK FOR CONFLICTS
        const conflict = this.checkCartConflict(hierarchyData, bulkData.level);

        if (conflict.hasConflict) {
            this.messageService.add({
                severity: 'error',
                summary: 'Conflict Detected',
                detail: conflict.conflictMessage,
                life: 5000,
                sticky: false
            });
            return;
        }

        // Check for exact duplicate
        const bulkKey = `${bulkData.level}-${bulkData.identifier}`;
        const existingBulkIndex = this.cartItems().findIndex(
            (item) =>
                item.isBulk &&
                item.bulkLevel === bulkData.level &&
                item.bulkIdentifier === bulkData.identifier
        );

        if (existingBulkIndex > -1) {
            // ✅ CHECK FOR DATE OVERLAP WITH EXISTING BULK ITEM
            const existingItem = this.cartItems()[existingBulkIndex];
            const existingStart = existingItem.startDate.getTime();
            const existingEnd = existingItem.endDate.getTime();
            const newStart = startDate.getTime();
            const newEnd = endDate.getTime();

            const hasOverlap = (newStart <= existingEnd && newEnd >= existingStart);

            if (hasOverlap) {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Date Conflict',
                    detail: `${bulkData.identifier} is already in cart with overlapping dates (${existingItem.startDate.toLocaleDateString()} to ${existingItem.endDate.toLocaleDateString()}). Please choose different dates or remove the existing item.`,
                    life: 6000
                });
                return;
            }
        }

        // ✅ CREATE BULK CART ITEM WITH CORRECT FIELDS
        const bulkCartItem: CartItem = {
            isBulk: true,
            bulkLevel: bulkData.level,
            bulkIdentifier: bulkData.identifier,
            bulkWardCount: bulkData.wardCount,
            executivesSponsored: count,
            monthlyRate: 15000,
            costPerMonth: bulkData.estimatedCost * count,
            startDate,
            endDate,
            hierarchyData,
            ward: {
                _id: bulkKey,
                wardName: `All Wards in ${bulkData.identifier}`,
                localBodyId: bulkKey,
                localBodyName: `${bulkData.wardCount} wards`,
                localBodyType: 'P',
                type: 'Rural',
                districtName: hierarchyData.district || '',
                zoneName: hierarchyData.zone || '',
                // ✅ FIX: These represent DATABASE status, not cart status
                isSponsored: false, // Bulk items don't have current sponsorship status
                sponsoredUntil: 0,
                sponsoredExecutivesCount: 0,
                availableExecutives: 0,
                isPendingSponsorship: false
            }
        };

        this.cartItems.update((items) => [...items, bulkCartItem]);

        this.messageService.add({
            severity: 'success',
            summary: 'Added to Cart',
            detail: `${bulkData.wardCount} wards in ${bulkData.identifier} added successfully`,
            life: 3000
        });
    } else {
        // INDIVIDUAL WARDS
        const wards = this.selectedWards();
        if (wards.length === 0) {
            this.messageService.add({
                severity: 'warn',
                summary: 'No Selection',
                detail: 'Please select wards to add to cart',
                life: 3000
            });
            return;
        }

        // ✅ CHECK FOR DATE OVERLAPS IN SELECTED WARDS
        const overlapCheck = this.checkBulkOverlap(wards, startDate, endDate);
        if (overlapCheck.hasOverlap) {
            this.messageService.add({
                severity: 'error',
                summary: 'Date Conflicts',
                detail: overlapCheck.message,
                life: 6000
            });
            return;
        }

        // Check if any individual ward conflicts with bulk selections
        for (const ward of wards) {
            const wardHierarchy = {
                state: 'Kerala',
                zone: ward.zoneName,
                district: ward.districtName
            };

            const conflict = this.checkCartConflict(wardHierarchy, 'individual');
            if (conflict.hasConflict) {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Conflict Detected',
                    detail: `${ward.wardName}: ${conflict.conflictMessage}`,
                    life: 5000
                });
                return;
            }
        }

        // No conflicts or overlaps, proceed with adding
        let addedCount = 0;

        wards.forEach((ward) => {
            const newItem: CartItem = {
                ward,
                executivesSponsored: count,
                monthlyRate: 15000,
                costPerMonth: count * 15000,
                startDate,
                endDate
            };
            
            // Add to cart
            this.cartItems.update(items => [...items, newItem]);
            addedCount++;
        });

        this.messageService.add({
            severity: 'success',
            summary: 'Added to Cart',
            detail: `${addedCount} ward(s) added successfully`,
            life: 3000
        });
    }

    this.isBulkSponsorDialogVisible.set(false);
    this.clearSelection();
}

    private upsertCartItem(newItem: CartItem): 'added' | 'updated' {
        // 👈 Change return type
        let action: 'added' | 'updated' = 'added';

        this.cartItems.update((currentItems) => {
            const existingIndex = currentItems.findIndex(
                (item) => item.ward._id === newItem.ward._id
            );

            if (existingIndex > -1) {
                // Update existing item
                const updatedItems = [...currentItems];
                updatedItems[existingIndex] = newItem;
                action = 'updated'; // 👈 Set flag
                return updatedItems;
            } else {
                // Add new item
                return [...currentItems, newItem];
            }
        });
        return action; // 👈 Return the action taken
    }
    removeFromCart(wardId: string) {
        const item = this.cartItems().find((i) => i.ward._id === wardId);

        this.cartItems.update((items) =>
            items.filter((item) => item.ward._id !== wardId)
        );

        if (item) {
            this.messageService.add({
                severity: 'info',
                summary: 'Removed',
                detail: item.isBulk
                    ? `Removed ${item.bulkWardCount} wards from ${item.bulkIdentifier}`
                    : `Removed ${item.ward.wardName}`,
                life: 3000
            });
        }
    }

    // ==========================================
    // PAYMENT HANDLER
    // ==========================================
async proceedToPayment() {
    if (!this.isFormValid()) {
        alert("Please ensure your name, email, and cart are filled out.");
        return;
    }
    
    // 1. Prepare Data
    const totalAmountPaise = this.total() * 100; // Total cost in Rupees, converted to PAISA (critical)
    const sponsorInfo = { name: this.sponsorName(), email: this.sponsorEmail() };

    const finalCartItems = this.cartItems().map(item => ({
        // Spread all existing properties (ward, executivesSponsored, monthlyRate, etc.)
        ...item, 
        // Convert Date objects to ISO string format, which Convex supports
        startDate: item.startDate.toISOString(),
        endDate: item.endDate.toISOString(),
    }));
    
    try {
        // 2. Create Pending Sponsorship Record in Convex (Mutation)
        // Note: You must ensure this method exists and returns the sponsorshipId
        const sponsorshipId = await (this.convex as any).createSponsorship({
            sponsorName: sponsorInfo.name,
            sponsorEmail: sponsorInfo.email,
            totalAmount: this.total(), // Store total amount in Rupees
            cart: finalCartItems,
            sponsorshipDurationMonths: this.sponsorshipMonths() 
        });

        // 3. Get the Razorpay Order ID (Convex Action)
        const { orderId, keyId } = await (this.convex as any).createRazorpayOrder({
        sponsorshipId, 
        amount: totalAmountPaise, 
        sponsorName: sponsorInfo.name, 
        sponsorEmail: sponsorInfo.email
    });

        // 4. Load the Razorpay Checkout Script (if not already loaded)
        await loadRazorpayScript();
        
        if (!(window as any).Razorpay) {
            throw new Error("Payment gateway failed to load.");
        }
        
        // 5. Configure and Open the Razorpay Modal
        const options = {
            key: keyId, // Public Key ID from environment
            amount: totalAmountPaise,         // Amount in PAISA
            currency: "INR",
            name: "WeOne Digital Sponsorship",
            description: `Sponsorship for ${this.cartItems().length} Ward(s)`,
            order_id: orderId, // The Order ID from the Convex Action
            
            // 6. Handle Success Callback
            handler: async (response: any) => {
                // Call the secure Convex Action to verify payment and process the sponsorship
                await (this.convex as any).processPaymentSuccess({
                    sponsorshipId: sponsorshipId, 
                    paymentId: response.razorpay_payment_id, 
                    orderId: response.razorpay_order_id, 
                    signature: response.razorpay_signature,
                });
                
                // Final success: Redirect user
                this.router.navigate(['/thank-you']); 
            },
            prefill: sponsorInfo,
            theme: { color: "#2AABEE" }
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();

    } catch (error) {
        console.error("Payment Process Failed:", error);
        alert("Payment processing failed. Please check your network and console.");
    }
}
    
    getLocalBodyTypeLabel(type: 'P' | 'M' | 'C'): string {
        switch (type) {
            case 'P':
                return 'Panchayat';
            case 'M':
                return 'Municipality';
            case 'C':
                return 'Corporation';
            default:
                return '';
        }
    }
    private checkCartConflict(
        newHierarchy: any,
        newLevel: string
    ): {
        hasConflict: boolean;
        conflictMessage: string;
        conflictingItem?: CartItem;
    } {
        const existingItems = this.cartItems();

        for (const item of existingItems) {
            // Skip non-bulk items for hierarchy check
            if (!item.isBulk) continue;

            const existingHierarchy = item.hierarchyData;
            if (!existingHierarchy) continue;

            // STATE level conflict - blocks everything
            if (item.bulkLevel === 'state') {
                return {
                    hasConflict: true,
                    conflictMessage: `Cannot add ${newLevel} selection. Entire state (Kerala) is already in cart.`,
                    conflictingItem: item
                };
            }

            // NEW item is STATE - conflicts with anything
            if (newLevel === 'state') {
                return {
                    hasConflict: true,
                    conflictMessage: `Cannot add entire state. Cart already contains ${item.bulkLevel} level selection (${item.bulkIdentifier}).`,
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
                existingHierarchy.localBodyType ===
                    newHierarchy.localBodyType &&
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
    private buildHierarchyData(level: string): any {
        const hierarchy: any = {
            state: 'Kerala' // Always Kerala for this app
        };

        if (level === 'state') {
            return hierarchy;
        }

        const zone = this.selectedZone();
        if (zone) {
            hierarchy.zone = zone.name;
        }

        if (level === 'zone') {
            return hierarchy;
        }

        const district = this.selectedDistrict();
        if (district) {
            hierarchy.district = district.name;
        }

        if (level === 'district') {
            return hierarchy;
        }

        const subdistrict = this.selectedSubdistrict();
        if (subdistrict) {
            hierarchy.subdistrict = subdistrict.name;
        }

        if (level === 'subdistrict') {
            return hierarchy;
        }

        const type = this.selectedLocalBodyType();
        if (type && type !== 'All') {
            hierarchy.localBodyType = type;
        }

        if (level === 'type') {
            return hierarchy;
        }

        const localBody = this.selectedLocalBody();
        if (localBody) {
            hierarchy.localBodyName = localBody.name;
        }

        return hierarchy;
    }

    private checkWardOverlap(
    wardId: string,
    newStartDate: Date,
    newEndDate: Date
): { hasOverlap: boolean; message: string } {
    const existingItem = this.cartItems().find(
        (item) => !item.isBulk && item.ward._id === wardId
    );

    if (!existingItem) {
        return { hasOverlap: false, message: '' };
    }

    const existingStart = existingItem.startDate.getTime();
    const existingEnd = existingItem.endDate.getTime();
    const newStart = newStartDate.getTime();
    const newEnd = newEndDate.getTime();

    // Check if dates overlap
    const hasOverlap = (newStart <= existingEnd && newEnd >= existingStart);

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
private checkBulkOverlap(
    wards: Ward[],
    newStartDate: Date,
    newEndDate: Date
): { hasOverlap: boolean; message: string; conflictingWards: string[] } {
    const conflictingWards: string[] = [];

    for (const ward of wards) {
        const overlap = this.checkWardOverlap(ward._id, newStartDate, newEndDate);
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

    
}

function loadRazorpayScript(): Promise<void> {
    const src = 'https://checkout.razorpay.com/v1/checkout.js';
    return new Promise((resolve) => {
        if (typeof (window as any).Razorpay !== 'undefined') {
            return resolve();
        }
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve();
       script.onerror = () => resolve();
        document.head.appendChild(script);
    });

    

    
}