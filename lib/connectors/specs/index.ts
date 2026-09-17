import type { ConnectorSpec } from "../engine/types";
import { HTTP_SPECS } from "./http";
import { SQL_SPECS } from "./sql";
import { HTTP_BATCH_1 } from "./http-batch-1";
import { HTTP_BATCH_2 } from "./http-batch-2";
import { HTTP_BATCH_3 } from "./http-batch-3";
import { HTTP_BATCH_4 } from "./http-batch-4";
import { HTTP_BATCH_5 } from "./http-batch-5";
import { HTTP_BATCH_6 } from "./http-batch-6";
import { CUSTOM_SPECS } from "./custom";

/**
 * THE single source of truth for every connector's behavior: all 78
 * integrations ship a real delete executor. Owner availability
 * (`connector_flags`) decides which ones customers may use — the registry
 * itself is complete.
 */
export const CONNECTOR_SPECS: ConnectorSpec[] = [
  ...HTTP_SPECS,
  ...SQL_SPECS,
  ...HTTP_BATCH_1,
  ...HTTP_BATCH_2,
  ...HTTP_BATCH_3,
  ...HTTP_BATCH_4,
  ...HTTP_BATCH_5,
  ...HTTP_BATCH_6,
  ...CUSTOM_SPECS,
];
