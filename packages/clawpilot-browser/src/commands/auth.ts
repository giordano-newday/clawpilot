import { Command } from 'commander';
import { output, success, error } from '../utils/output.js';
import { BrowserManager } from '../browser.js';

export function registerAuthCommands(program: Command): void {
  const auth = program.command('auth').description('Manage browser authentication');

  auth
    .command('login')
    .description('Launch browser for manual Office 365 login')
    .action(async () => {
      const manager = new BrowserManager();
      const result = await manager.login();
      if (result.success) {
        output(success({ message: result.message }));
      } else {
        output(error('login_timeout', result.message));
      }
    });

  auth
    .command('status')
    .description('Check if browser session is valid')
    .option('--validate', 'Check whether the saved session is still active', false)
    .action(async (options: { validate: boolean }) => {
      const manager = new BrowserManager();
      if (!manager.hasSession()) {
        output(
          success({
            authenticated: false,
            message: 'No browser session found. Run: clawpilot-browser auth login',
          }),
        );
        return;
      }
      if (!options.validate) {
        const metadata = manager.getSessionMetadata();
        output(
          success({
            authenticated: true,
            validated: false,
            ...metadata,
            message: 'Session files exist. Use --validate to check if session is still active.',
          }),
        );
        return;
      }

      try {
        const result = await manager.validateSession();
        const message =
          result.teamsAccessible && result.outlookAccessible
            ? 'Session is valid. Teams and Outlook are accessible.'
            : result.teamsAccessible
              ? 'Session is valid. Teams is accessible (Outlook check failed).'
              : result.outlookAccessible
                ? 'Session is valid. Outlook is accessible (Teams check failed).'
                : 'Session has expired. Run: clawpilot-browser auth login';
        output(
          success({
            authenticated: result.valid,
            validated: true,
            teamsAccessible: result.teamsAccessible,
            outlookAccessible: result.outlookAccessible,
            ...(Object.prototype.hasOwnProperty.call(result, 'expiresAt')
              ? {
                  expiresAt: result.expiresAt,
                  expirySource: result.expirySource,
                  expiryConfidence: result.expiryConfidence,
                  lastValidatedAt: result.lastValidatedAt,
                  lastValidatedResult: result.lastValidatedResult,
                }
              : {}),
            message,
          }),
        );
      } catch (err) {
        output(
          error(
            'validation_failed',
            err instanceof Error ? err.message : 'Session validation failed',
          ),
        );
      }
    });

  auth
    .command('clear')
    .description('Clear saved browser session')
    .action(async () => {
      const manager = new BrowserManager();
      manager.clearSession();
      output(success({ message: 'Browser session cleared.' }));
    });
}
