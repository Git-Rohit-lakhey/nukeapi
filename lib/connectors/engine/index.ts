import "server-only";
import type { ConnectorFn, ConnectorSpec } from "./types";
import { httpConnector } from "./http";
import { sqlConnector } from "./sql";

export * from "./types";
export { interpolate, makeCtx, getPath } from "./interp";
export { validateSqlIdentifier, POSTGRES_IDENTIFIER_RE } from "./sql";

/**
 * Turn one declarative spec into a runtime connector function. This is the
 * single seam between "configuration" and "behavior": every HTTP/SQL
 * connector is config-only, and the only code that ever runs is the generic,
 * battle-tested engine below (+ the `custom` escape hatch for non-HTTP
 * transports like Mongo/S3/Redis).
 */
export function buildConnector(spec: ConnectorSpec): ConnectorFn {
  switch (spec.transport) {
    case "http":
      return httpConnector(spec);
    case "sql":
      return sqlConnector(spec);
    case "custom":
      return spec.run;
  }
}
