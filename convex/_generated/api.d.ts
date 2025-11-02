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
import type * as aiServices from "../aiServices.js";
import type * as auth from "../auth.js";
import type * as http from "../http.js";
import type * as phoneAuth from "../phoneAuth.js";
import type * as prompts from "../prompts.js";
import type * as render from "../render.js";
import type * as tasks from "../tasks.js";
import type * as twilioVerify from "../twilioVerify.js";
import type * as users from "../users.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  aiServices: typeof aiServices;
  auth: typeof auth;
  http: typeof http;
  phoneAuth: typeof phoneAuth;
  prompts: typeof prompts;
  render: typeof render;
  tasks: typeof tasks;
  twilioVerify: typeof twilioVerify;
  users: typeof users;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
