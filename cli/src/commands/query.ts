import { Command } from "commander";
import chalk from "chalk";
import { createClient } from "@supabase/supabase-js";
import ora from "ora";
import {
  loadConfig,
  isBilledReady,
  isDirectReady,
  needsConfigMessage,
  needsApiKeyMessage,
  DEFAULT_API_BASE,
} from "../lib/config.js";
import { validateQuery, ensureLimitClause } from "../lib/sql-validation.js";
import { printResults } from "../lib/display.js";

async function runBilledQuery(
  apiBase: string,
  apiKey: string,
  sql: string,
  limit: number,
): Promise<{ body: unknown; costUsd?: string }> {
  const finalSql = ensureLimitClause(sql, limit);
  const url = `${apiBase.replace(/\/$/, "")}/api/cli/query`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ sql: finalSql, limit }),
  });
  const costUsd = res.headers.get("x-api-cost-usd") ?? undefined;
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const err = body as { error?: string };
    throw new Error(err?.error ?? `HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return { body, costUsd };
}

async function runDirectQuery(supabaseUrl: string, serviceKey: string, sql: string, limit: number): Promise<unknown> {
  const validation = validateQuery(sql);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  const finalSql = ensureLimitClause(validation.sanitized, limit);
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc("exec_sql", { query: finalSql });
  if (error) {
    throw new Error(error.message);
  }
  return { results: data ?? [], count: Array.isArray(data) ? data.length : 0, sql: finalSql };
}

export function queryCommand(): Command {
  return new Command("query")
    .description("Run a read-only SQL query (billed: HTTP API, direct: Supabase exec_sql)")
    .argument("<sql>", "SELECT statement")
    .option("-l, --limit <n>", "Max rows when query has no LIMIT", "100")
    .action(async (sqlArg: string, opts: { limit?: string }, cmd: Command) => {
      const json = cmd.optsWithGlobals<{ json?: boolean }>().json ?? false;
      const limit = parseInt(String(opts.limit ?? "100"), 10) || 100;
      const cfg = await loadConfig();

      if (!isBilledReady(cfg) && !isDirectReady(cfg)) {
        if (cfg?.mode === "direct") {
          console.error(chalk.yellow(needsConfigMessage()));
        } else {
          console.error(chalk.yellow(needsApiKeyMessage()));
        }
        process.exitCode = 1;
        return;
      }

      const validation = validateQuery(sqlArg);
      if (!validation.valid) {
        console.error(chalk.red(validation.error));
        process.exitCode = 1;
        return;
      }

      if (isBilledReady(cfg)) {
        const apiBase = cfg!.apiBaseUrl ?? DEFAULT_API_BASE;
        const spinner = json ? null : ora("Running query…").start();
        try {
          const { body, costUsd } = await runBilledQuery(apiBase, cfg!.apiKey!, validation.sanitized, limit);
          spinner?.succeed("Done");
          printResults(body, json);
          if (!json && costUsd) {
            console.log(chalk.dim(`Cost: $${costUsd}`));
          }
        } catch (e) {
          spinner?.fail("Query failed");
          console.error(chalk.red(e instanceof Error ? e.message : String(e)));
          process.exitCode = 1;
        }
        return;
      }

      if (isDirectReady(cfg)) {
        const spinner = json ? null : ora("Running query…").start();
        try {
          const body = await runDirectQuery(cfg!.supabaseUrl!, cfg!.serviceRoleKey!, validation.sanitized, limit);
          spinner?.succeed("Done");
          printResults(body, json);
        } catch (e) {
          spinner?.fail("Query failed");
          console.error(chalk.red(e instanceof Error ? e.message : String(e)));
          process.exitCode = 1;
        }
        return;
      }
    });
}
