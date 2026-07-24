import type { SqlSpec } from "../engine/types";

/**
 * All SQL-backed connectors are pure config — the universal sqlConnector
 * engine handles pg / mysql / libsql behind one spec shape. Adding another
 * SQL database is a one-line addition here, no new code file.
 */
export const SQL_SPECS: SqlSpec[] = [
  {
    key: "postgresql",
    transport: "sql",
    label: "PostgreSQL",
    driver: "pg",
    connectionStringField: "connection_string",
    tableField: "table_name",
    columnField: "email_column",
    placeholder: "$1",
  },
  {
    key: "mysql",
    transport: "sql",
    label: "MySQL",
    driver: "mysql",
    connectionStringField: "connection_string",
    tableField: "table_name",
    columnField: "email_column",
    placeholder: "?",
  },
  {
    key: "planetscale",
    transport: "sql",
    label: "PlanetScale",
    driver: "mysql",
    connectionStringField: "connection_string",
    tableField: "table_name",
    columnField: "email_column",
    placeholder: "?",
  },
  {
    key: "neon",
    transport: "sql",
    label: "Neon",
    driver: "pg",
    connectionStringField: "connection_string",
    tableField: "table_name",
    columnField: "email_column",
    placeholder: "$1",
  },
  {
    key: "turso",
    transport: "sql",
    label: "Turso",
    driver: "libsql",
    connectionStringField: "database_url",
    authTokenField: "auth_token",
    tableField: "table_name",
    columnField: "email_column",
    placeholder: "?",
  },
];
