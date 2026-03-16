import { Command } from "commander";
import { output, success } from "../utils/output.js";

export function registerAuthCommands(program: Command): void {
  const auth = program
    .command("auth")
    .description("Manage browser authentication");

  auth
    .command("login")
    .description("Launch browser for manual Office 365 login")
    .action(async () => {
      output(success({ status: "stub" }));
    });

  auth
    .command("status")
    .description("Check if browser session is valid")
    .action(async () => {
      output(success({ status: "stub" }));
    });

  auth
    .command("clear")
    .description("Clear saved browser session")
    .action(async () => {
      output(success({ status: "stub" }));
    });
}
