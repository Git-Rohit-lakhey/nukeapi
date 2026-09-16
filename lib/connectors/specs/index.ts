import type { ConnectorSpec } from "../engine/types";
import { HTTP_SPECS } from "./http";
import { SQL_SPECS } from "./sql";

export const CONNECTOR_SPECS: ConnectorSpec[] = [...HTTP_SPECS, ...SQL_SPECS];
