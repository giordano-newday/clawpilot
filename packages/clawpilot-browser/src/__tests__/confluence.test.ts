import { describe, expect, it, vi } from 'vitest';
import {
  createConfluenceChildPage,
  getConfluencePage,
  parseConfluencePageId,
  resolveConfluenceCredentials,
  updateConfluencePage,
  type ConfluenceAuth,
  type JiraCliConfig,
} from '@clawpilot/browser/confluence.js';

function jsonResponse(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

describe('parseConfluencePageId', () => {
  it('accepts either a numeric page id or a Confluence page URL', () => {
    expect(parseConfluencePageId('6161891597')).toBe('6161891597');
    expect(
      parseConfluencePageId(
        'https://newdaycards.atlassian.net/wiki/spaces/~user/pages/6161891597/2026',
      ),
    ).toBe('6161891597');
  });

  it('returns null for unsupported refs', () => {
    expect(parseConfluencePageId('not-a-page-ref')).toBeNull();
  });
});

describe('resolveConfluenceCredentials', () => {
  it('reuses Jira env credentials plus Jira CLI login details', () => {
    const env = {
      JIRA_URL: 'https://newdaycards.atlassian.net',
      JIRA_API_TOKEN: 'jira-token',
    } satisfies Partial<NodeJS.ProcessEnv>;
    const jiraConfig: JiraCliConfig = {
      login: 'giordano.scalzo@newday.co.uk',
    };

    expect(resolveConfluenceCredentials(env, jiraConfig)).toEqual({
      siteBaseUrl: 'https://newdaycards.atlassian.net',
      apiBaseUrl: 'https://newdaycards.atlassian.net/wiki/api/v2',
      login: 'giordano.scalzo@newday.co.uk',
      apiToken: 'jira-token',
    });
  });
});

describe('getConfluencePage', () => {
  it('fetches a page by URL or id and normalizes the response', async () => {
    const auth: ConfluenceAuth = {
      siteBaseUrl: 'https://newdaycards.atlassian.net',
      apiBaseUrl: 'https://newdaycards.atlassian.net/wiki/api/v2',
      login: 'giordano.scalzo@newday.co.uk',
      apiToken: 'jira-token',
    };
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        id: '6161891597',
        status: 'current',
        title: '2026',
        spaceId: '3210313921',
        parentId: '5233803520',
        version: { number: 3 },
        body: { storage: { representation: 'storage', value: '<p>Hello</p>' } },
        _links: { webui: '/spaces/~user/pages/6161891597/2026' },
      }),
    );

    const result = await getConfluencePage(
      {
        pageRef: 'https://newdaycards.atlassian.net/wiki/spaces/~user/pages/6161891597/2026',
        auth,
      },
      fetchMock,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://newdaycards.atlassian.net/wiki/api/v2/pages/6161891597?body-format=storage',
      expect.objectContaining({
        headers: expect.objectContaining({
          accept: 'application/json',
          authorization: expect.stringMatching(/^Basic /),
        }),
      }),
    );
    expect(result).toEqual({
      id: '6161891597',
      status: 'current',
      title: '2026',
      spaceId: '3210313921',
      parentId: '5233803520',
      versionNumber: 3,
      body: '<p>Hello</p>',
      webUrl: 'https://newdaycards.atlassian.net/spaces/~user/pages/6161891597/2026',
    });
  });
});

describe('createConfluenceChildPage', () => {
  it('looks up the parent page before creating a child page in the same space', async () => {
    const auth: ConfluenceAuth = {
      siteBaseUrl: 'https://newdaycards.atlassian.net',
      apiBaseUrl: 'https://newdaycards.atlassian.net/wiki/api/v2',
      login: 'giordano.scalzo@newday.co.uk',
      apiToken: 'jira-token',
    };
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          id: '6161891597',
          status: 'current',
          title: '2026',
          spaceId: '3210313921',
          parentId: '5233803520',
          version: { number: 1 },
          body: { storage: { representation: 'storage', value: '' } },
          _links: { webui: '/spaces/~user/pages/6161891597/2026' },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: '7000000001',
          status: 'current',
          title: 'Weekly work summary - 2026-04-06',
          spaceId: '3210313921',
          parentId: '6161891597',
          version: { number: 1 },
          body: { storage: { representation: 'storage', value: '<p>Summary</p>' } },
          _links: { webui: '/spaces/~user/pages/7000000001/Weekly-work-summary-2026-04-06' },
        }),
      );

    const result = await createConfluenceChildPage(
      {
        parentRef: '6161891597',
        title: 'Weekly work summary - 2026-04-06',
        body: '<p>Summary</p>',
        auth,
      },
      fetchMock,
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://newdaycards.atlassian.net/wiki/api/v2/pages',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          spaceId: '3210313921',
          status: 'current',
          title: 'Weekly work summary - 2026-04-06',
          parentId: '6161891597',
          body: {
            representation: 'storage',
            value: '<p>Summary</p>',
          },
        }),
      }),
    );
    expect(result.id).toBe('7000000001');
    expect(result.parentId).toBe('6161891597');
  });
});

describe('updateConfluencePage', () => {
  it('increments the page version and preserves the existing title when only the body changes', async () => {
    const auth: ConfluenceAuth = {
      siteBaseUrl: 'https://newdaycards.atlassian.net',
      apiBaseUrl: 'https://newdaycards.atlassian.net/wiki/api/v2',
      login: 'giordano.scalzo@newday.co.uk',
      apiToken: 'jira-token',
    };
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          id: '7000000001',
          status: 'current',
          title: 'Weekly work summary - 2026-04-06',
          spaceId: '3210313921',
          parentId: '6161891597',
          version: { number: 2 },
          body: { storage: { representation: 'storage', value: '<p>Old</p>' } },
          _links: { webui: '/spaces/~user/pages/7000000001/Weekly-work-summary-2026-04-06' },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: '7000000001',
          status: 'current',
          title: 'Weekly work summary - 2026-04-06',
          spaceId: '3210313921',
          parentId: '6161891597',
          version: { number: 3 },
          body: { storage: { representation: 'storage', value: '<p>New</p>' } },
          _links: { webui: '/spaces/~user/pages/7000000001/Weekly-work-summary-2026-04-06' },
        }),
      );

    const result = await updateConfluencePage(
      {
        pageRef: '7000000001',
        body: '<p>New</p>',
        auth,
      },
      fetchMock,
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://newdaycards.atlassian.net/wiki/api/v2/pages/7000000001',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          id: '7000000001',
          status: 'current',
          title: 'Weekly work summary - 2026-04-06',
          spaceId: '3210313921',
          parentId: '6161891597',
          body: {
            representation: 'storage',
            value: '<p>New</p>',
          },
          version: {
            number: 3,
          },
        }),
      }),
    );
    expect(result.versionNumber).toBe(3);
    expect(result.body).toBe('<p>New</p>');
  });
});
