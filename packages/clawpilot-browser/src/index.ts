#!/usr/bin/env node

import { Command } from 'commander';
import { registerAuthCommands } from '@clawpilot/browser/commands/auth.js';
import { registerConfluenceCommands } from '@clawpilot/browser/commands/confluence.js';
import { registerHealthCommands } from '@clawpilot/browser/commands/health.js';
import { registerTeamsCommands } from '@clawpilot/browser/commands/teams.js';
import { registerWebCommands } from '@clawpilot/browser/commands/web.js';

const program = new Command();

program
  .name('clawpilot-browser')
  .description('Playwright-based browser CLI for Clawpilot')
  .version('0.1.0');

registerHealthCommands(program);
registerAuthCommands(program);
registerConfluenceCommands(program);
registerTeamsCommands(program);
registerWebCommands(program);

program.parse();
