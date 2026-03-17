import { describe, it, expect } from 'vitest';
import { parseSearchResults, extractReadableContent, fetchPage } from '@clawpilot/browser/web.js';

describe('parseSearchResults', () => {
  it('extracts title, url, snippet from DuckDuckGo HTML structure', () => {
    const html = `
      <html><body>
        <div data-testid="result">
          <a data-testid="result-title-a" href="https://example.com/page1">Example Page One</a>
          <span data-result="snippet">This is the first snippet text.</span>
        </div>
        <div data-testid="result">
          <a data-testid="result-title-a" href="https://example.com/page2">Example Page Two</a>
          <span data-result="snippet">This is the second snippet text.</span>
        </div>
      </body></html>
    `;

    const results = parseSearchResults(html, 5);

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      title: 'Example Page One',
      url: 'https://example.com/page1',
      snippet: 'This is the first snippet text.',
    });
    expect(results[1]).toEqual({
      title: 'Example Page Two',
      url: 'https://example.com/page2',
      snippet: 'This is the second snippet text.',
    });
  });

  it('returns empty array when no results found', () => {
    const html = '<html><body><p>No results here</p></body></html>';

    const results = parseSearchResults(html, 5);

    expect(results).toEqual([]);
  });

  it('respects maxResults limit', () => {
    const html = `
      <html><body>
        <div data-testid="result">
          <a data-testid="result-title-a" href="https://example.com/1">Result 1</a>
          <span data-result="snippet">Snippet 1</span>
        </div>
        <div data-testid="result">
          <a data-testid="result-title-a" href="https://example.com/2">Result 2</a>
          <span data-result="snippet">Snippet 2</span>
        </div>
        <div data-testid="result">
          <a data-testid="result-title-a" href="https://example.com/3">Result 3</a>
          <span data-result="snippet">Snippet 3</span>
        </div>
      </body></html>
    `;

    const results = parseSearchResults(html, 2);

    expect(results).toHaveLength(2);
    expect(results[0]?.title).toBe('Result 1');
    expect(results[1]?.title).toBe('Result 2');
  });

  it('skips results without title or url', () => {
    const html = `
      <html><body>
        <div data-testid="result">
          <span data-result="snippet">Orphan snippet with no link</span>
        </div>
        <div data-testid="result">
          <a data-testid="result-title-a" href="">Empty URL Title</a>
          <span data-result="snippet">Empty URL snippet</span>
        </div>
        <div data-testid="result">
          <a data-testid="result-title-a" href="https://example.com/valid">Valid Result</a>
          <span data-result="snippet">Valid snippet</span>
        </div>
      </body></html>
    `;

    const results = parseSearchResults(html, 5);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      title: 'Valid Result',
      url: 'https://example.com/valid',
      snippet: 'Valid snippet',
    });
  });
});

describe('extractReadableContent', () => {
  it('extracts article title and text content via Readability', () => {
    const html = `
      <html>
        <head><title>Article Title</title></head>
        <body>
          <article>
            <h1>Article Title</h1>
            <p>This is the first paragraph of the article. It contains enough text
            for Readability to consider this meaningful content worth extracting
            from the page. We need sufficient word count here.</p>
            <p>This is the second paragraph with additional details about the topic.
            Readability requires a reasonable amount of text content to properly
            identify and extract the main article from the surrounding page chrome
            and navigation elements.</p>
          </article>
        </body>
      </html>
    `;

    const result = extractReadableContent(html, 'https://example.com/article');

    expect(result.url).toBe('https://example.com/article');
    expect(result.title).toBe('Article Title');
    expect(result.content).toContain('first paragraph');
    expect(result.content).toContain('second paragraph');
    expect(result.wordCount).toBeGreaterThan(0);
  });

  it('returns raw text fallback when Readability fails', () => {
    const html = '<html><head><title>Simple</title></head><body>Hello world</body></html>';

    const result = extractReadableContent(html, 'https://example.com/simple');

    expect(result.url).toBe('https://example.com/simple');
    expect(result.title).toBe('Simple');
    expect(result.content).toContain('Hello world');
    expect(result.byline).toBeNull();
    expect(result.excerpt).toBeNull();
  });
});

describe('fetchPage', () => {
  it('rejects file:// URLs', async () => {
    await expect(fetchPage({ url: 'file:///etc/passwd' })).rejects.toThrow(
      'Unsupported URL scheme: file:. Only http: and https: are allowed.',
    );
  });

  it('rejects javascript: URLs', async () => {
    await expect(fetchPage({ url: 'javascript:alert(1)' })).rejects.toThrow(
      'Unsupported URL scheme: javascript:. Only http: and https: are allowed.',
    );
  });

  it('rejects invalid URLs', async () => {
    await expect(fetchPage({ url: 'not-a-url' })).rejects.toThrow();
  });
});
