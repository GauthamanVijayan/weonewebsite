import { Injectable, inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { SponsorService } from './sponsor.service';
import { ERROR_MESSAGES, TOAST_MESSAGES } from '../constants/sponsor.constants';
import { environment } from 'src/environments/environment';

export interface RazorpayOptions {
    key: string;
    amount: number;
    currency: string;
    name: string;
    description: string;
    order_id: string;
    prefill: {
        name: string;
        email: string;
    };
    theme: {
        color: string;
    };
    handler: (response: RazorpaySuccessResponse) => void;
    modal: {
        ondismiss: () => void;
    };
}

export interface RazorpaySuccessResponse {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
}

declare global {
    interface Window {
        Razorpay: any;
    }
}

@Injectable({
    providedIn: 'root'
})
export class PaymentService {
    private sponsorService = inject(SponsorService);
    private messageService = inject(MessageService);
    private razorpayScriptLoaded = false;

    /**
     * Load Razorpay script
     */
    async loadRazorpayScript(): Promise<void> {
        if (this.razorpayScriptLoaded || typeof window.Razorpay !== 'undefined') {
            this.razorpayScriptLoaded = true;
            return;
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.async = true;
            
            script.onload = () => {
                this.razorpayScriptLoaded = true;
                console.log('✅ Razorpay script loaded successfully');
                resolve();
            };
            
            script.onerror = () => {
                console.error('❌ Failed to load Razorpay script');
                this.messageService.add({
                    ...TOAST_MESSAGES.SYSTEM_ERROR,
                    detail: ERROR_MESSAGES.RAZORPAY_SCRIPT_LOAD_FAILED
                });
                reject(new Error('Failed to load Razorpay script'));
            };
            
            document.head.appendChild(script);
        });
    }

    /**
     * Create Razorpay order
     */
    async createOrder(data: {
        sponsorshipId: string;
        amount: number;
        sponsorName: string;
        sponsorEmail: string;
    }): Promise<any> {
        try {
            const order = await this.sponsorService.createRazorpayOrder(data);
            console.log('✅ Razorpay order created:', order);
            return order;
        } catch (error) {
            console.error('❌ Failed to create Razorpay order:', error);
            throw error;
        }
    }

    /**
     * Open Razorpay payment modal
     */
    async openPaymentModal(
        orderId: string,
        amount: number,
        sponsorName: string,
        sponsorEmail: string,
        onSuccess: (response: RazorpaySuccessResponse) => void,
        onDismiss: () => void
    ): Promise<void> {
        try {
            await this.loadRazorpayScript();

            if (typeof window.Razorpay === 'undefined') {
                throw new Error('Razorpay is not loaded');
            }

            const options: RazorpayOptions = {
                key: environment.RAZORPAY_KEY_ID,
                amount: amount,
                currency: 'INR',
                name: 'Ward Sponsorship',
                description: 'Sponsorship Payment',
                order_id: orderId,
                prefill: {
                    name: sponsorName,
                    email: sponsorEmail
                },
                theme: {
                    color: '#3399cc'
                },
                handler: onSuccess,
                modal: {
                    ondismiss: onDismiss
                }
            };

            const razorpayInstance = new window.Razorpay(options);
            razorpayInstance.open();
        } catch (error) {
            console.error('❌ Failed to open Razorpay modal:', error);
            this.messageService.add({
                ...TOAST_MESSAGES.PAYMENT_FAILED,
                detail: ERROR_MESSAGES.PAYMENT_INIT_FAILED
            });
            throw error;
        }
    }

    /**
     * Process payment success
     */
    async processPaymentSuccess(data: {
        sponsorshipId: string;
        paymentId: string;
        orderId: string;
        signature: string;
    }): Promise<any> {
        try {
            const result = await this.sponsorService.processPaymentSuccess(data);
            console.log('✅ Payment processed successfully:', result);
            
            this.messageService.add({
                ...TOAST_MESSAGES.PAYMENT_SUCCESS,
                detail: 'Your sponsorship has been confirmed! Thank you for your support.'
            });
            
            return result;
        } catch (error) {
            console.error('❌ Failed to process payment:', error);
            this.messageService.add({
                ...TOAST_MESSAGES.PAYMENT_FAILED,
                detail: 'Payment verification failed. Please contact support.'
            });
            throw error;
        }
    }

    /**
     * Handle payment failure
     */
    handlePaymentFailure(error?: any): void {
        console.error('❌ Payment failed:', error);
        this.messageService.add({
            ...TOAST_MESSAGES.PAYMENT_FAILED,
            detail: error?.description || 'Payment was not completed. Please try again.'
        });
    }

    /**
     * Handle payment cancellation
     */
    handlePaymentCancellation(): void {
        console.log('ℹ️ Payment cancelled by user');
        this.messageService.add({
            severity: 'info',
            summary: 'Payment Cancelled',
            detail: 'You cancelled the payment. Your cart is still saved.',
            life: 4000
        });
    }

    /**
     * Format amount to paise (Razorpay requires amount in smallest currency unit)
     */
    formatAmountToPaise(amount: number): number {
        return Math.round(amount * 100);
    }

    /**
     * Format amount from paise to rupees
     */
    formatAmountFromPaise(amountInPaise: number): number {
        return amountInPaise / 100;
    }
}