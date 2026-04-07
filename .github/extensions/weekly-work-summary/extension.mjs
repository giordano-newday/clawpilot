import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { joinSession } from '@github/copilot-sdk/extension';

const COMMAND_NAMES = new Set(['/weekly-work-summary', 'weekly-work-summary']);
const DEFAULT_PARENT_PAGE = 'https://newdaycards.atlassian.net/wiki/x/DQFHbwE';
const DEFAULT_TIME_WINDOW = 'Monday-to-today';
const DEFAULT_SUMMARY_STYLE = 'Balanced output';
const DEFAULT_EXECUTION_MODE = 'Full auto publish';
const VALID_EXECUTION_MODES = new Map([
  ['full auto publish', 'Full auto publish'],
  ['draft only', 'Draft only'],
]);

const EXTENSION_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(EXTENSION_DIR, '../../..');
const SKILL_PATH = path.join(REPO_ROOT, '.agents/skills/weekly-work-summary/SKILL.md');
const SOURCE_CHECKLIST_PATH = path.join(
  REPO_ROOT,
  '.agents/skills/weekly-work-summary/references/source-checklist.md',
);
const PAGE_TEMPLATE_PATH = path.join(
  REPO_ROOT,
  '.agents/skills/weekly-work-summary/references/page-template.md',
);

let cachedWorkflowContextPromise;

const session = await joinSession({
  hooks: {
    onSessionStart: async () => {
      await session.log('weekly-work-summary extension loaded', { ephemeral: true });
    },
    onUserPromptSubmitted: async (input) => {
      const parsed = parseWeeklyWorkSummaryCommand(input.prompt);
      if (!parsed) {
        return;
      }

      await session.log('Intercepted weekly-work-summary command', { ephemeral: true });

      if (parsed.kind === 'help') {
        return {
          modifiedPrompt: buildHelpPrompt(),
          additionalContext: await loadWorkflowContext(),
        };
      }

      if (parsed.kind === 'error') {
        return {
          modifiedPrompt: buildUsageErrorPrompt(parsed.message),
          additionalContext: await loadWorkflowContext(),
        };
      }

      return {
        modifiedPrompt: buildWorkflowPrompt(parsed),
        additionalContext: await loadWorkflowContext(),
      };
    },
  },
  tools: [],
});

function parseWeeklyWorkSummaryCommand(prompt) {
  const tokens = tokenize(prompt.trim());
  if (tokens.length === 0 || !COMMAND_NAMES.has(tokens[0])) {
    return null;
  }

  const options = {
    date: 'Today',
    parentPage: DEFAULT_PARENT_PAGE,
    timeWindow: DEFAULT_TIME_WINDOW,
    summaryStyle: DEFAULT_SUMMARY_STYLE,
    executionMode: DEFAULT_EXECUTION_MODE,
    operatorNote: '',
  };
  const notes = [];

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (token === '--help' || token === '-h') {
      return { kind: 'help' };
    }

    if (!token.startsWith('--')) {
      notes.push(token);
      continue;
    }

    const parsedFlag = parseFlag(token, tokens[index + 1]);
    if (!parsedFlag.ok) {
      return { kind: 'error', message: parsedFlag.message };
    }

    if (parsedFlag.consumedNextToken) {
      index += 1;
    }

    switch (parsedFlag.name) {
      case 'date':
        options.date = parsedFlag.value;
        break;
      case 'parent-page':
        options.parentPage = parsedFlag.value;
        break;
      case 'time-window':
        options.timeWindow = parsedFlag.value;
        break;
      case 'summary-style':
        options.summaryStyle = parsedFlag.value;
        break;
      case 'mode': {
        const normalizedMode = VALID_EXECUTION_MODES.get(parsedFlag.value.trim().toLowerCase());
        if (!normalizedMode) {
          return {
            kind: 'error',
            message:
              'Invalid `--mode` value. Use `Full auto publish` or `Draft only` (quote values that contain spaces).',
          };
        }
        options.executionMode = normalizedMode;
        break;
      }
      case 'draft-only':
        options.executionMode = 'Draft only';
        break;
      default:
        return {
          kind: 'error',
          message: `Unknown flag \`${parsedFlag.rawName}\`. Run \`/weekly-work-summary --help\` for usage.`,
        };
    }
  }

  options.operatorNote = notes.join(' ').trim();
  return { kind: 'command', ...options };
}

function parseFlag(token, nextToken) {
  const [rawName, inlineValue] = token.split(/=(.*)/s, 2);
  const name = rawName.replace(/^--/, '');

  if (name === 'draft-only') {
    return { ok: true, name, value: 'true', consumedNextToken: false, rawName };
  }

  const value = inlineValue ?? nextToken;
  if (!value || value.startsWith('--')) {
    return {
      ok: false,
      message: `Flag \`${rawName}\` requires a value.`,
    };
  }

  return { ok: true, name, value, consumedNextToken: inlineValue === undefined, rawName };
}

function tokenize(prompt) {
  const tokens = [];
  const matcher = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|[^\s]+/g;

  for (const match of prompt.matchAll(matcher)) {
    tokens.push(match[1] ?? match[2] ?? match[0]);
  }

  return tokens;
}

function buildHelpPrompt() {
  return [
    'Explain how to use the repo-local `/weekly-work-summary` command in this repository.',
    'Include supported flags, defaults, and at least two concrete examples.',
    'Cover these inputs explicitly: `--date`, `--parent-page`, `--time-window`, `--summary-style`, `--mode`, and `--draft-only`.',
    'State that the wrapper forwards into the repo-local weekly-work-summary workflow contract and that `--mode` accepts `Full auto publish` or `Draft only`.',
  ].join(' ');
}

function buildUsageErrorPrompt(message) {
  return [
    `The repo-local weekly-work-summary command was invoked incorrectly: ${message}`,
    'Explain the correct usage briefly, then show one full-auto example and one draft-only example.',
  ].join(' ');
}

function buildWorkflowPrompt(parsed) {
  const lines = [
    'Run the repo-local weekly work summary workflow for this repository.',
    'Use the injected weekly-work-summary contract and references as the authoritative workflow specification.',
    '',
    'Explicit inputs:',
    `- Date: ${parsed.date}`,
    `- Parent page: ${parsed.parentPage}`,
    `- Time window: ${parsed.timeWindow}`,
    `- Summary style: ${parsed.summaryStyle}`,
    `- Execution mode: ${parsed.executionMode}`,
  ];

  if (parsed.operatorNote) {
    lines.push(`- Operator note: ${parsed.operatorNote}`);
  }

  lines.push(
    '',
    'Follow the source order, hard-failure rules, deduplication rules, and publishing behavior from the injected contract exactly.',
    'If execution mode is `Draft only`, stop before publish and return the gathered draft plus evidence appendix.',
    'If execution mode is `Full auto publish`, complete the publish step under the specified parent page.',
  );

  return lines.join('\n');
}

async function loadWorkflowContext() {
  cachedWorkflowContextPromise ??= Promise.all([
    readFile(SKILL_PATH, 'utf8'),
    readFile(SOURCE_CHECKLIST_PATH, 'utf8'),
    readFile(PAGE_TEMPLATE_PATH, 'utf8'),
  ]).then(([skill, checklist, template]) =>
    [
      'Repo-local weekly work summary workflow contract. Treat these files as the source of truth for the command wrapper.',
      '',
      `--- ${path.relative(REPO_ROOT, SKILL_PATH)} ---`,
      skill,
      '',
      `--- ${path.relative(REPO_ROOT, SOURCE_CHECKLIST_PATH)} ---`,
      checklist,
      '',
      `--- ${path.relative(REPO_ROOT, PAGE_TEMPLATE_PATH)} ---`,
      template,
    ].join('\n'),
  );

  return cachedWorkflowContextPromise;
}
