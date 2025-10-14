// weone/src/types/convex-values.d.ts

// --- Module Declaration for 'convex/values' ---
// Satisfies the 'import { v } from "convex/values"' line in wards.ts and schema.ts.
declare module "convex/values" {
    // We declare the 'v' object with its common validator functions as 'any'
    // This provides a declaration without requiring the actual module.
    export const v: {
        string: () => any;
        number: () => any;
        id: (tableName: string) => any;
        object: (fields: Record<string, any>) => any;
        array: (item: any) => any;
        optional: (validator: any) => any;
        literal: (value: any) => any;
        union: (validators: any[]) => any;
    };
}

// --- Module Declaration for 'convex/server' ---
// Satisfies imports for query, mutation, QueryCtx, MutationCtx, etc.
declare module "convex/server" {
    export function defineSchema(schema: any): any;
    export function defineTable(fields: any): any;

    export function query(config: any): any;
    export function mutation(config: any): any;

    // Export the types that were implicitly 'any' in your handlers
    export type QueryCtx = {
        db: any;
        auth: any;
        scheduler: any;
        // Add other context fields you use
    };
    export type MutationCtx = QueryCtx & {
        // Mutations have the same fields as QueryCtx
    };
    
    // Include other common exports if needed
    export const internalQuery: any;
    export const internalMutation: any;
}

// --- Module Declaration for 'convex/browser' ---
// Satisfies imports used in the Angular client code.
declare module "convex/browser" {
    export class ConvexClient {
        constructor(config: { address: string } | string); 
        query: (name: any, args: any) => Promise<any>;
        mutation: (name: any, args: any) => Promise<any>;
        // Include other methods your Angular code uses
    }
}

// --- Module Declaration for base 'convex' (for the generated API) ---
// This ensures that the compiler is satisfied when you import the 'api' object.
declare module "convex" {
    export const api: any;
}