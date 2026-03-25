import { Command } from "commander";
import chalk from "chalk";
import {
  loadConfig,
  isBilledReady,
  needsApiKeyMessage,
  DEFAULT_API_BASE,
} from "../lib/config.js";
import { printResults } from "../lib/display.js";

export function balanceCommand(): Command {
  return new Command("balance")
    .description("Show account balance (billed mode)")
    .action(async (_opts, cmd: Command) => {
      const json = (cmd.optsWithGlobals() as { json?: boolean }).json ?? false;
      const cfg = await loadConfig();

      if (!isBilledReady(cfg)) {
        if (cfg?.mode === "direct") {
          console.error(chalk.yellow("Balance is only available in billed (API key) mode."));
        } else {
          console.error(chalk.yellow(needsApiKeyMessage()));
        }
        process.exitCode = 1;
        return;
      }

      const apiKey = cfg!.apiKey!;
      const apiBase = cfg!.apiBaseUrl ?? DEFAULT_API_BASE;
      const url = `${apiBase.replace(/\/$/, "")}/api/balance`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      const text = await res.text();
      let body: unknown;
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = { raw: text };
      }

      if (!res.ok) {
        const err = body as { error?: string; message?: string };
        console.error(chalk.red(err?.error ?? err?.message ?? `HTTP ${res.status}`));
        process.exitCode = 1;
        return;
      }

      printResults(body, json);
    });
}
