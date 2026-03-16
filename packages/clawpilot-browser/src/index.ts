#!/usr/bin/env node

import { Command } from 'commander';
import { registerHealthCommands } from './commands/health.js';
import { registerAuthCommands } from './commands/auth.js';
import { registerWebCommands } from './commands/web.js';

const program = new Command();

program
  .name('clawpilot-browser')
  .description('Playwright-based browser CLI for Clawpilot')
  .version('0.1.0');

registerHealthCommands(program);
registerAuthCommands(program);
registerWebCommands(program);

program.parse();
