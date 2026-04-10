import { existsSync, readFileSync } from 'node:fs';

const DEFAULT_JIRA_CONFIG_PATH = `${process.env.HOME ?? ''}/.config/.jira/.config.yml`;

type FetchFn = typeof globalThis.fetch;

export interface JiraCliConfig {
  login?: string;
}

export interface ConfluenceAuth {
  siteBaseUrl: string;
  apiBaseUrl: string;
  login: string;
  apiToken: string;
}

export interface ConfluencePage {
  id: string;
  status: string;
  title: string;
  spaceId: string;
  parentId: string | null;
  versionNumber: number;
  body: string;
  webUrl: string;
}

export interface GetConfluencePageOptions {
  pageRef: string;
  auth: ConfluenceAuth;
}

export interface CreateConfluenceChildPageOptions {
  parentRef: string;
  title: string;
  body: string;
  auth: ConfluenceAuth;
}

export interface UpdateConfluencePageOptions {
  pageRef: string;
  title?: string;
  body?: string;
  auth: ConfluenceAuth;
}

interface ConfluencePageApiResponse {
  id: string;
  status: string;
  title: string;
  spaceId: string;
  parentId?: string;
  version: {
    number: number;
  };
  body?: {
    storage?: {
      representation?: string;
      value?: string;
    };
  };
  _links?: {
    webui?: string;
  };
}

export function parseConfluencePageId(ref: string): string | null {
  const trimmed = ref.trim();
  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    const segments = url.pathname.split('/');
    const pagesIndex = segments.findIndex((segment) => segment === 'pages');
    const pageId = pagesIndex >= 0 ? segments[pagesIndex + 1] : undefined;
    return pageId && /^\d+$/.test(pageId) ? pageId : null;
  } catch {
    return null;
  }
}

export function resolveConfluenceCredentials(
  env: Partial<NodeJS.ProcessEnv> = process.env,
  jiraConfig: JiraCliConfig = readJiraCliConfig(env.JIRA_CONFIG_FILE),
): ConfluenceAuth {
  const siteSource = env.CONFLUENCE_SITE_URL ?? env.JIRA_URL;
  if (!siteSource) {
    throw new Error('Confluence site URL not configured. Set CONFLUENCE_SITE_URL or JIRA_URL.');
  }

  const apiToken = env.CONFLUENCE_API_TOKEN ?? env.JIRA_API_TOKEN;
  if (!apiToken) {
    throw new Error(
      'Confluence API token not configured. Set CONFLUENCE_API_TOKEN or JIRA_API_TOKEN.',
    );
  }

  const login = env.CONFLUENCE_LOGIN ?? env.JIRA_LOGIN ?? jiraConfig.login;
  if (!login) {
    throw new Error(
      'Confluence login not configured. Set CONFLUENCE_LOGIN/JIRA_LOGIN or configure jira-cli login.',
    );
  }

  const siteBaseUrl = new URL(siteSource).origin;
  return {
    siteBaseUrl,
    apiBaseUrl: `${siteBaseUrl}/wiki/api/v2`,
    login,
    apiToken,
  };
}

export async function getConfluencePage(
  options: GetConfluencePageOptions,
  fetchImpl: FetchFn = globalThis.fetch,
): Promise<ConfluencePage> {
  const pageId = requireConfluencePageId(options.pageRef);
  const raw = await requestConfluencePage(
    `${options.auth.apiBaseUrl}/pages/${pageId}?body-format=storage`,
    options.auth,
    fetchImpl,
  );
  return normalizeConfluencePage(raw, options.auth);
}

export async function createConfluenceChildPage(
  options: CreateConfluenceChildPageOptions,
  fetchImpl: FetchFn = globalThis.fetch,
): Promise<ConfluencePage> {
  const parent = await getConfluencePage(
    { pageRef: options.parentRef, auth: options.auth },
    fetchImpl,
  );
  const raw = await requestConfluencePage(
    `${options.auth.apiBaseUrl}/pages`,
    options.auth,
    fetchImpl,
    {
      method: 'POST',
      body: JSON.stringify({
        spaceId: parent.spaceId,
        status: 'current',
        title: options.title,
        parentId: parent.id,
        body: {
          representation: 'storage',
          value: options.body,
        },
      }),
    },
  );
  return normalizeConfluencePage(raw, options.auth);
}

export async function updateConfluencePage(
  options: UpdateConfluencePageOptions,
  fetchImpl: FetchFn = globalThis.fetch,
): Promise<ConfluencePage> {
  if (!options.title && options.body === undefined) {
    throw new Error('Provide a new title, body, or both when updating a Confluence page.');
  }

  const current = await getConfluencePage(
    { pageRef: options.pageRef, auth: options.auth },
    fetchImpl,
  );
  const raw = await requestConfluencePage(
    `${options.auth.apiBaseUrl}/pages/${current.id}`,
    options.auth,
    fetchImpl,
    {
      method: 'PUT',
      body: JSON.stringify({
        id: current.id,
        status: current.status,
        title: options.title ?? current.title,
        spaceId: current.spaceId,
        parentId: current.parentId ?? undefined,
        body: {
          representation: 'storage',
          value: options.body ?? current.body,
        },
        version: {
          number: current.versionNumber + 1,
        },
      }),
    },
  );
  return normalizeConfluencePage(raw, options.auth);
}

export function formatConfluencePage(page: ConfluencePage): string {
  const lines = [
    page.title,
    `ID: ${page.id}`,
    `Status: ${page.status}`,
    `Space ID: ${page.spaceId}`,
  ];

  if (page.parentId) {
    lines.push(`Parent ID: ${page.parentId}`);
  }

  lines.push(`Version: ${page.versionNumber}`, `URL: ${page.webUrl}`);

  if (page.body) {
    lines.push('', page.body);
  }

  return lines.join('\n');
}

function readJiraCliConfig(configPath = DEFAULT_JIRA_CONFIG_PATH): JiraCliConfig {
  if (!configPath || !existsSync(configPath)) {
    return {};
  }

  const contents = readFileSync(configPath, 'utf8');
  const match = contents.match(/^login:\s*(.+)\s*$/m);
  if (!match) {
    return {};
  }

  return {
    login: match[1]?.trim().replace(/^['"]|['"]$/g, ''),
  };
}

function requireConfluencePageId(pageRef: string): string {
  const pageId = parseConfluencePageId(pageRef);
  if (!pageId) {
    throw new Error('Expected a numeric Confluence page id or a Confluence page URL.');
  }
  return pageId;
}

async function requestConfluencePage(
  url: string,
  auth: ConfluenceAuth,
  fetchImpl: FetchFn,
  init?: RequestInit,
): Promise<ConfluencePageApiResponse> {
  const response = await fetchImpl(url, {
    ...init,
    headers: {
      accept: 'application/json',
      authorization: `Basic ${Buffer.from(`${auth.login}:${auth.apiToken}`).toString('base64')}`,
      'content-type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Confluence request failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as ConfluencePageApiResponse;
}

function normalizeConfluencePage(
  raw: ConfluencePageApiResponse,
  auth: ConfluenceAuth,
): ConfluencePage {
  return {
    id: raw.id,
    status: raw.status,
    title: raw.title,
    spaceId: raw.spaceId,
    parentId: raw.parentId ?? null,
    versionNumber: raw.version.number,
    body: raw.body?.storage?.value ?? '',
    webUrl: raw._links?.webui
      ? `${auth.siteBaseUrl}${raw._links.webui}`
      : `${auth.siteBaseUrl}/wiki/pages/${raw.id}`,
  };
}
