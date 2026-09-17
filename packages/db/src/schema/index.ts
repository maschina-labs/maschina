/**
 * The database schema. The permanent record comes first: an append-only events table that the
 * database itself refuses to update or delete. Everything else is derived from it.
 */

export * from "./events.ts";
