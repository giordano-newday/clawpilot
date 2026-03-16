import { Command } from "commander";
import { output, success, error } from "../utils/output.js";
import { BrowserManager } from "../browser.js";

export function registerAuthCommands(program: Command): void {
  const auth = program
    .command("auth")
    .description("Manage browser authentication");

  auth
    .command("login")
    .description("Launch browser for manual Office 365 login")
    .action(async () => {
      const manager = new BrowserManager();
      const result = await manager.login();
      if (result.success) {
        output(success({ message: result.message }));
      } else {
        output(error("login_timeout", result.message));
      }
    });

  auth
    .command("status")
    .description("Check if browser session is valid")
    .action(async () => {
      const manager = new BrowserManager();
      if (!manager.hasSession()) {
        output(
          success({
            authenticated: false,
            session_age_hours: null,
            message: "No session found. Run: clawpilot-browser auth login",
          })
        );
        return;
      }
      output(
        success({
          authenticated: true,
          session_age_hours: null,
          message: "Session found. Use 'health full' for deep validation.",
        })
      );
    });

  auth
    .command("clear")
    .description("Clear saved browser session")
    .action(async () => {
      const manager = new BrowserManager();
      manager.clearSession();
      output(success({ message: "Browser session cleared." }));
    });
}
