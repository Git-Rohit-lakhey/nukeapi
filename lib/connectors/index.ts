import type { Integration } from "@/types/connector";
import type { ConnectorFn } from "./engine/types";
import { CONNECTOR_SPECS } from "./specs";
import { buildConnector } from "./engine";
import { CONNECTOR_META, ALL_CONNECTOR_META } from "./meta";

export type { ConnectorFn } from "./engine/types";
export { CONNECTOR_META, ALL_CONNECTOR_META };

/**
 * The runtime registry. Every connector function is derived from its
 * declarative spec via the universal engine — there are no per-connector
 * code files anymore. The orchestrator and all API routes consume this map;
 * they never care how a connector is implemented.
 */
export const CONNECTORS: Record<string, ConnectorFn> = {};
for (const spec of CONNECTOR_SPECS) {
  CONNECTORS[spec.key] = buildConnector(spec);
}

export function getConnector(name: string): ConnectorFn | undefined {
  return CONNECTORS[name];
}

export function isRegisteredIntegration(name: string): name is Integration {
  return Object.prototype.hasOwnProperty.call(CONNECTORS, name);
}

export const REGISTERED_INTEGRATIONS = Object.keys(CONNECTORS) as Integration[];
