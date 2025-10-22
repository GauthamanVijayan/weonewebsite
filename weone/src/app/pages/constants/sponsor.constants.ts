/**
 * Sponsor Configuration Constants
 * Centralized configuration for the sponsor module
 */

export const SPONSOR_CONFIG = {
    /** Rate per executive in rupees */
    RATE_PER_EXECUTIVE: 15000,
    
    /** Maximum executives allowed per local body type */
    MAX_EXECUTIVES: {
        P: 3, // Panchayat
        M: 4, // Municipality
        C: 5  // Corporation
    } as const,
    
    /** Minimum sponsorship duration in months */
    MIN_SPONSORSHIP_MONTHS: 1,
    
    /** Default sponsorship duration */
    DEFAULT_SPONSORSHIP_MONTHS: 1,
    
    /** Maximum cart items allowed */
    MAX_CART_ITEMS: 100
} as const;

export const LOCAL_BODY_TYPE_OPTIONS = [
    { label: 'All Types', value: 'All' },
    { label: 'Panchayat', value: 'P' },
    { label: 'Municipality', value: 'M' },
    { label: 'Corporation', value: 'C' }
] as const;

export const LOCAL_BODY_TYPE_LABELS: Record<string, string> = {
    'P': 'Panchayat',
    'M': 'Municipality',
    'C': 'Corporation',
    'All': 'All Types'
};

export const SPONSOR_TYPE_OPTIONS = [
    { label: 'Individual', value: 'individual' },
    { label: 'Company', value: 'company' }
] as const;

/**
 * Toast message configurations
 */
export const TOAST_MESSAGES = {
    CART_ADDED: {
        severity: 'success' as const,
        summary: 'Added to Cart',
        life: 3000
    },
    CART_REMOVED: {
        severity: 'info' as const,
        summary: 'Removed from Cart',
        life: 3000
    },
    PAYMENT_SUCCESS: {
        severity: 'success' as const,
        summary: 'Payment Successful',
        detail: 'Your sponsorship has been confirmed!',
        life: 5000
    },
    PAYMENT_FAILED: {
        severity: 'error' as const,
        summary: 'Payment Failed',
        life: 5000
    },
    VALIDATION_ERROR: {
        severity: 'warn' as const,
        summary: 'Validation Error',
        life: 4000
    },
    CONFLICT_ERROR: {
        severity: 'warn' as const,
        summary: 'Selection Conflict',
        life: 4000
    },
    SYSTEM_ERROR: {
        severity: 'error' as const,
        summary: 'System Error',
        detail: 'An unexpected error occurred. Please try again.',
        life: 5000
    }
} as const;

/**
 * Error messages
 */
export const ERROR_MESSAGES = {
    PAYMENT_INIT_FAILED: 'Failed to initialize payment gateway. Please refresh and try again.',
    PAYMENT_CREATION_FAILED: 'Could not create payment order. Please try again.',
    SPONSORSHIP_CREATION_FAILED: 'Failed to create sponsorship. Please try again.',
    RAZORPAY_SCRIPT_LOAD_FAILED: 'Failed to load payment gateway. Please check your internet connection.',
    EMPTY_CART: 'Cart is empty. Please add wards to sponsor.',
    INVALID_EMAIL: 'Please enter a valid email address.',
    INVALID_NAME: 'Sponsor name is required.',
    INVALID_DATES: 'Please select valid start and end dates.',
    DATE_OVERLAP: 'Selected dates overlap with existing cart items.',
    HIERARCHY_CONFLICT: 'Selection conflicts with existing cart items.'
} as const;