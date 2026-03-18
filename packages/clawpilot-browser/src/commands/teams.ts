import type { Command } from 'commander';
import { error, output, success } from '@clawpilot/browser/utils/output.js';
import {
  formatTeamsList,
  formatTeamsRead,
  listTeams,
  readTeams,
} from '@clawpilot/browser/teams.js';

interface TeamsCommandOptions {
  limit: string;
  offset: string;
  json: boolean;
}

export function registerTeamsCommands(program: Command): void {
  const teams = program
    .command('teams')
    .description('List and read Microsoft Teams chats and channels');

  teams
    .command('list')
    .description('List chats and channels from Teams')
    .option('--limit <n>', 'Maximum number of items to return', '20')
    .option('--offset <n>', 'Number of items to skip before listing', '0')
    .option('--json', 'Return structured JSON output', false)
    .action(async (options: TeamsCommandOptions): Promise<void> => {
      const pagination = parsePagination(options);
      if (!pagination.ok) {
        output(error('invalid_pagination', pagination.message));
        return;
      }

      try {
        const result = await listTeams(pagination.value);
        if (options.json) {
          output(success(result));
          return;
        }

        console.log(formatTeamsList(result));
      } catch (err) {
        output(
          error('teams_list_failed', err instanceof Error ? err.message : 'Teams list failed'),
        );
      }
    });

  teams
    .command('read')
    .description('Read messages from a chat or channel by id')
    .argument('<id>')
    .option('--limit <n>', 'Maximum number of messages to return', '20')
    .option('--offset <n>', 'Number of messages to skip before reading', '0')
    .option('--json', 'Return structured JSON output', false)
    .action(async (id: string, options: TeamsCommandOptions): Promise<void> => {
      const pagination = parsePagination(options);
      if (!pagination.ok) {
        output(error('invalid_pagination', pagination.message));
        return;
      }

      try {
        const result = await readTeams({ id, ...pagination.value });
        if (options.json) {
          output(success(result));
          return;
        }

        console.log(formatTeamsRead(result));
      } catch (err) {
        output(
          error('teams_read_failed', err instanceof Error ? err.message : 'Teams read failed'),
        );
      }
    });
}

function parsePagination(
  options: TeamsCommandOptions,
): { ok: true; value: { limit: number; offset: number } } | { ok: false; message: string } {
  const limit = Number.parseInt(options.limit, 10);
  const offset = Number.parseInt(options.offset, 10);

  if (Number.isNaN(limit) || limit <= 0) {
    return { ok: false, message: 'limit must be a positive integer' };
  }

  if (Number.isNaN(offset) || offset < 0) {
    return { ok: false, message: 'offset must be a non-negative integer' };
  }

  return { ok: true, value: { limit, offset } };
}
