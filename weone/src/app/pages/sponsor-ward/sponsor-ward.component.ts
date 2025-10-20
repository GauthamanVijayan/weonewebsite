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
        level: 'state' | 'zone' | 'district' |'type' |'subdistrict' | 'localbody';
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
    bulkSelectionLevel = signal<'state' | 'zone' | 'district' | 'subdistrict' | 'type'|'localbody' | null>(null);
stateOrZoneSelected = computed(() => {
    return this.bulkSelectionLevel() === 'state' || this.bulkSelectionLevel() === 'zone';
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
    const summary = await this.convex.client.query('wards:getStateSummary', {});
    
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
    constructor() {
        
    }
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
    // ==========================================
    // DIALOG HANDLERS
    // ==========================================
    openVolunteerDialog(ward: Ward) {
        this.selectedWardForSponsorship.set(ward);
        this.sponsoredExecutivesCount.set(1);
        // --- Set default dates ---
        const startDate = new Date();
        const endDate = new Date();
        this.sponsorshipStartDate.set(startDate);
        this.sponsorshipMonths.set(1);
        this.isVolunteerDialogVisible.set(true);
        this.isVolunteerDialogVisible.set(true);
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

    // Check if already in cart
    const existingIndex = this.cartItems().findIndex(
        item => !item.isBulk && item.ward._id === ward._id
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
        // Ward was already in cart
        this.messageService.add({
            severity: 'warn',
            summary: 'Already in Cart',
            detail: `${ward.wardName} was already in cart. Updated details.`,
            life: 4000
        });
    } else {
        // New ward added
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

    const summary = await this.convex.client.query('wards:getDistrictSummary', {
        district: selectedDistrict.name
    });

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

    const summary = await this.convex.client.query('wards:getWardsSummaryBySubdistrictAndType', {
        subdistrict: selectedSubdistrict.name,
        localBodyType: selectedType
    });

    this.bulkSelectionLevel.set('type');
    this.bulkSponsorshipData.set({
        level: 'type',
        identifier: `${selectedSubdistrict.name} - ${this.getLocalBodyTypeLabel(selectedType as any)}`,
        wardCount: summary.totalWards,
        estimatedCost: summary.estimatedCost
    });
    
    this.selectedWards.set([]);
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
        
        // CHECK FOR DUPLICATES
        const existingBulkIndex = this.cartItems().findIndex(
            item => item.isBulk && 
                    item.bulkLevel === bulkData.level && 
                    item.bulkIdentifier === bulkData.identifier
        );

        if (existingBulkIndex > -1) {
            // DUPLICATE FOUND - Show warning and ask if they want to update
            this.messageService.add({
                severity: 'warn',
                summary: 'Already in Cart',
                detail: `${bulkData.identifier} is already in your cart. Do you want to update it?`,
                life: 5000,
                sticky: false
            });

            // UPDATE existing bulk item
            this.cartItems.update(items => {
                const updatedItems = [...items];
                updatedItems[existingBulkIndex] = {
                    ...updatedItems[existingBulkIndex],
                    executivesSponsored: count,
                    costPerMonth: bulkData.estimatedCost * count,
                    startDate,
                    endDate
                };
                return updatedItems;
            });

            // Show success message after update
            setTimeout(() => {
                this.messageService.add({
                    severity: 'success',
                    summary: 'Updated',
                    detail: `Updated sponsorship details for ${bulkData.identifier}`,
                    life: 3000
                });
            }, 500);

        } else {
            // ADD new bulk item
            const bulkKey = `${bulkData.level}-${bulkData.identifier}`;
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
                ward: {
                    _id: bulkKey,
                    wardName: `All Wards in ${bulkData.identifier}`,
                    localBodyId: bulkKey,
                    localBodyName: `${bulkData.wardCount} wards`,
                    localBodyType: 'P',
                    type: 'Rural',
                    districtName: '',
                    zoneName: ''
                }
            };

            this.cartItems.update(items => [...items, bulkCartItem]);
            
            this.messageService.add({
                severity: 'success',
                summary: 'Added to Cart',
                detail: `${bulkData.wardCount} wards in ${bulkData.identifier} added successfully`,
                life: 3000
            });
        }
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

        let addedCount = 0;
        let updatedCount = 0;
        let alreadyInCartCount = 0;

        wards.forEach((ward) => {
            // Check if already in cart
            const existingIndex = this.cartItems().findIndex(
                item => !item.isBulk && item.ward._id === ward._id
            );

            if (existingIndex > -1) {
                alreadyInCartCount++;
            }

            const newItem: CartItem = {
                ward,
                executivesSponsored: count,
                monthlyRate: 15000,
                costPerMonth: count * 15000,
                startDate,
                endDate
            };
            const action = this.upsertCartItem(newItem);

            if (action === 'added') {
                addedCount++;
            } else {
                updatedCount++;
            }
        });

        // Show appropriate message
        if (alreadyInCartCount > 0 && addedCount === 0) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Already in Cart',
                detail: `${alreadyInCartCount} ward(s) already in cart. Updated details.`,
                life: 4000
            });
        } else if (addedCount > 0 && updatedCount > 0) {
            this.messageService.add({
                severity: 'success',
                summary: 'Cart Updated',
                detail: `${addedCount} added, ${updatedCount} already in cart (updated)`,
                life: 3000
            });
        } else if (addedCount > 0) {
            this.messageService.add({
                severity: 'success',
                summary: 'Added to Cart',
                detail: `${addedCount} ward(s) added successfully`,
                life: 3000
            });
        }
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
    const item = this.cartItems().find(i => i.ward._id === wardId);
    
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
    proceedToPayment() {
        if (!this.isFormValid()) {
            alert('Please fill in all required fields');
            return;
        }

        const bulkData = this.bulkSponsorshipData();
        
        const paymentData = {
            sponsor: {
                type: this.sponsorType(),
                name: this.sponsorName(),
                email: this.sponsorEmail()
            },
            sponsorshipType: bulkData ? 'bulk' : 'individual',
            bulkSelection: bulkData ? {
                level: bulkData.level,
                identifier: bulkData.identifier,
                wardCount: bulkData.wardCount,
                executivesPerWard: this.bulkSponsoredExecutivesCount(),
                totalCost: bulkData.estimatedCost * this.bulkSponsoredExecutivesCount()
            } : null,
            items: this.cartItems().map(item => ({
                wardId: item.ward._id,
                wardName: item.ward.wardName,
                localBody: item.ward.localBodyName,
                localBodyType: item.ward.localBodyType,
                district: item.ward.districtName,
                zone: item.ward.zoneName,
                executivesSponsored: item.executivesSponsored,
                costPerMonth: item.costPerMonth,
                sponsorshipStartDate: item.startDate.toISOString(),
                sponsorshipEndDate: item.endDate.toISOString()
            })),
            summary: {
                subtotal: this.subtotal(),
                gst: this.gst(),
                total: this.total(),
                walletBonus: this.walletBonus()
            }
        };

        console.log('Processing payment:', paymentData);
        alert(`Payment processing...\nTotal: ₹${this.total().toLocaleString()}\nWallet Bonus: ₹${this.walletBonus().toLocaleString()}`);
    }


    // ... (rest of the component)

    // ==========================================
    // UTILITY
    // ==========================================
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

 
}
