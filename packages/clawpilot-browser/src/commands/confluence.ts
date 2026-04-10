import type { Command } from 'commander';
import {
  createConfluenceChildPage,
  formatConfluencePage,
  getConfluencePage,
  resolveConfluenceCredentials,
  updateConfluencePage,
} from '@clawpilot/browser/confluence.js';
import { error, output, success } from '@clawpilot/browser/utils/output.js';

interface ConfluenceCommandOptions {
  title?: string;
  body?: string;
  json: boolean;
}

export function registerConfluenceCommands(program: Command): void {
  const confluence = program.command('confluence').description('Read and update Confluence pages');
  const page = confluence.command('page').description('Work with Confluence pages');

  page
    .command('get')
    .description('Look up a Confluence page by URL or page id')
    .argument('<page-ref>')
    .option('--json', 'Return structured JSON output', false)
    .action(
      async (pageRef: string, options: Pick<ConfluenceCommandOptions, 'json'>): Promise<void> => {
        try {
          const auth = resolveConfluenceCredentials();
          const result = await getConfluencePage({ pageRef, auth });
          if (options.json) {
            output(success(result));
            return;
          }

          console.log(formatConfluencePage(result));
        } catch (err) {
          output(
            error(
              'confluence_page_get_failed',
              err instanceof Error ? err.message : 'Confluence page lookup failed',
            ),
          );
        }
      },
    );

  page
    .command('create-child')
    .description('Create a child page under a parent Confluence page')
    .argument('<parent-ref>')
    .requiredOption('--title <title>', 'Title for the new child page')
    .requiredOption('--body <storage-body>', 'Confluence storage-format page body')
    .option('--json', 'Return structured JSON output', false)
    .action(async (parentRef: string, options: ConfluenceCommandOptions): Promise<void> => {
      try {
        const auth = resolveConfluenceCredentials();
        const result = await createConfluenceChildPage({
          parentRef,
          title: options.title ?? '',
          body: options.body ?? '',
          auth,
        });
        if (options.json) {
          output(success(result));
          return;
        }

        console.log(formatConfluencePage(result));
      } catch (err) {
        output(
          error(
            'confluence_page_create_failed',
            err instanceof Error ? err.message : 'Confluence child-page creation failed',
          ),
        );
      }
    });

  page
    .command('update')
    .description('Update a Confluence page title and/or body')
    .argument('<page-ref>')
    .option('--title <title>', 'New page title')
    .option('--body <storage-body>', 'New Confluence storage-format body')
    .option('--json', 'Return structured JSON output', false)
    .action(async (pageRef: string, options: ConfluenceCommandOptions): Promise<void> => {
      if (!options.title && options.body === undefined) {
        output(
          error(
            'missing_update_fields',
            'Provide --title, --body, or both when updating a Confluence page.',
          ),
        );
        return;
      }

      try {
        const auth = resolveConfluenceCredentials();
        const result = await updateConfluencePage({
          pageRef,
          title: options.title,
          body: options.body,
          auth,
        });
        if (options.json) {
          output(success(result));
          return;
        }

        console.log(formatConfluencePage(result));
      } catch (err) {
        output(
          error(
            'confluence_page_update_failed',
            err instanceof Error ? err.message : 'Confluence page update failed',
          ),
        );
      }
    });
}
