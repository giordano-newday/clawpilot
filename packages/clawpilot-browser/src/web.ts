import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import type { BrowserContext } from 'playwright';
import { DEFAULT_STATE_DIR } from './utils/paths.js';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface FetchResult {
  url: string;
  title: string;
  content: string;
  byline: string | null;
  excerpt: string | null;
  wordCount: number;
}

export interface SearchOptions {
  query: string;
  maxResults?: number;
}

export interface FetchOptions {
  url: string;
  readability?: boolean;
}

const DEFAULT_MAX_RESULTS = 5;
const NAVIGATION_TIMEOUT = 30_000;
const SEARCH_WAIT_TIMEOUT = 10_000;

/** Parse DuckDuckGo search result HTML into structured results. */
export function parseSearchResults(html: string, maxResults: number): SearchResult[] {
  const { document } = parseHTML(html);
  const containers = document.querySelectorAll('[data-testid="result"]');
  const results: SearchResult[] = [];

  for (const container of containers) {
    if (results.length >= maxResults) break;

    const anchor = container.querySelector('a[data-testid="result-title-a"]');
    if (!anchor) continue;

    const href = anchor.getAttribute('href') ?? '';
    const title = (anchor.textContent ?? '').trim();
    if (!title || !href) continue;

    const snippetEl = container.querySelector('[data-result="snippet"]');
    const snippet = (snippetEl?.textContent ?? '').trim();

    results.push({ title, url: href, snippet });
  }

  return results;
}

/** Extract readable content from HTML using Readability with linkedom fallback. */
export function extractReadableContent(html: string, url: string): FetchResult {
  const { document } = parseHTML(html);

  const reader = new Readability(document);
  const article = reader.parse();

  if (article) {
    const content = article.textContent ?? '';
    return {
      url,
      title: article.title ?? '',
      content,
      byline: article.byline ?? null,
      excerpt: article.excerpt ?? null,
      wordCount: content.split(/\s+/).filter(Boolean).length,
    };
  }

  const title = document.querySelector('title')?.textContent ?? '';
  const bodyText = (document.body?.textContent ?? '').trim();

  return {
    url,
    title,
    content: bodyText,
    byline: null,
    excerpt: null,
    wordCount: bodyText.split(/\s+/).filter(Boolean).length,
  };
}

/** Search the web using DuckDuckGo via Playwright headless browser. */
export async function searchWeb(options: SearchOptions): Promise<SearchResult[]> {
  const maxResults = options.maxResults ?? DEFAULT_MAX_RESULTS;
  const encoded = encodeURIComponent(options.query);
  const searchUrl = `https://duckduckgo.com/?q=${encoded}&ia=web`;

  const { chromium } = await import('playwright');
  let context: BrowserContext | undefined;

  try {
    context = await chromium.launchPersistentContext(DEFAULT_STATE_DIR, {
      headless: true,
    });
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(searchUrl, { timeout: NAVIGATION_TIMEOUT });
    await page.waitForSelector('[data-testid="result"]', { timeout: SEARCH_WAIT_TIMEOUT });
    const html = await page.content();
    return parseSearchResults(html, maxResults);
  } finally {
    if (context) await context.close();
  }
}

/** Fetch a web page and optionally extract readable content. */
export async function fetchPage(options: FetchOptions): Promise<FetchResult> {
  const parsedUrl = new URL(options.url);
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error(
      `Unsupported URL scheme: ${parsedUrl.protocol}. Only http: and https: are allowed.`,
    );
  }

  const { chromium } = await import('playwright');
  let context: BrowserContext | undefined;

  try {
    context = await chromium.launchPersistentContext(DEFAULT_STATE_DIR, {
      headless: true,
    });
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(options.url, {
      timeout: NAVIGATION_TIMEOUT,
      waitUntil: 'domcontentloaded',
    });

    if (options.readability) {
      const html = await page.content();
      return extractReadableContent(html, options.url);
    }

    const title = await page.title();
    const content = await page.evaluate(() => document.body.innerText);
    const wordCount = content.split(/\s+/).filter(Boolean).length;

    return {
      url: options.url,
      title,
      content,
      byline: null,
      excerpt: null,
      wordCount,
    };
  } finally {
    if (context) await context.close();
  }
}
