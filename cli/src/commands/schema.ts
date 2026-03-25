import { Command } from "commander";
import chalk from "chalk";
import { loadConfig, isDirectReady, needsConfigMessage } from "../lib/config.js";
import { printResults } from "../lib/display.js";

function sanitizeTableName(name: string): string | null {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    return null;
  }
  return name;
}

export function schemaCommand(): Command {
  return new Command("schema")
    .description("Inspect PostgREST schema (direct / Supabase mode only)")
    .option("-t, --table <name>", "Show a single table definition")
    .action(async (opts: { table?: string }, cmd: Command) => {
      const json = cmd.optsWithGlobals<{ json?: boolean }>().json ?? false;
      const cfg = await loadConfig();

      if (!isDirectReady(cfg)) {
        if (cfg?.mode === "billed") {
          console.error(
            chalk.yellow(
              "Schema introspection is only available in direct (Supabase) mode. Use the Supabase dashboard or run: riskmodels config init and choose Service Role mode.",
            ),
          );
        } else {
          console.error(chalk.yellow(needsConfigMessage()));
        }
        process.exitCode = 1;
        return;
      }

      if (opts.table) {
        const safe = sanitizeTableName(opts.table);
        if (!safe) {
          console.error(chalk.red("Invalid table name"));
          process.exitCode = 1;
          return;
        }
      }

      const base = cfg!.supabaseUrl!.replace(/\/$/, "");
      const url = `${base}/rest/v1/`;
      const key = cfg!.serviceRoleKey!;
      const res = await fetch(url, {
        headers: {
          Accept: "application/openapi+json",
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
      });

      if (!res.ok) {
        const t = await res.text();
        console.error(chalk.red(`OpenAPI fetch failed: ${res.status} ${t.slice(0, 300)}`));
        process.exitCode = 1;
        return;
      }

      const spec = (await res.json()) as {
        paths?: Record<string, unknown>;
        definitions?: Record<string, unknown>;
        components?: { schemas?: Record<string, unknown> };
      };

      const schemas = spec.definitions ?? spec.components?.schemas ?? {};

      if (opts.table) {
        const safe = sanitizeTableName(opts.table!)!;
        const tableKey = Object.keys(schemas).find((k) => k.toLowerCase() === safe.toLowerCase());
        if (!tableKey) {
          console.error(chalk.red(`Table not found in OpenAPI schemas: ${safe}`));
          process.exitCode = 1;
          return;
        }
        printResults({ table: tableKey, schema: schemas[tableKey] }, json);
        return;
      }

      const names = Object.keys(schemas).sort();
      if (json) {
        printResults({ tables: names, openapi_version: (spec as { openapi?: string }).openapi }, true);
      } else {
        console.log(chalk.bold("Tables (from OpenAPI schemas):"));
        for (const n of names) {
          console.log(`  ${n}`);
        }
        console.log(chalk.dim(`\nDetail: riskmodels schema --table <name>`));
      }
    });
}
