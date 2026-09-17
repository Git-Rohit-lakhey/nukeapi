import type { Integration } from "@/types/connector";
import type { ConnectorFn } from "./engine/types";
import { CONNECTOR_SPECS } from "./specs";
import { buildConnector } from "./engine";
import { CONNECTOR_META, ALL_CONNECTOR_META } from "./meta";

export type { ConnectorFn } from "./engine/types";
export { CONNECTOR_META, ALL_CONNECTOR_META };

export const CONNECTORS: Record<string, ConnectorFn> = {};
for (const spec of CONNECTOR_SPECS) {
  CONNECTORS[spec.key] = buildConnector(spec);
}

export function getConnector(name: string): ConnectorFn | undefined {
  return CONNECTORS[name];
}

/** True when the name has a real delete executor in this build (one of the 6 live specs). */
export function isRegisteredIntegration(name: string): name is Integration {
  return Object.prototype.hasOwnProperty.call(CONNECTORS, name);
}

/**
 * True when the name exists anywhere in the 78-entry catalog
 * (live executor OR coming-soon). Use this for admin gating, marketing and
 * docs; use isRegisteredIntegration when you need to actually run a delete.
 */
export function isCatalogIntegration(name: string): name is Integration {
  return Object.prototype.hasOwnProperty.call(CONNECTOR_META, name);
}

export const REGISTERED_INTEGRATIONS = Object.keys(CONNECTORS) as Integration[];

export const CATALOG_INTEGRATIONS = Object.keys(CONNECTOR_META) as Integration[];
