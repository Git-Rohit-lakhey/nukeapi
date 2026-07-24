import "server-only";
import type { ConnectorSpec } from "../engine/types";
import { HTTP_BATCH_0 } from "./http-batch-0";
import { HTTP_BATCH_1 } from "./http-batch-1";
import { HTTP_BATCH_2 } from "./http-batch-2";
import { HTTP_BATCH_3 } from "./http-batch-3";
import { HTTP_BATCH_4 } from "./http-batch-4";
import { HTTP_BATCH_5 } from "./http-batch-5";
import { HTTP_BATCH_6 } from "./http-batch-6";
import { SQL_SPECS } from "./sql";
import { CUSTOM_SPECS } from "./custom";

/**
 * THE single source of truth for every connector's behavior.
 *
 * Before the universal engine, each integration was a hand-written
 * `lib/connectors/<name>.ts` file. Now they are declarative specs: HTTP/SQL
 * connectors are pure configuration (no code), and the only functions that
 * exist are the generic, battle-tested engine in `../engine/*` plus the
 * `custom` escape hatch for non-HTTP transports (Mongo/S3/Redis/...).
 *
 * Adding a new REST or SQL connector is now a ONE-LINE config addition here —
 * no new code file, no new import, no new registry entry to wire by hand.
 */
export const CONNECTOR_SPECS: ConnectorSpec[] = [
  ...HTTP_BATCH_0,
  ...HTTP_BATCH_1,
  ...HTTP_BATCH_2,
  ...HTTP_BATCH_3,
  ...HTTP_BATCH_4,
  ...HTTP_BATCH_5,
  ...HTTP_BATCH_6,
  ...SQL_SPECS,
  ...CUSTOM_SPECS,
];

export function getSpec(key: string): ConnectorSpec | undefined {
  return CONNECTOR_SPECS.find((s) => s.key === key);
}
