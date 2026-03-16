import { Command } from "commander";
import { output, success } from "../utils/output.js";

export function registerHealthCommands(program: Command): void {
  const health = program
    .command("health")
    .description("Check browser availability and health");

  health
    .command("check-install")
    .description("Verify Playwright and browser binaries are installed")
    .action(async () => {
      output(success({ status: "stub" }));
    });

  health
    .command("check-session")
    .description("Verify browser auth session is valid")
    .action(async () => {
      output(success({ status: "stub" }));
    });

  health
    .command("full")
    .description("Full health report")
    .action(async () => {
      output(success({ status: "stub" }));
    });
}
