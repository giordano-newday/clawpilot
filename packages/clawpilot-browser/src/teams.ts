import type { BrowserContext, Page } from 'playwright';
import {
  createBackgroundWindowLaunchOptions,
  makeWindowVisible,
  makeWindowUnobtrusive,
} from '@clawpilot/browser/utils/window.js';
import { DEFAULT_STATE_DIR } from '@clawpilot/browser/utils/paths.js';

export const TEAMS_BASE_URL = 'https://teams.cloud.microsoft';
const FALLBACK_TEAMS_URL = 'https://teams.microsoft.com/v2/';
const TEAMS_AUTH_CHECK_URL =
  'https://teams.microsoft.com/api/authsvc/v1.0/authzcore?resource=https%3A%2F%2Fapi.spaces.skype.com';
const TEAMS_CLIENT_ID = '5e3ce6c0-2b1f-4285-8d4b-75ee78787346';
const TEAMS_SKYPE_RESOURCE = 'https://api.spaces.skype.com';
const TEAMS_SKYPE_SCOPE = `${TEAMS_SKYPE_RESOURCE}/.default`;
const LOAD_TIMEOUT_MS = 30_000;
const RENDER_WAIT_MS = 10_000;
const TEAMS_RECOVERY_TIMEOUT_MS = 60_000;
const TEAMS_RECOVERY_POLL_INTERVAL_MS = 5_000;
const TEAMS_AUTH_TIMEOUT_MS = 300_000;
const TEAMS_AUTH_POLL_INTERVAL_MS = 2_000;
const TEAMS_AUTH_PROBE_TIMEOUT_MS = 5_000;
const TEAMS_LOGIN_TRIGGER_TIMEOUT_MS = 5_000;
const TEAMS_CONTEXT_CLOSE_TIMEOUT_MS = 5_000;
const TEAMS_PAGE_UNLOAD_TIMEOUT_MS = 2_000;

export type TeamsAuthProbeStatus = 'authenticated' | 'interactive_auth_required' | 'probe_failed';
export type TeamsInteractiveLoginTriggerStatus = 'triggered' | 'timed_out';

export type TeamsItemKind = 'chat' | 'channel';

export interface TeamsListCandidate {
  id: string;
  kind: TeamsItemKind;
  title: string;
  path: string;
  preview: string | null;
  order: number;
}

export interface TeamsPageInfo {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
  nextOffset: number | null;
}

export interface TeamsListResult {
  page: TeamsPageInfo;
  chats: TeamsListCandidate[];
  channels: TeamsListCandidate[];
}

export interface TeamsMessage {
  id: string;
  author: string | null;
  sentAt: string | null;
  text: string;
}

export interface TeamsReadTarget {
  id: string;
  kind: TeamsItemKind;
  title: string;
  path: string;
}

export interface TeamsReadResult {
  target: TeamsReadTarget;
  page: TeamsPageInfo;
  messages: TeamsMessage[];
}

export interface TeamsListOptions {
  limit: number;
  offset: number;
}

export interface TeamsReadOptions extends TeamsListOptions {
  id: string;
}

interface RawTeamsListNode {
  href: string | null;
  text: string;
  aria: string | null;
  title: string | null;
  dataTid: string | null;
  role: string | null;
  dataChatId: string | null;
  dataChannelId: string | null;
  dataTeamId: string | null;
  dataPreview: string | null;
  order: number;
}

interface RawTeamsMessageNode {
  messageId: string | null;
  text: string;
  aria: string | null;
  title: string | null;
  dataTid: string | null;
  order: number;
}

interface TeamsShellSnapshot {
  bodyText: string;
  buttonTexts: string[];
}

interface TeamsAuthProbeResult {
  status: number | null;
  pageOrigin: string;
}

// --- Direct HTTP client types ---

export interface TeamsMsalCacheEntry {
  secret: string;
  target: string;
  expires_on: string;
  cached_at: string;
}

export interface TeamsTokenSet {
  skype: string;
  chatSvcAgg: string;
  chatSvc: string;
}

export function isTeamsAppOrigin(origin: string): boolean {
  return origin === 'https://teams.microsoft.com' || origin === TEAMS_BASE_URL;
}

export function normalizeTeamsTargetId(href: string): { id: string; kind: TeamsItemKind } | null {
  const url = new URL(href, TEAMS_BASE_URL);
  const isTeamsOrigin = isTeamsAppOrigin(url.origin);

  if (!isTeamsOrigin) {
    return null;
  }

  if (url.pathname.startsWith('/l/chat/')) {
    return { id: `${url.pathname}${url.search}`, kind: 'chat' };
  }

  if (url.pathname.startsWith('/l/channel/')) {
    return { id: `${url.pathname}${url.search}`, kind: 'channel' };
  }

  return null;
}

export function buildTeamsListResult(
  items: TeamsListCandidate[],
  options: TeamsListOptions,
): TeamsListResult {
  const sorted = [...items].sort((left, right) => left.order - right.order);
  const paged = sorted.slice(options.offset, options.offset + options.limit);
  const total = sorted.length;
  const nextOffset = options.offset + options.limit < total ? options.offset + options.limit : null;

  return {
    page: {
      limit: options.limit,
      offset: options.offset,
      total,
      hasMore: nextOffset !== null,
      nextOffset,
    },
    chats: paged.filter((item) => item.kind === 'chat'),
    channels: paged.filter((item) => item.kind === 'channel'),
  };
}

export function buildTeamsReadResult(
  target: TeamsReadTarget,
  messages: TeamsMessage[],
  options: TeamsListOptions,
): TeamsReadResult {
  const sorted = [...messages].sort((left, right) => left.id.localeCompare(right.id));
  const paged = sorted.slice(options.offset, options.offset + options.limit);
  const total = sorted.length;
  const nextOffset = options.offset + options.limit < total ? options.offset + options.limit : null;

  return {
    target,
    page: {
      limit: options.limit,
      offset: options.offset,
      total,
      hasMore: nextOffset !== null,
      nextOffset,
    },
    messages: paged,
  };
}

export function formatTeamsList(result: TeamsListResult): string {
  const lines = [
    `Teams conversations (${result.page.total} total, showing ${
      result.chats.length + result.channels.length
    }, offset ${result.page.offset}, limit ${result.page.limit})`,
    '',
    'Chats',
  ];

  if (result.chats.length === 0) {
    lines.push('- None');
  } else {
    for (const chat of result.chats) {
      lines.push(`- ${chat.title}`);
      lines.push(`  ID: ${chat.id}`);
      lines.push(`  Path: ${chat.path}`);
      if (chat.preview) {
        lines.push(`  Preview: ${chat.preview}`);
      }
    }
  }

  lines.push('', 'Channels');

  if (result.channels.length === 0) {
    lines.push('- None');
  } else {
    for (const channel of result.channels) {
      lines.push(`- ${channel.title}`);
      lines.push(`  ID: ${channel.id}`);
      lines.push(`  Path: ${channel.path}`);
      if (channel.preview) {
        lines.push(`  Preview: ${channel.preview}`);
      }
    }
  }

  if (result.page.hasMore && result.page.nextOffset !== null) {
    lines.push('', `Next offset: ${result.page.nextOffset}`);
  }

  return lines.join('\n');
}

export function formatTeamsRead(result: TeamsReadResult): string {
  const lines = [
    `${result.target.title} (${result.target.kind})`,
    `ID: ${result.target.id}`,
    `Path: ${result.target.path}`,
    '',
    `Messages (${result.messages.length})`,
  ];

  if (result.messages.length === 0) {
    lines.push('- None');
  } else {
    for (const message of result.messages) {
      const header = [message.author, message.sentAt].filter(Boolean).join(' — ');
      lines.push(`- ${header || message.id}`);
      lines.push(`  ${message.text}`);
    }
  }

  if (result.page.hasMore && result.page.nextOffset !== null) {
    lines.push('', `Next offset: ${result.page.nextOffset}`);
  }

  return lines.join('\n');
}

export function detectTeamsShellError(snapshot: TeamsShellSnapshot): string | null {
  const normalizedButtons = snapshot.buttonTexts.map((button) => button.trim().toLowerCase());
  const normalizedBody = snapshot.bodyText.trim().toLowerCase();

  const hasRetryUi =
    normalizedButtons.includes('retry') && normalizedButtons.includes('clear cache and retry');
  const looksLikeRetryShell =
    normalizedBody.includes('oops') ||
    normalizedBody.includes('unknown error') ||
    normalizedBody.includes('something went wrong');

  if (!hasRetryUi || !looksLikeRetryShell) {
    return null;
  }

  const detail = getTeamsShellErrorDetail(snapshot);
  return `Teams web client reached its retry screen ("${detail}"). Open Teams manually and let it finish loading, then retry.`;
}

export function formatTeamsShellErrorMessage(detail: string, waitedSeconds: number): string {
  return `Teams web client stayed on its retry screen for ${waitedSeconds} seconds ("${detail}"). Open Teams manually and let it finish loading, then retry.`;
}

export function classifyTeamsAuthProbeStatus(status: number): TeamsAuthProbeStatus {
  if (status >= 200 && status < 300) {
    return 'authenticated';
  }

  if (status === 401) {
    return 'interactive_auth_required';
  }

  return 'probe_failed';
}

export function formatTeamsAuthTimeoutMessage(waitedSeconds: number): string {
  return `Teams needs an interactive sign-in before chats or channels can be read. A Teams window was opened and waited for ${waitedSeconds} seconds, but auth never became ready. Finish signing in there, then retry.`;
}

export async function settleTeamsAsyncAction<T>(
  action: () => Promise<T>,
  timeoutMs: number,
  onTimeout: () => T,
): Promise<T> {
  return Promise.race([
    action(),
    new Promise<T>((resolve) => {
      setTimeout(() => resolve(onTimeout()), timeoutMs);
    }),
  ]);
}

export async function settleTeamsInteractiveLoginTrigger(
  triggerLogin: () => Promise<void>,
  timeoutMs: number,
): Promise<TeamsInteractiveLoginTriggerStatus> {
  return settleTeamsAsyncAction(
    async () => {
      await triggerLogin();
      return 'triggered' as const;
    },
    timeoutMs,
    () => 'timed_out',
  );
}

// --- Direct HTTP client: pure token extraction & response parsing ---

const TEAMS_TOKEN_AUDIENCES = {
  skype: 'https://api.spaces.skype.com',
  chatSvcAgg: 'https://chatsvcagg.teams.microsoft.com',
  chatSvc: 'https://ic3.teams.office.com',
} as const;

export function extractTeamsTokensFromMsalCache(
  cache: Record<string, TeamsMsalCacheEntry>,
): TeamsTokenSet | null {
  const tokens: Partial<TeamsTokenSet> = {};

  for (const entry of Object.values(cache)) {
    for (const [key, audience] of Object.entries(TEAMS_TOKEN_AUDIENCES)) {
      if (entry.target.includes(audience)) {
        tokens[key as keyof TeamsTokenSet] = entry.secret;
      }
    }
  }

  if (!tokens.skype || !tokens.chatSvcAgg || !tokens.chatSvc) {
    return null;
  }

  return tokens as TeamsTokenSet;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

export function parseTeamsChatListResponse(
  raw:
    | {
        conversations: Array<{
          id: string;
          type: string;
          threadProperties?: { topic?: string; threadType?: string };
          lastMessage?: { composetime?: string; imdisplayname?: string; content?: string };
        }>;
      }
    | Array<{
        id: string;
        title: string | null;
        chatType: string;
        lastMessage?: { content?: string; imdisplayname?: string; composetime?: string };
        members?: Array<{ objectId: string }>;
        hidden?: boolean;
      }>,
): TeamsListCandidate[] {
  // Handle chatsvc conversations format
  if ('conversations' in raw) {
    return raw.conversations
      .filter(
        (c) =>
          !c.id.includes('notifications') &&
          !c.id.includes('unq.gbl.spaces') &&
          c.type === 'Conversation',
      )
      .map((c, i) => ({
        id: c.id,
        kind: (c.threadProperties?.threadType === 'channel' ? 'channel' : 'chat') as TeamsItemKind,
        title: c.threadProperties?.topic ?? c.id,
        path: `/l/chat/${encodeURIComponent(c.id)}`,
        preview: c.lastMessage?.content ? stripHtml(c.lastMessage.content) : null,
        order: i,
      }));
  }

  // Handle legacy CSA groupchats format
  return raw
    .filter((c) => !c.hidden)
    .map((c, i) => ({
      id: c.id,
      kind: 'chat' as TeamsItemKind,
      title: c.title ?? (c.members?.map((m) => m.objectId).join(', ') || 'Unnamed chat'),
      path: `/l/chat/${encodeURIComponent(c.id)}`,
      preview: c.lastMessage?.content ? stripHtml(c.lastMessage.content) : null,
      order: i,
    }));
}

const USER_MESSAGE_TYPES = new Set(['Text', 'RichText/Html', 'RichText']);

export function parseTeamsMessagesResponse(raw: {
  messages: Array<{
    id: string;
    imdisplayname: string;
    composetime: string;
    content: string;
    messagetype: string;
    type: string;
  }>;
}): TeamsMessage[] {
  return raw.messages
    .filter((m) => USER_MESSAGE_TYPES.has(m.messagetype))
    .map((m) => ({
      id: m.id,
      author: m.imdisplayname || null,
      sentAt: m.composetime || null,
      text: stripHtml(m.content),
    }));
}

// --- Direct HTTP client: fetch functions ---

type FetchFn = typeof globalThis.fetch;

export interface TeamsAuthzBootstrapResult {
  region: string;
  partition: string;
  skypeToken: string;
}

const TEAMS_DATA_HEADERS = {
  'x-ms-client-type': 'web',
  'x-ms-client-version': '1415/26021215123',
  'x-ms-migration': 'True',
} as const;

export async function fetchTeamsAuthzBootstrap(
  skypeAudienceToken: string,
  fetchImpl: FetchFn = globalThis.fetch,
): Promise<TeamsAuthzBootstrapResult> {
  const response = await fetchImpl('https://teams.microsoft.com/api/authsvc/v1.0/authz', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${skypeAudienceToken}`,
      ...TEAMS_DATA_HEADERS,
    },
  });

  if (!response.ok) {
    throw new Error(`Teams authz bootstrap failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    region: string;
    partition: string;
    tokens: { skypeToken: string };
  };

  return {
    region: data.region,
    partition: data.partition,
    skypeToken: data.tokens.skypeToken,
  };
}

export async function fetchTeamsChatList(
  opts: { token: string; region: string; partition: string },
  fetchImpl: FetchFn = globalThis.fetch,
): Promise<unknown> {
  const url = `https://teams.cloud.microsoft/api/csa/${opts.region}/api/v1/teams/users/me/groupchats?skipMeetingChats=true`;
  const response = await fetchImpl(url, {
    headers: {
      authorization: `Bearer ${opts.token}`,
      'x-ms-region': opts.region,
      'x-ms-partition': opts.partition,
      ...TEAMS_DATA_HEADERS,
    },
  });

  if (!response.ok) {
    throw new Error(`Teams chat list failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function fetchTeamsMessages(
  opts: {
    token: string;
    region: string;
    partition: string;
    conversationId: string;
    pageSize: number;
  },
  fetchImpl: FetchFn = globalThis.fetch,
): Promise<unknown> {
  const encodedId = encodeURIComponent(opts.conversationId);
  const url = `https://teams.cloud.microsoft/api/chatsvc/${opts.region}/v1/users/ME/conversations/${encodedId}/messages?view=msnp24Equivalent|supportsMessageProperties&pageSize=${opts.pageSize}&startTime=1`;
  const response = await fetchImpl(url, {
    headers: {
      authorization: `Bearer ${opts.token}`,
      'x-ms-region': opts.region,
      'x-ms-partition': opts.partition,
      ...TEAMS_DATA_HEADERS,
    },
  });

  if (!response.ok) {
    throw new Error(`Teams messages failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function listTeamsDirect(
  tokens: TeamsTokenSet,
  options: TeamsListOptions,
  fetchImpl: FetchFn = globalThis.fetch,
): Promise<TeamsListResult> {
  const authz = await fetchTeamsAuthzBootstrap(tokens.skype, fetchImpl);
  const raw = (await fetchTeamsChatList(
    { token: tokens.chatSvcAgg, region: authz.region, partition: authz.partition },
    fetchImpl,
  )) as Parameters<typeof parseTeamsChatListResponse>[0];
  const items = parseTeamsChatListResponse(raw);
  return buildTeamsListResult(items, options);
}

export async function readTeamsDirect(
  tokens: TeamsTokenSet,
  options: TeamsReadOptions,
  fetchImpl: FetchFn = globalThis.fetch,
): Promise<TeamsReadResult> {
  const authz = await fetchTeamsAuthzBootstrap(tokens.skype, fetchImpl);
  const raw = (await fetchTeamsMessages(
    {
      token: tokens.chatSvc,
      region: authz.region,
      partition: authz.partition,
      conversationId: options.id,
      pageSize: options.limit,
    },
    fetchImpl,
  )) as {
    messages: Array<{
      id: string;
      imdisplayname: string;
      composetime: string;
      content: string;
      messagetype: string;
      type: string;
    }>;
  };
  const messages = parseTeamsMessagesResponse(raw);
  const kind: TeamsItemKind = options.id.startsWith('/l/channel/') ? 'channel' : 'chat';
  return buildTeamsReadResult(
    { id: options.id, kind, title: options.id, path: options.id },
    messages,
    options,
  );
}

async function extractTeamsTokensFromPage(page: Page): Promise<TeamsTokenSet | null> {
  const msalEntries = await page.evaluate(() => {
    const entries: Record<
      string,
      { secret: string; target: string; expires_on: string; cached_at: string }
    > = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.includes('-accesstoken-')) continue;
      try {
        const val = JSON.parse(localStorage.getItem(key) ?? '');
        if (val && typeof val.secret === 'string' && typeof val.target === 'string') {
          entries[key] = val as {
            secret: string;
            target: string;
            expires_on: string;
            cached_at: string;
          };
        }
      } catch {
        // skip non-JSON entries
      }
    }
    return entries;
  });
  return extractTeamsTokensFromMsalCache(msalEntries);
}

export async function listTeams(options: TeamsListOptions): Promise<TeamsListResult> {
  return withTeamsPage(async (page) => {
    await loadTeamsShell(page);
    await ensureTeamsAuthReady(page);
    await makeWindowUnobtrusive(page);

    // Try direct HTTP first (faster, more reliable)
    const tokens = await extractTeamsTokensFromPage(page);
    if (tokens) {
      try {
        return await listTeamsDirect(tokens, options);
      } catch {
        // Fall back to DOM scraping
      }
    }

    const shellError = await getTeamsShellError(page);
    if (shellError) {
      throw new Error(shellError);
    }

    const items = normalizeTeamsListNodes(await collectTeamsListNodes(page));
    if (items.length === 0) {
      throw new Error(
        'Teams loaded but no chat or channel entries were detected. Open Teams once manually, then retry.',
      );
    }

    return buildTeamsListResult(items, options);
  });
}

export async function readTeams(options: TeamsReadOptions): Promise<TeamsReadResult> {
  return withTeamsPage(async (page) => {
    await loadTeamsShell(page);
    await ensureTeamsAuthReady(page);
    await makeWindowUnobtrusive(page);

    // Try direct HTTP first (faster, doesn't need shell loaded)
    const tokens = await extractTeamsTokensFromPage(page);
    if (tokens) {
      try {
        return await readTeamsDirect(tokens, options);
      } catch {
        // Fall back to DOM scraping
      }
    }

    // DOM scraping fallback — needs shell fully loaded
    const shellError = await getTeamsShellError(page);
    if (shellError) {
      throw new Error(shellError);
    }
    await page.goto(resolveTeamsTargetUrl(options.id), {
      timeout: LOAD_TIMEOUT_MS,
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(RENDER_WAIT_MS);
    const targetShellError = await getTeamsShellError(page);
    if (targetShellError) {
      throw new Error(targetShellError);
    }

    const messages = normalizeTeamsMessages(await collectTeamsMessageNodes(page));
    if (messages.length === 0) {
      throw new Error(
        'Teams opened the target but no messages were detected. Open the thread/channel manually, then retry.',
      );
    }

    return buildTeamsReadResult(
      {
        id: options.id,
        kind: options.id.startsWith('/l/channel/') ? 'channel' : 'chat',
        title: await page.title(),
        path: options.id,
      },
      messages,
      options,
    );
  });
}

async function withTeamsPage<T>(run: (page: Page) => Promise<T>): Promise<T> {
  const { chromium } = await import('playwright');
  let context: BrowserContext | undefined;

  try {
    context = await chromium.launchPersistentContext(
      DEFAULT_STATE_DIR,
      createBackgroundWindowLaunchOptions(),
    );
    const page = context.pages()[0] ?? (await context.newPage());
    await makeWindowUnobtrusive(page);
    return await run(page);
  } finally {
    if (context) {
      const contextToClose = context;
      await Promise.all(
        contextToClose.pages().map(async (page) => {
          await settleTeamsAsyncAction(
            () =>
              page.goto('about:blank', {
                timeout: TEAMS_PAGE_UNLOAD_TIMEOUT_MS,
                waitUntil: 'domcontentloaded',
              }),
            TEAMS_PAGE_UNLOAD_TIMEOUT_MS + 1_000,
            () => undefined,
          );
        }),
      );
      await settleTeamsAsyncAction(
        () => contextToClose.close(),
        TEAMS_CONTEXT_CLOSE_TIMEOUT_MS,
        () => undefined,
      );
    }
  }
}

async function loadTeamsShell(page: Page): Promise<void> {
  await page.goto(TEAMS_BASE_URL, {
    timeout: LOAD_TIMEOUT_MS,
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(RENDER_WAIT_MS);

  if (await isRetryShell(page)) {
    await page.goto(FALLBACK_TEAMS_URL, {
      timeout: LOAD_TIMEOUT_MS,
      waitUntil: 'domcontentloaded',
    });
    await waitForTeamsRecovery(page);
  }
}

async function maybeRetryShell(page: Page): Promise<void> {
  const retryButton = page.getByRole('button', { name: 'Retry' });
  if (await retryButton.count()) {
    await retryButton.first().click();
  }
}

async function isRetryShell(page: Page): Promise<boolean> {
  return (await getTeamsShellError(page)) !== null;
}

async function getTeamsShellError(page: Page): Promise<string | null> {
  const snapshot = await page.evaluate(() => ({
    bodyText: document.body.innerText ?? '',
    buttonTexts: Array.from(document.querySelectorAll('button')).map((button) =>
      (button.textContent ?? '').trim(),
    ),
  }));

  return detectTeamsShellError(snapshot);
}

function getTeamsShellErrorDetail(snapshot: TeamsShellSnapshot): string {
  const lines = snapshot.bodyText
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return (
    lines.find(
      (line) =>
        !/^oops$/i.test(line) && !/^retry$/i.test(line) && !/^clear cache and retry$/i.test(line),
    ) ?? 'Teams hit an unknown client-side error'
  );
}

async function waitForTeamsRecovery(page: Page): Promise<void> {
  const deadline = Date.now() + TEAMS_RECOVERY_TIMEOUT_MS;

  while (true) {
    await maybeRetryShell(page);
    await page.waitForTimeout(RENDER_WAIT_MS);

    const snapshot = await page.evaluate(() => ({
      bodyText: document.body.innerText ?? '',
      buttonTexts: Array.from(document.querySelectorAll('button')).map((button) =>
        (button.textContent ?? '').trim(),
      ),
    }));

    const shellError = detectTeamsShellError(snapshot);
    if (!shellError) {
      return;
    }

    if (Date.now() >= deadline) {
      throw new Error(
        formatTeamsShellErrorMessage(
          getTeamsShellErrorDetail(snapshot),
          Math.round(TEAMS_RECOVERY_TIMEOUT_MS / 1000),
        ),
      );
    }

    const waitTime = Math.min(TEAMS_RECOVERY_POLL_INTERVAL_MS, deadline - Date.now());
    if (waitTime > 0) {
      await page.waitForTimeout(waitTime);
    }
  }
}

async function ensureTeamsAuthReady(page: Page): Promise<void> {
  if (!isTeamsAppOrigin(new URL(page.url()).origin)) {
    await page.goto(FALLBACK_TEAMS_URL, {
      timeout: LOAD_TIMEOUT_MS,
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(RENDER_WAIT_MS);
  }

  const deadline = Date.now() + TEAMS_AUTH_TIMEOUT_MS;
  let madeVisible = false;
  let loginTriggered = false;

  while (true) {
    const probe = await probeTeamsAuth(page);

    if (probe.status === null && probe.pageOrigin === TEAMS_BASE_URL) {
      return;
    }

    const status =
      probe.status === null
        ? 'interactive_auth_required'
        : classifyTeamsAuthProbeStatus(probe.status);

    if (status === 'authenticated') {
      return;
    }

    if (status === 'probe_failed') {
      throw new Error(
        `Teams auth probe failed with status ${probe.status}. Open Teams manually, finish signing in, then retry.`,
      );
    }

    if (!madeVisible) {
      await makeWindowVisible(page);
      madeVisible = true;
    }

    if (!loginTriggered && probe.pageOrigin === 'https://teams.microsoft.com') {
      await triggerTeamsInteractiveLogin(page);
      loginTriggered = true;
    }

    if (Date.now() >= deadline) {
      throw new Error(formatTeamsAuthTimeoutMessage(Math.round(TEAMS_AUTH_TIMEOUT_MS / 1000)));
    }

    if (probe.pageOrigin === 'https://teams.microsoft.com') {
      await page.waitForTimeout(TEAMS_AUTH_POLL_INTERVAL_MS);
      continue;
    }

    await page.waitForTimeout(TEAMS_AUTH_POLL_INTERVAL_MS);
  }
}

async function probeTeamsAuth(page: Page): Promise<TeamsAuthProbeResult> {
  return settleTeamsAsyncAction(
    () =>
      page.evaluate(
        async ({ authUrl, probeTimeoutMs }) => {
          if (window.location.origin !== 'https://teams.microsoft.com') {
            return {
              status: null,
              pageOrigin: window.location.origin,
            };
          }

          try {
            const controller = new AbortController();
            const timeoutId = window.setTimeout(() => controller.abort(), probeTimeoutMs);
            const response = await fetch(authUrl, {
              credentials: 'include',
              method: 'GET',
              signal: controller.signal,
            });
            window.clearTimeout(timeoutId);

            return {
              status: response.status,
              pageOrigin: window.location.origin,
            };
          } catch {
            return {
              status: 0,
              pageOrigin: window.location.origin,
            };
          }
        },
        { authUrl: TEAMS_AUTH_CHECK_URL, probeTimeoutMs: TEAMS_AUTH_PROBE_TIMEOUT_MS },
      ),
    TEAMS_AUTH_PROBE_TIMEOUT_MS + 1_000,
    () => ({
      status: null,
      pageOrigin: new URL(page.url()).origin,
    }),
  );
}

async function triggerTeamsInteractiveLogin(page: Page): Promise<void> {
  await settleTeamsInteractiveLoginTrigger(
    () =>
      page.evaluate(
        async ({ clientId, skypeResource, skypeScope }) => {
          const runtime = self as typeof self & {
            webpackChunk_msteams_react_web_client?: Array<unknown> & {
              push: (payload: unknown) => void;
            };
          };
          const chunk = runtime.webpackChunk_msteams_react_web_client;
          if (!chunk) {
            return;
          }
          let runtimeRequire: ((id: number) => unknown) | undefined;
          chunk.push([
            [Symbol('clawpilot')],
            {},
            (require: (id: number) => unknown): void => {
              runtimeRequire = require;
            },
          ]);

          if (!runtimeRequire) {
            return;
          }

          const providerModule = runtimeRequire(844084) as {
            Msal2AuthenticationProvider: new (
              config: unknown,
              currentUrl: unknown,
              windowProvider: unknown,
              crossTabCallbacks: unknown,
              coreSettings: (key: string) => unknown,
            ) => {
              _userAgentApplication: {
                initialize: () => Promise<void>;
                loginRedirect: (request: unknown) => Promise<void>;
              };
            };
          };

          const Provider = providerModule.Msal2AuthenticationProvider;
          const currentUrl = {
            origin: window.location.origin,
            pathname: window.location.pathname,
            queryStrings: Object.fromEntries(new URLSearchParams(window.location.search).entries()),
          };
          const settings: Record<string, unknown> = {
            clientId,
            instanceUrl: 'https://login.microsoftonline.com/',
            redirectUrlPath: 'v2/',
            audience: 'common',
            authMsalIframeHashTimeout: '40000',
            enableBlankPageRedirectUri: true,
            mtResource: skypeResource,
            mtResourceV2: skypeResource,
            buildCloud: 'prod',
            enableAadV2TokenForMiddleTier: false,
            interactionRequiredErrorCodes: [
              'login_required',
              'consent_required',
              'interaction_required',
              'InteractionRequired',
              'UserCanceled',
              'UserCancelled',
              'NoAccountFound',
              'AccountUnusable',
              'invalid_grant',
              'no_tokens_found',
              'native_account_unavailable',
              'refresh_token_expired',
              'bad_token',
            ],
            acquireTokenRetryableErrorCodeList: [
              'NoNetwork',
              'NetworkTemporarilyUnavailable',
              'NoAccountFound',
            ],
            pathForAcquireTokenRedirect: 'v2/',
            retainedQspsForAcquireTokenRedirect: ['loginHint', 'tenantId'],
          };

          const provider = new Provider(
            {
              clientId,
              cacheLocation: 'localStorage',
              isInIframe: false,
              webAuth: { navigateToLoginRequestUrl: false },
              experienceName: 'react-web-client',
              clientVersion: '26021215123',
            },
            currentUrl,
            { localStorage: window.localStorage },
            {},
            (key: string) => settings[key],
          );

          await provider._userAgentApplication.initialize();
          provider._userAgentApplication
            .loginRedirect({
              scopes: ['openid', 'profile', 'offline_access', skypeScope],
              redirectStartPage: `${window.location.origin}/v2/`,
              redirectUri: `${window.location.origin}/v2/`,
            })
            .catch(() => undefined);
        },
        {
          clientId: TEAMS_CLIENT_ID,
          skypeResource: TEAMS_SKYPE_RESOURCE,
          skypeScope: TEAMS_SKYPE_SCOPE,
        },
      ),
    TEAMS_LOGIN_TRIGGER_TIMEOUT_MS,
  );
}

async function collectTeamsListNodes(page: Page): Promise<RawTeamsListNode[]> {
  return page.evaluate(() => {
    const selector = [
      'a[href*="/l/chat/"]',
      'a[href*="/l/channel/"]',
      '[data-chat-id]',
      '[data-channel-id]',
      '[role="treeitem"]',
      '[role="listitem"]',
      'button',
    ].join(', ');

    const nodes = Array.from(document.querySelectorAll(selector));
    return nodes.slice(0, 600).map((node, index) => {
      const element = node as HTMLElement;
      const dataset = element.dataset ?? {};
      const href = element instanceof HTMLAnchorElement ? element.href : null;
      const lines = (element.innerText || element.textContent || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      return {
        href,
        text: lines.join('\n'),
        aria: element.getAttribute('aria-label'),
        title: element.getAttribute('title'),
        dataTid: element.getAttribute('data-tid'),
        role: element.getAttribute('role'),
        dataChatId: dataset.chatId ?? null,
        dataChannelId: dataset.channelId ?? null,
        dataTeamId: dataset.teamId ?? null,
        dataPreview: dataset.preview ?? null,
        order: index,
      };
    });
  });
}

async function collectTeamsMessageNodes(page: Page): Promise<RawTeamsMessageNode[]> {
  return page.evaluate(() => {
    const selector = [
      '[data-message-id]',
      '[data-tid*="message"]',
      'article',
      '[role="listitem"]',
    ].join(', ');

    return Array.from(document.querySelectorAll(selector))
      .slice(0, 1000)
      .map((node, index) => {
        const element = node as HTMLElement;
        return {
          messageId: element.dataset.messageId ?? null,
          text: (element.innerText || element.textContent || '').trim(),
          aria: element.getAttribute('aria-label'),
          title: element.getAttribute('title'),
          dataTid: element.getAttribute('data-tid'),
          order: index,
        };
      });
  });
}

function normalizeTeamsListNodes(nodes: RawTeamsListNode[]): TeamsListCandidate[] {
  const seen = new Set<string>();
  const items: TeamsListCandidate[] = [];

  for (const node of nodes) {
    const identity =
      (node.href ? normalizeTeamsTargetId(node.href) : null) ?? deriveTargetFromDataset(node);
    if (!identity || seen.has(identity.id)) {
      continue;
    }

    const lines = getTextLines(node.text, node.aria, node.title);
    const title = lines[0] ?? identity.id;
    const preview = node.dataPreview ?? lines[1] ?? null;
    const path = identity.kind === 'channel' && lines.length > 1 ? `${title} / ${lines[1]}` : title;

    items.push({
      id: identity.id,
      kind: identity.kind,
      title,
      path,
      preview,
      order: node.order,
    });
    seen.add(identity.id);
  }

  return items;
}

function deriveTargetFromDataset(
  node: RawTeamsListNode,
): { id: string; kind: TeamsItemKind } | null {
  if (node.dataChatId) {
    return { id: `/l/chat/${encodeURIComponent(node.dataChatId)}`, kind: 'chat' };
  }

  if (node.dataChannelId) {
    const groupQuery = node.dataTeamId ? `?groupId=${encodeURIComponent(node.dataTeamId)}` : '';
    return {
      id: `/l/channel/${encodeURIComponent(node.dataChannelId)}/${encodeURIComponent(node.title ?? 'channel')}${groupQuery}`,
      kind: 'channel',
    };
  }

  return null;
}

function normalizeTeamsMessages(nodes: RawTeamsMessageNode[]): TeamsMessage[] {
  const messages: TeamsMessage[] = [];
  const seen = new Set<string>();

  for (const node of nodes) {
    const lines = getTextLines(node.text, node.aria, node.title);
    if (lines.length === 0) {
      continue;
    }

    const id = node.messageId ?? `message-${node.order}`;
    if (seen.has(id)) {
      continue;
    }

    const [author, sentAt, ...rest] = lines;
    const text = rest.length > 0 ? rest.join(' ') : lines.join(' ');

    if (!text) {
      continue;
    }

    messages.push({
      id,
      author: rest.length > 0 ? (author ?? null) : null,
      sentAt: rest.length > 0 ? (sentAt ?? null) : null,
      text,
    });
    seen.add(id);
  }

  return messages;
}

function getTextLines(...values: Array<string | null>): string[] {
  return values
    .flatMap((value) => (value ?? '').split('\n'))
    .map((line) => line.trim())
    .filter(Boolean);
}

function resolveTeamsTargetUrl(id: string): string {
  return new URL(id, TEAMS_BASE_URL).toString();
}
