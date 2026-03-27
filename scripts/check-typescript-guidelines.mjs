#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const SUPPORTED_EXTENSIONS = new Set(['.ts', '.tsx']);
const LARGE_FILE_WARNING_LINES = 300;
const MANY_EXPORTS_WARNING_COUNT = 8;

function git(args) {
  return execFileSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

const repoRoot = git(['rev-parse', '--show-toplevel']);

function gitInRepo(args) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function parseArgs(argv) {
  const files = [];
  let useStaged = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--staged') {
      useStaged = true;
      continue;
    }
    if (arg === '--files') {
      for (let fileIndex = index + 1; fileIndex < argv.length; fileIndex += 1) {
        files.push(argv[fileIndex]);
      }
      break;
    }
  }

  return { useStaged, files };
}

function getStagedTypeScriptFiles() {
  const output = gitInRepo([
    'diff',
    '--cached',
    '--name-only',
    '--diff-filter=ACMR',
    '--',
    '*.ts',
    '*.tsx',
  ]);
  return output
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeFileInput(file) {
  const absolutePath = path.isAbsolute(file) ? file : path.join(repoRoot, file);
  const extension = path.extname(absolutePath);
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    return null;
  }
  const relativePath = path.isAbsolute(file) ? path.relative(repoRoot, absolutePath) : file;
  return { absolutePath, relativePath };
}

function readFileContent(file, useStaged) {
  if (useStaged) {
    return gitInRepo(['show', `:${file.relativePath}`]);
  }
  if (!existsSync(file.absolutePath)) {
    throw new Error(`File does not exist: ${file.absolutePath}`);
  }
  return readFileSync(file.absolutePath, 'utf8');
}

function getLineNumber(content, index) {
  return content.slice(0, index).split('\n').length;
}

function collectMatches(content, pattern) {
  const matches = [];
  let match;
  pattern.lastIndex = 0;
  while ((match = pattern.exec(content)) !== null) {
    matches.push({
      index: match.index,
      line: getLineNumber(content, match.index),
      text: match[0],
    });
  }
  return matches;
}

function inspectFile(file, content) {
  const failures = [];
  const warnings = [];
  const lineCount = content.split('\n').length;
  const isPackageSource = /^packages\/[^/]+\/src\/.+\.(ts|tsx)$/.test(file.relativePath);
  const isTestFile =
    /(?:^|\/)__tests__\//.test(file.relativePath) ||
    /\.test\.(ts|tsx)$/.test(file.relativePath) ||
    /\.spec\.(ts|tsx)$/.test(file.relativePath);

  const failPatterns = [
    {
      rule: 'ts-suppression',
      pattern: /@ts-ignore|@ts-nocheck/g,
      message: 'Avoid TypeScript suppression comments in committed code.',
    },
    {
      rule: 'double-assertion',
      pattern: /\bas\s+unknown\s+as\b|\bas\s+any\s+as\b/g,
      message: 'Avoid double assertions; model the type properly or add a real narrowing step.',
      allowInTests: true,
    },
    {
      rule: 'explicit-any',
      pattern:
        /:\s*any\b|\bas\s+any\b|<\s*any\s*>|\bArray<\s*any\s*>|\bPromise<\s*any\s*>|\bRecord<[^>\n]*\bany\b/g,
      message: 'Avoid explicit any; prefer precise types or unknown plus narrowing.',
      allowInTests: true,
    },
    {
      rule: 'todo-markers',
      pattern: /\bTODO\b|\bFIXME\b|\bHACK\b/g,
      message: 'Resolve or remove TODO/FIXME/HACK markers before committing.',
    },
  ];

  for (const rule of failPatterns) {
    if (isTestFile && rule.allowInTests) {
      continue;
    }
    for (const match of collectMatches(content, rule.pattern)) {
      failures.push({
        file: file.relativePath,
        line: match.line,
        rule: rule.rule,
        message: rule.message,
      });
    }
  }

  if (isPackageSource) {
    for (const match of collectMatches(
      content,
      /^\s*(?:import|export)\s.+from\s+['"](\.{1,2}\/[^'"]*)['"]/gm,
    )) {
      failures.push({
        file: file.relativePath,
        line: match.line,
        rule: 'relative-import',
        message: 'Use the package root alias instead of relative imports inside package source.',
      });
    }

    for (const match of collectMatches(content, /^\s*export\s+default\b/gm)) {
      failures.push({
        file: file.relativePath,
        line: match.line,
        rule: 'default-export',
        message: 'Prefer named exports in package source files.',
      });
    }
  }

  if (lineCount > LARGE_FILE_WARNING_LINES) {
    warnings.push({
      file: file.relativePath,
      line: 1,
      rule: 'large-file',
      message: `File has ${lineCount} lines; consider splitting responsibilities before it grows further.`,
    });
  }

  const exportCount = collectMatches(content, /^\s*export\b/gm).length;
  if (exportCount > MANY_EXPORTS_WARNING_COUNT) {
    warnings.push({
      file: file.relativePath,
      line: 1,
      rule: 'many-exports',
      message: `File exports ${exportCount} symbols; consider shrinking the public surface or splitting the module.`,
    });
  }

  for (const match of collectMatches(content, /\?.*\?.*:.*:/g)) {
    warnings.push({
      file: file.relativePath,
      line: match.line,
      rule: 'nested-ternary',
      message: 'Nested ternaries make intent harder to follow; prefer explicit branching.',
    });
  }

  for (const match of collectMatches(
    content,
    /catch\s*(?:\([^)]*\))?\s*\{\s*(?:\/\/[^\n]*\n\s*|\/\*[\s\S]*?\*\/\s*)*\}/g,
  )) {
    warnings.push({
      file: file.relativePath,
      line: match.line,
      rule: 'empty-catch',
      message:
        'Empty catch blocks hide failure paths; document why they are safe or surface the error.',
    });
  }

  return { failures, warnings };
}

function formatIssue(issue) {
  return `- ${issue.file}:${issue.line} [${issue.rule}] ${issue.message}`;
}

const args = parseArgs(process.argv.slice(2));
const requestedFiles =
  args.files.length > 0
    ? args.files.map(normalizeFileInput).filter(Boolean)
    : getStagedTypeScriptFiles().map(normalizeFileInput);

if (requestedFiles.length === 0) {
  console.log('TypeScript guideline check: no matching files to inspect.');
  process.exit(0);
}

const failures = [];
const warnings = [];

for (const file of requestedFiles) {
  const content = readFileContent(file, args.useStaged);
  const result = inspectFile(file, content);
  failures.push(...result.failures);
  warnings.push(...result.warnings);
}

if (warnings.length > 0) {
  console.warn('TypeScript guideline warnings:');
  for (const warning of warnings) {
    console.warn(formatIssue(warning));
  }
}

if (failures.length > 0) {
  console.error('TypeScript guideline check failed:');
  for (const failure of failures) {
    console.error(formatIssue(failure));
  }
  process.exit(1);
}

console.log(
  `TypeScript guideline check passed for ${requestedFiles.length} file${
    requestedFiles.length === 1 ? '' : 's'
  }.`,
);
