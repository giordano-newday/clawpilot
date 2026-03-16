#!/usr/bin/env node
/* global console, process */

/**
 * Update test and coverage badges
 *
 * Usage: node scripts/update-badges.js
 *
 * Expects:
 * - packages/clawpilot-browser/test-results.json (from vitest --reporter=json)
 * - packages/clawpilot-browser/coverage/coverage-summary.json (from vitest --coverage)
 *
 * Outputs:
 * - docs/reports/badges/tests.svg
 * - docs/reports/badges/coverage.svg
 *
 * This is a lightweight script for pre-push hooks.
 * For full report generation, use scripts/generate-report.js
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BROWSER_PKG = path.join(ROOT, 'packages', 'clawpilot-browser');
const BADGES_DIR = path.join(ROOT, 'docs', 'reports', 'badges');

/**
 * Generate SVG badge (shields.io style)
 * @param {string} label - Left side text
 * @param {string} message - Right side text
 * @param {string} color - Badge color
 * @returns {string} SVG markup
 */
function generateBadgeSvg(label, message, color) {
  const colors = {
    brightgreen: '#4c1',
    green: '#97ca00',
    yellow: '#dfb317',
    red: '#e05d44',
    critical: '#e05d44',
    success: '#4c1',
  };

  const badgeColor = colors[color] || '#9f9f9f';

  const getTextWidth = (text) => {
    let width = 0;
    for (const char of text) {
      if ('iltI1t'.includes(char)) width += 4;
      else if ('mwMW'.includes(char)) width += 9;
      else if (char === ' ') width += 3.5;
      else if (char === '%') width += 8.5;
      else if (/[a-z]/.test(char)) width += 6;
      else if (/[A-Z]/.test(char)) width += 7.5;
      else if (/[0-9]/.test(char)) width += 6.5;
      else width += 6;
    }
    return width;
  };

  const labelWidth = Math.round(getTextWidth(label) + 13);
  const messageWidth = Math.round(getTextWidth(message) + 13);
  const totalWidth = labelWidth + messageWidth;
  const labelX = (labelWidth / 2) * 10;
  const messageX = (labelWidth + messageWidth / 2) * 10;
  const labelTextLength = Math.round((labelWidth - 10) * 10);
  const messageTextLength = Math.round((messageWidth - 10) * 10);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${label}: ${message}">
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${messageWidth}" height="20" fill="${badgeColor}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
    <text aria-hidden="true" x="${labelX}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${labelTextLength}">${label}</text>
    <text x="${labelX}" y="140" transform="scale(.1)" fill="#fff" textLength="${labelTextLength}">${label}</text>
    <text aria-hidden="true" x="${messageX}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${messageTextLength}">${message}</text>
    <text x="${messageX}" y="140" transform="scale(.1)" fill="#fff" textLength="${messageTextLength}">${message}</text>
  </g>
</svg>`;
}

async function main() {
  await fs.mkdir(BADGES_DIR, { recursive: true });

  // Read test results
  let testResults;
  try {
    const content = await fs.readFile(path.join(BROWSER_PKG, 'test-results.json'), 'utf-8');
    testResults = JSON.parse(content);
  } catch (error) {
    console.error(
      'Failed to read test-results.json. Ensure you have run tests to generate this file.',
      error.message,
    );
    process.exit(1);
  }

  // Read coverage summary
  let coverage;
  try {
    const content = await fs.readFile(
      path.join(BROWSER_PKG, 'coverage', 'coverage-summary.json'),
      'utf-8',
    );
    coverage = JSON.parse(content);
  } catch (error) {
    console.error(
      'Failed to read coverage-summary.json. Generate it with "pnpm test:coverage".',
      error.message,
    );
    process.exit(1);
  }

  const passedTests = testResults.numPassedTests || 0;
  const failedTests = testResults.numFailedTests || 0;
  const coveragePercent = Math.round(coverage.total?.lines?.pct || 0);

  // Generate badges
  const testsMessage = failedTests > 0 ? `${failedTests} failing` : `${passedTests} passing`;
  const testsColor = failedTests > 0 ? 'critical' : 'success';
  const testsBadge = generateBadgeSvg('tests', testsMessage, testsColor);

  const coverageColor =
    coveragePercent >= 90
      ? 'brightgreen'
      : coveragePercent >= 80
        ? 'green'
        : coveragePercent >= 70
          ? 'yellow'
          : 'red';
  const coverageBadge = generateBadgeSvg('coverage', `${coveragePercent}%`, coverageColor);

  await fs.writeFile(path.join(BADGES_DIR, 'tests.svg'), testsBadge);
  await fs.writeFile(path.join(BADGES_DIR, 'coverage.svg'), coverageBadge);

  console.log(`Badges updated: ${passedTests} passing, ${coveragePercent}% coverage`);
}

main().catch((error) => {
  console.error('Failed to update badges:', error);
  process.exit(1);
});
