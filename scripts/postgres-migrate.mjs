#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { createPostgresClientOptions } from "./postgres-client-options.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = path.join(rootDir, "database", "schema.sql");
const databaseUrl = process.env.DATABASE_URL;
const dryRun = process.argv.includes("--dry-run");

if (!databaseUrl && !dryRun) {
  console.error("DATABASE_URL is required. Use --dry-run to validate the migration file without connecting.");
  process.exit(1);
}

const sql = await readFile(schemaPath, "utf8");
const statementCount = sql
  .split(";")
  .map((statement) => statement.trim())
  .filter(Boolean).length;

if (dryRun) {
  console.log(`Postgres migration dry run ok: ${statementCount} statements loaded from ${schemaPath}`);
  process.exit(0);
}

const client = new pg.Client(createPostgresClientOptions(databaseUrl));

try {
  await client.connect();
  await client.query("begin");
  await client.query(sql);
  await client.query("commit");
  console.log(`Postgres migration applied: ${statementCount} statements from database/schema.sql`);
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
} finally {
  await client.end().catch(() => undefined);
}
