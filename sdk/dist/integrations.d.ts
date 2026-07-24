import type { Integration } from "./types.js";
/**
 * The full list of integrations NukeAPI can delete a user from.
 *
 * This is a plain, dependency-free array (no `zod` or other runtime
 * deps). It is kept in sync with the `Integration` union in
 * `./types.js` — both are the single source of truth for the SDK.
 */
export declare const INTEGRATIONS: Integration[];
/** Convenience alias. Same reference as `INTEGRATIONS`. */
export declare const INTEGRATION_LIST: Integration[];
//# sourceMappingURL=integrations.d.ts.map