import { Injectable } from '@angular/core';
import { CartItem } from '../interfaces/sponsor.interface';
import { ERROR_MESSAGES } from '../constants/sponsor.constants';

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
}

@Injectable({
    providedIn: 'root'
})
export class ValidationService {
    /**
     * Validate sponsor form
     */
    validateSponsorForm(data: {
        sponsorName: string;
        sponsorEmail: string;
        cartItems: CartItem[];
    }): ValidationResult {
        const errors: string[] = [];

        // Validate sponsor name
        if (!data.sponsorName?.trim()) {
            errors.push(ERROR_MESSAGES.INVALID_NAME);
        } else if (data.sponsorName.trim().length < 2) {
            errors.push('Sponsor name must be at least 2 characters long');
        }

        // Validate email
        if (!data.sponsorEmail?.trim()) {
            errors.push(ERROR_MESSAGES.INVALID_EMAIL);
        } else if (!this.isValidEmail(data.sponsorEmail)) {
            errors.push(ERROR_MESSAGES.INVALID_EMAIL);
        }

        // Validate cart
        if (data.cartItems.length === 0) {
            errors.push(ERROR_MESSAGES.EMPTY_CART);
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate individual ward sponsorship
     */
    validateWardSponsorship(data: {
        executivesSponsored: number;
        maxExecutives: number;
        startDate: Date | null;
        endDate: Date | null;
    }): ValidationResult {
        const errors: string[] = [];

        // Validate executives count
        if (data.executivesSponsored < 1) {
            errors.push('At least 1 executive must be sponsored');
        }

        if (data.executivesSponsored > data.maxExecutives) {
            errors.push(`Maximum ${data.maxExecutives} executives allowed for this ward`);
        }

        // Validate dates
        const dateValidation = this.validateDates(data.startDate, data.endDate);
        if (!dateValidation.isValid) {
            errors.push(...dateValidation.errors);
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate bulk sponsorship
     */
    validateBulkSponsorship(data: {
        selectedWards: any[];
        executivesCount: number;
        maxExecutives: number;
        startDate: Date | null;
        endDate: Date | null;
    }): ValidationResult {
        const errors: string[] = [];

        // Validate ward selection
        if (data.selectedWards.length === 0) {
            errors.push('No wards selected. Please select at least one ward.');
        }

        // Validate executives count
        if (data.executivesCount < 1) {
            errors.push('At least 1 executive must be sponsored per ward');
        }

        if (data.executivesCount > data.maxExecutives) {
            errors.push(`Maximum ${data.maxExecutives} executives allowed per ward in this selection`);
        }

        // Validate dates
        const dateValidation = this.validateDates(data.startDate, data.endDate);
        if (!dateValidation.isValid) {
            errors.push(...dateValidation.errors);
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate date range
     */
    validateDates(startDate: Date | null, endDate: Date | null): ValidationResult {
        const errors: string[] = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (!startDate) {
            errors.push('Start date is required');
        }

        if (!endDate) {
            errors.push('End date is required');
        }

        if (startDate && endDate) {
            // Ensure start date is not in the past
            if (startDate < today) {
                errors.push('Start date cannot be in the past');
            }

            // Ensure end date is after start date
            if (endDate <= startDate) {
                errors.push('End date must be after start date');
            }

            // Ensure minimum sponsorship duration (1 month)
            const monthsDiff = this.calculateMonthsBetween(startDate, endDate);
            if (monthsDiff < 1) {
                errors.push('Sponsorship must be at least 1 month');
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate email format
     */
    isValidEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email.trim());
    }

    /**
     * Validate phone number (Indian format)
     */
    isValidPhoneNumber(phone: string): boolean {
        const phoneRegex = /^[6-9]\d{9}$/;
        return phoneRegex.test(phone.replace(/\s+/g, ''));
    }

    /**
     * Calculate months between two dates
     */
    private calculateMonthsBetween(startDate: Date, endDate: Date): number {
        const yearsDiff = endDate.getFullYear() - startDate.getFullYear();
        const monthsDiff = endDate.getMonth() - startDate.getMonth();
        return yearsDiff * 12 + monthsDiff;
    }

    /**
     * Sanitize input string
     */
    sanitizeInput(input: string): string {
        return input.trim().replace(/[<>]/g, '');
    }

    /**
     * Validate sponsorship amount
     */
    validateAmount(amount: number, minAmount: number = 1): ValidationResult {
        const errors: string[] = [];

        if (amount < minAmount) {
            errors.push(`Amount must be at least ₹${minAmount}`);
        }

        if (amount > 10000000) { // 1 crore max
            errors.push('Amount cannot exceed ₹1,00,00,000');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}