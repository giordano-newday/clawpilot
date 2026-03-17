import type { Command } from 'commander';
import { fetchPage, searchWeb } from '@clawpilot/browser/web.js';
import { error, output, success } from '@clawpilot/browser/utils/output.js';

interface SearchCommandOptions {
  maxResults: string;
}

interface FetchCommandOptions {
  readability: boolean;
}

export function registerWebCommands(program: Command): void {
  const web = program.command('web').description('Search and fetch web content');

  web
    .command('search')
    .description('Search the web using DuckDuckGo')
    .argument('<query>')
    .option('--max-results <n>', 'Maximum number of results to return', '5')
    .action(async (query: string, opts: SearchCommandOptions): Promise<void> => {
      try {
        const maxResults = parseInt(opts.maxResults, 10);
        if (Number.isNaN(maxResults) || maxResults <= 0) {
          output(error('invalid_max_results', 'max-results must be a positive integer'));
          return;
        }
        const results = await searchWeb({ query, maxResults });
        output(success({ query, resultCount: results.length, results }));
      } catch (err: unknown) {
        output(error('search_failed', err instanceof Error ? err.message : 'Web search failed'));
      }
    });

  web
    .command('fetch')
    .description('Fetch a web page and extract content')
    .argument('<url>')
    .option('--readability', 'Extract article content using Readability', false)
    .action(async (url: string, opts: FetchCommandOptions): Promise<void> => {
      try {
        const result = await fetchPage({ url, readability: opts.readability });
        output(success(result));
      } catch (err: unknown) {
        output(error('fetch_failed', err instanceof Error ? err.message : 'Page fetch failed'));
      }
    });
}
