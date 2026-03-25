#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import { configCommand } from "./commands/config.js";
import { queryCommand } from "./commands/query.js";
import { schemaCommand } from "./commands/schema.js";
import { balanceCommand } from "./commands/balance.js";
import { manifestCommand } from "./commands/manifest.js";
import { agentCommand } from "./commands/agent.js";

const program = new Command();

program
  .name("riskmodels")
  .description("RiskModels CLI — SQL query, schema, billing, and agent manifests")
  .version("1.0.1", "-V, --version", "output version")
  .option("--json", "JSON output for query, schema, balance, config list")
  .configureHelp({ sortSubcommands: true })
  .addHelpText(
    "after",
    `
${chalk.bold("Quick start")}
  ${chalk.dim("$")} riskmodels config init
  ${chalk.dim("$")} riskmodels query ${chalk.green('"SELECT ticker FROM ticker_metadata LIMIT 3"')}
  ${chalk.dim("$")} riskmodels manifest --format anthropic

${chalk.bold("Docs")} https://riskmodels.net/docs/api`,
  );

program.addCommand(configCommand());
program.addCommand(queryCommand());
program.addCommand(schemaCommand());
program.addCommand(balanceCommand());
program.addCommand(manifestCommand());
program.addCommand(agentCommand());

await program.parseAsync(process.argv);
