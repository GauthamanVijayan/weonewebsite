/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as admin from "../admin.js";
import type * as importWards from "../importWards.js";
import type * as internal_users from "../internal/users.js";
import type * as payment from "../payment.js";
import type * as razorpayUtils from "../razorpayUtils.js";
import type * as sponsorships from "../sponsorships.js";
import type * as wards from "../wards.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  importWards: typeof importWards;
  "internal/users": typeof internal_users;
  payment: typeof payment;
  razorpayUtils: typeof razorpayUtils;
  sponsorships: typeof sponsorships;
  wards: typeof wards;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
