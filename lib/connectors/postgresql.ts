// Backwards-compatible re-export. The PostgreSQL connector logic now lives in
// the universal SQL engine (lib/connectors/engine/sql.ts). This module keeps
// `validateSqlIdentifier` reachable at its historical import path for the test
// harness (test/integration.test.ts) and the credentials save route. The
// connector is registered via a declarative SqlSpec in lib/connectors/specs.
export { validateSqlIdentifier, POSTGRES_IDENTIFIER_RE } from "./engine/sql";
