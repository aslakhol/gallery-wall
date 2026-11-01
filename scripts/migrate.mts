import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

// Apply db/schema.sql. Every statement is idempotent, so this is safe to run repeatedly.
const sql = neon(process.env.DATABASE_URL!);
const statements = readFileSync("db/schema.sql", "utf8")
  .replace(/--.*$/gm, "")
  .split(";")
  .map((statement) => statement.trim())
  .filter(Boolean);
for (const statement of statements) await sql.query(statement);
console.log(`Applied ${statements.length} statements`);
