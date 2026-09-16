import type { SqlSpec } from "../engine/types";

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
];
