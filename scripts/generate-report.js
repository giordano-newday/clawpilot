#!/usr/bin/env node
/* global console, process */

/**
 * Generate test report dashboard, badges, and historical data
 *
 * Usage: node scripts/generate-report.js
 *
 * Expects:
 * - packages/clawpilot-browser/test-results.json (from vitest --reporter=json)
 * - packages/clawpilot-browser/coverage/coverage-summary.json (from vitest --coverage)
 *
 * Outputs:
 * - docs/reports/index.html (dashboard)
 * - docs/reports/badges/tests.json (shields.io endpoint)
 * - docs/reports/badges/coverage.json (shields.io endpoint)
 * - docs/reports/badges/tests.svg (inline SVG)
 * - docs/reports/badges/coverage.svg (inline SVG)
 * - docs/reports/history/data.json (historical data)
 * - docs/reports/coverage/ (coverage HTML copy)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { upsertHistoryRun } from './history-utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BROWSER_PKG = path.join(ROOT, 'packages', 'clawpilot-browser');
const REPORTS_DIR = path.join(ROOT, 'docs', 'reports');
const BADGES_DIR = path.join(REPORTS_DIR, 'badges');
const HISTORY_DIR = path.join(REPORTS_DIR, 'history');

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string safe for HTML insertion
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return String(str);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escape JSON for safe embedding in HTML script tags
 * Prevents script tag injection by escaping </
 * @param {object} obj - Object to serialize
 * @returns {string} JSON string safe for embedding in script tags
 */
function safeJsonStringify(obj) {
  return JSON.stringify(obj).replace(/<\//g, '<\\/');
}

/**
 * Map coverage percentage to a hex colour matching shields.io conventions
 * @param {number} pct
 * @returns {string} hex colour
 */
function coverageSvgColor(pct) {
  if (pct >= 90) return '#4c1';
  if (pct >= 80) return '#97ca00';
  if (pct >= 70) return '#dfb317';
  return '#e05d44';
}

/**
 * Generate a minimal flat-style SVG badge (shields.io flat style)
 * @param {string} label - Left side text
 * @param {string} message - Right side text
 * @param {string} color - Right side background colour (hex)
 * @returns {string} SVG markup
 */
function generateBadgeSvg(label, message, color) {
  const labelWidth = label.length * 6 + 10;
  const messageWidth = message.length * 6 + 10;
  const totalWidth = labelWidth + messageWidth;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20">
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <rect width="${totalWidth}" height="20" rx="3" fill="#555"/>
  <rect x="${labelWidth}" width="${messageWidth}" height="20" rx="3" fill="${color}"/>
  <rect width="${totalWidth}" height="20" rx="3" fill="url(#s)"/>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
    <text x="${Math.round(labelWidth / 2)}" y="15" fill="#010101" fill-opacity=".3">${escapeHtml(label)}</text>
    <text x="${Math.round(labelWidth / 2)}" y="14">${escapeHtml(label)}</text>
    <text x="${labelWidth + Math.round(messageWidth / 2)}" y="15" fill="#010101" fill-opacity=".3">${escapeHtml(message)}</text>
    <text x="${labelWidth + Math.round(messageWidth / 2)}" y="14">${escapeHtml(message)}</text>
  </g>
</svg>`;
}

async function main() {
  // Create directories
  await fs.mkdir(BADGES_DIR, { recursive: true });
  await fs.mkdir(HISTORY_DIR, { recursive: true });

  // Read test results
  const testResultsPath = path.join(BROWSER_PKG, 'test-results.json');
  let testResults;
  try {
    const content = await fs.readFile(testResultsPath, 'utf-8');
    testResults = JSON.parse(content);
  } catch (error) {
    console.error('Failed to read test-results.json:', error.message);
    console.error('Run: cd packages/clawpilot-browser && pnpm test:coverage');
    process.exit(1);
  }

  // Read coverage summary
  const coveragePath = path.join(BROWSER_PKG, 'coverage', 'coverage-summary.json');
  let coverage;
  try {
    const content = await fs.readFile(coveragePath, 'utf-8');
    coverage = JSON.parse(content);
  } catch (error) {
    console.error('Failed to read coverage-summary.json:', error.message);
    console.error('Run: cd packages/clawpilot-browser && pnpm test:coverage');
    process.exit(1);
  }

  // Extract metrics
  const totalTests = testResults.numTotalTests || 0;
  const passedTests = testResults.numPassedTests || 0;
  const failedTests = testResults.numFailedTests || 0;
  const coveragePercent = Math.round(coverage.total?.lines?.pct || 0);

  // Get commit info from environment
  const commitSha = process.env.GITHUB_SHA?.substring(0, 7) || 'local';
  const commitDate = new Date().toISOString().split('T')[0];

  console.log(`Tests: ${passedTests}/${totalTests} passing`);
  console.log(`Coverage: ${coveragePercent}%`);

  // Determine badge colors and messages
  const testsMessage = failedTests > 0 ? `${failedTests} failing` : `${passedTests} passing`;
  const testsColor = failedTests > 0 ? 'critical' : 'success';

  const coverageColor =
    coveragePercent >= 90
      ? 'brightgreen'
      : coveragePercent >= 80
        ? 'green'
        : coveragePercent >= 70
          ? 'yellow'
          : 'red';

  // Generate JSON badges for GitHub Pages (for shields.io dynamic badges)
  const testsBadge = {
    schemaVersion: 1,
    label: 'tests',
    message: testsMessage,
    color: testsColor,
  };

  const coverageBadge = {
    schemaVersion: 1,
    label: 'coverage',
    message: `${coveragePercent}%`,
    color: coverageColor,
  };

  await fs.writeFile(path.join(BADGES_DIR, 'tests.json'), JSON.stringify(testsBadge, null, 2));
  await fs.writeFile(
    path.join(BADGES_DIR, 'coverage.json'),
    JSON.stringify(coverageBadge, null, 2),
  );

  // Generate static SVG badges (committed to main, rendered inline by GitHub)
  await fs.writeFile(
    path.join(BADGES_DIR, 'tests.svg'),
    generateBadgeSvg('tests', testsMessage, testsColor === 'critical' ? '#e05d44' : '#4c1'),
  );
  await fs.writeFile(
    path.join(BADGES_DIR, 'coverage.svg'),
    generateBadgeSvg('coverage', `${coveragePercent}%`, coverageSvgColor(coveragePercent)),
  );

  console.log('Generated JSON and SVG badges');

  // Update history
  const historyPath = path.join(HISTORY_DIR, 'data.json');
  let history = { runs: [] };
  try {
    const content = await fs.readFile(historyPath, 'utf-8');
    const parsed = JSON.parse(content);

    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.runs)) {
      history = parsed;
    } else {
      console.warn(
        'Existing history file has unexpected structure; resetting to default { runs: [] }.',
      );
    }
  } catch {
    // No existing or invalid history; keep default { runs: [] }
  }

  // Upsert current run — replace existing entry for same date, or append if none
  const currentRun = {
    date: commitDate,
    commit: commitSha,
    tests: totalTests,
    passed: passedTests,
    failed: failedTests,
    coverage: coveragePercent,
  };
  history.runs = upsertHistoryRun(history.runs, currentRun);

  // Keep last 30 runs
  if (history.runs.length > 30) {
    history.runs = history.runs.slice(-30);
  }

  await fs.writeFile(historyPath, JSON.stringify(history, null, 2));
  console.log('Updated history');

  // Generate dashboard HTML
  const dashboardHtml = generateDashboard(testResults, coverage, history, commitSha);
  await fs.writeFile(path.join(REPORTS_DIR, 'index.html'), dashboardHtml);
  console.log('Generated dashboard');

  // Copy coverage report if exists
  const coverageHtmlDest = path.join(REPORTS_DIR, 'coverage');
  try {
    await fs.cp(path.join(BROWSER_PKG, 'coverage'), coverageHtmlDest, { recursive: true });
    console.log('Copied coverage report');
  } catch {
    console.log('No coverage HTML to copy');
  }

  console.log(`\nReport generated at: ${REPORTS_DIR}/index.html`);
}

function generateDashboard(testResults, coverage, history, commitSha) {
  const totalTests = testResults.numTotalTests || 0;
  const passedTests = testResults.numPassedTests || 0;
  const failedTests = testResults.numFailedTests || 0;
  const coveragePercent = Math.round(coverage.total?.lines?.pct || 0);

  const testFiles = testResults.testResults || [];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Clawpilot Test Report</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js" integrity="sha384-9nhczxUqK87bcKHh20fSQcTGD4qq5GhayNYSYWqwBkINBhOfQLg/P5HG5lF1urn4" crossorigin="anonymous"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0d1117;
      color: #c9d1d9;
      padding: 2rem;
      line-height: 1.6;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #58a6ff; margin-bottom: 0.5rem; }
    .subtitle { color: #8b949e; margin-bottom: 2rem; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 1.5rem;
      text-align: center;
    }
    .card-value { font-size: 2.5rem; font-weight: bold; }
    .card-label { color: #8b949e; font-size: 0.9rem; text-transform: uppercase; }
    .success { color: #3fb950; }
    .warning { color: #d29922; }
    .error { color: #f85149; }
    .chart-container { background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 1.5rem; margin-bottom: 2rem; }
    .section { background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 1.5rem; margin-bottom: 2rem; }
    .section h2 { color: #58a6ff; margin-bottom: 1rem; font-size: 1.2rem; }
    .test-file { padding: 0.5rem 0; border-bottom: 1px solid #30363d; display: flex; justify-content: space-between; }
    .test-file:last-child { border-bottom: none; }
    .test-file-name { font-family: monospace; font-size: 0.9rem; }
    .test-file-status { font-weight: bold; }
    a { color: #58a6ff; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .footer { text-align: center; color: #8b949e; font-size: 0.85rem; margin-top: 2rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Clawpilot Test Report</h1>
    <p class="subtitle">Commit: ${escapeHtml(commitSha)} | Generated: ${escapeHtml(new Date().toISOString())}</p>
    
    <div class="cards">
      <div class="card">
        <div class="card-value success">${passedTests}</div>
        <div class="card-label">Tests Passed</div>
      </div>
      <div class="card">
        <div class="card-value ${failedTests > 0 ? 'error' : 'success'}">${failedTests}</div>
        <div class="card-label">Tests Failed</div>
      </div>
      <div class="card">
        <div class="card-value">${totalTests}</div>
        <div class="card-label">Total Tests</div>
      </div>
      <div class="card">
        <div class="card-value ${coveragePercent >= 80 ? 'success' : coveragePercent >= 70 ? 'warning' : 'error'}">${coveragePercent}%</div>
        <div class="card-label">Coverage</div>
      </div>
    </div>

    <div class="chart-container">
      <canvas id="trendsChart"></canvas>
    </div>

    <div class="section">
      <h2>Test Files</h2>
      ${testFiles
        .map((file) => {
          const name = escapeHtml(file.name.replace(/.*\/tests\//, 'tests/'));
          const passed = file.status === 'passed';
          return `<div class="test-file">
          <span class="test-file-name">${name}</span>
          <span class="test-file-status ${passed ? 'success' : 'error'}">${passed ? 'PASS' : 'FAIL'}</span>
        </div>`;
        })
        .join('\n      ')}
    </div>

    <div class="section">
      <h2>Coverage Report</h2>
      <p><a href="./coverage/index.html">View full coverage report</a></p>
    </div>

    <div class="footer">
      <p>Generated by Clawpilot CI | <a href="https://github.com/giordano-newday/clawpilot">View Repository</a></p>
    </div>
  </div>

  <script>
    const history = ${safeJsonStringify(history.runs)};
    
    new Chart(document.getElementById('trendsChart'), {
      type: 'line',
      data: {
        labels: history.map(r => r.date),
        datasets: [
          {
            label: 'Tests Passed',
            data: history.map(r => r.passed),
            borderColor: '#3fb950',
            backgroundColor: 'rgba(63, 185, 80, 0.1)',
            tension: 0.3,
            fill: true,
          },
          {
            label: 'Coverage %',
            data: history.map(r => r.coverage),
            borderColor: '#58a6ff',
            backgroundColor: 'rgba(88, 166, 255, 0.1)',
            tension: 0.3,
            fill: true,
            yAxisID: 'coverage',
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: 'Test Trends (Last 30 Runs)', color: '#c9d1d9' },
          legend: { labels: { color: '#c9d1d9' } }
        },
        scales: {
          x: { ticks: { color: '#8b949e' }, grid: { color: '#30363d' } },
          y: { 
            position: 'left',
            ticks: { color: '#8b949e' }, 
            grid: { color: '#30363d' },
            title: { display: true, text: 'Tests', color: '#8b949e' }
          },
          coverage: {
            position: 'right',
            min: 0,
            max: 100,
            ticks: { color: '#8b949e' },
            grid: { display: false },
            title: { display: true, text: 'Coverage %', color: '#8b949e' }
          }
        }
      }
    });
  </script>
</body>
</html>`;
}

main().catch(console.error);
