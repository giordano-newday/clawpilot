import { describe, expect, it, vi } from 'vitest';
import {
  buildTeamsListResult,
  buildTeamsReadResult,
  classifyTeamsAuthProbeStatus,
  extractTeamsTokensFromMsalCache,
  fetchTeamsAuthzBootstrap,
  fetchTeamsChatList,
  fetchTeamsMessages,
  formatTeamsAuthTimeoutMessage,
  detectTeamsShellError,
  formatTeamsShellErrorMessage,
  formatTeamsList,
  formatTeamsRead,
  isTeamsAppOrigin,
  mergeTeamsListCandidates,
  normalizeTeamsTargetId,
  parseTeamsChatListResponse,
  parseTeamsMessagesResponse,
  settleTeamsAsyncAction,
  settleTeamsInteractiveLoginTrigger,
  type TeamsListCandidate,
  type TeamsMessage,
  type TeamsMsalCacheEntry,
  type TeamsTokenSet,
} from '@clawpilot/browser/teams.js';

describe('normalizeTeamsTargetId', () => {
  it('normalizes chat hrefs to stable relative ids', () => {
    expect(
      normalizeTeamsTargetId(
        'https://teams.cloud.microsoft/l/chat/19%3Achat123%40thread.v2/0?tenantId=tenant-1',
      ),
    ).toEqual({
      id: '/l/chat/19%3Achat123%40thread.v2',
      kind: 'chat',
    });
  });

  it('normalizes channel hrefs to stable relative ids', () => {
    expect(
      normalizeTeamsTargetId(
        'https://teams.cloud.microsoft/l/channel/19%3Achannel456%40thread.tacv2/General?groupId=team-9&tenantId=tenant-1',
      ),
    ).toEqual({
      id: '/l/channel/19%3Achannel456%40thread.tacv2/General?groupId=team-9&tenantId=tenant-1',
      kind: 'channel',
    });
  });
});

describe('isTeamsAppOrigin', () => {
  it('treats both teams.microsoft.com and teams.cloud.microsoft as authenticated Teams app origins', () => {
    expect(isTeamsAppOrigin('https://teams.microsoft.com')).toBe(true);
    expect(isTeamsAppOrigin('https://teams.cloud.microsoft')).toBe(true);
    expect(isTeamsAppOrigin('https://login.microsoftonline.com')).toBe(false);
  });
});

describe('buildTeamsListResult', () => {
  it('paginates combined chat and channel results while keeping sections separate', () => {
    const items: TeamsListCandidate[] = [
      {
        id: '/l/chat/chat-1',
        kind: 'chat',
        title: 'Design Sync',
        path: 'Design Sync',
        preview: 'See you tomorrow',
        order: 0,
      },
      {
        id: '/l/channel/channel-1/General?groupId=team-1',
        kind: 'channel',
        title: 'General',
        path: 'Engineering / General',
        preview: 'Build is green',
        order: 1,
      },
      {
        id: '/l/chat/chat-2',
        kind: 'chat',
        title: 'Release Crew',
        path: 'Release Crew',
        preview: 'Ship it',
        order: 2,
      },
    ];

    const result = buildTeamsListResult(items, { limit: 2, offset: 1 });

    expect(result.page).toEqual({
      hasMore: false,
      limit: 2,
      nextOffset: null,
      offset: 1,
      total: 3,
    });
    expect(result.chats.map((item) => item.title)).toEqual(['Release Crew']);
    expect(result.channels.map((item) => item.path)).toEqual(['Engineering / General']);
  });
});

describe('formatTeamsList', () => {
  it('renders human-readable chat and channel sections with pagination info', () => {
    const result = buildTeamsListResult(
      [
        {
          id: '/l/chat/chat-1',
          kind: 'chat',
          title: 'Design Sync',
          path: 'Design Sync',
          preview: 'See you tomorrow',
          order: 0,
        },
        {
          id: '/l/channel/channel-1/General?groupId=team-1',
          kind: 'channel',
          title: 'General',
          path: 'Engineering / General',
          preview: 'Build is green',
          order: 1,
        },
      ],
      { limit: 20, offset: 0 },
    );

    expect(formatTeamsList(result)).toContain(
      'Teams conversations (2 total, showing 2, offset 0, limit 20)',
    );
    expect(formatTeamsList(result)).toContain('Chats');
    expect(formatTeamsList(result)).toContain('Channels');
    expect(formatTeamsList(result)).toContain('Preview: See you tomorrow');
    expect(formatTeamsList(result)).toContain('Engineering / General');
  });
});

describe('buildTeamsReadResult', () => {
  it('paginates messages for a selected thread', () => {
    const messages: TeamsMessage[] = [
      { id: 'm1', author: 'Alex', sentAt: '2026-03-17T09:00:00.000Z', text: 'Morning' },
      { id: 'm2', author: 'Sam', sentAt: '2026-03-17T09:05:00.000Z', text: 'Status?' },
      { id: 'm3', author: 'Alex', sentAt: '2026-03-17T09:06:00.000Z', text: 'Almost done' },
    ];

    const result = buildTeamsReadResult(
      {
        id: '/l/chat/chat-1',
        kind: 'chat',
        title: 'Design Sync',
        path: 'Design Sync',
      },
      messages,
      { limit: 2, offset: 1 },
    );

    expect(result.page).toEqual({
      hasMore: false,
      limit: 2,
      nextOffset: null,
      offset: 1,
      total: 3,
    });
    expect(result.messages.map((message) => message.id)).toEqual(['m2', 'm3']);
  });

  it('preserves the incoming message order instead of sorting lexicographically by id', () => {
    const messages: TeamsMessage[] = [
      { id: '10', author: 'Alex', sentAt: '2026-03-17T09:00:00.000Z', text: 'First' },
      { id: '2', author: 'Sam', sentAt: '2026-03-17T09:05:00.000Z', text: 'Second' },
    ];

    const result = buildTeamsReadResult(
      {
        id: '/l/chat/chat-1',
        kind: 'chat',
        title: 'Design Sync',
        path: 'Design Sync',
      },
      messages,
      { limit: 20, offset: 0 },
    );

    expect(result.messages.map((message) => message.id)).toEqual(['10', '2']);
  });
});

describe('formatTeamsRead', () => {
  it('renders the selected target and its messages', () => {
    const rendered = formatTeamsRead(
      buildTeamsReadResult(
        {
          id: '/l/chat/chat-1',
          kind: 'chat',
          title: 'Design Sync',
          path: 'Design Sync',
        },
        [{ id: 'm1', author: 'Alex', sentAt: '2026-03-17T09:00:00.000Z', text: 'Morning' }],
        { limit: 20, offset: 0 },
      ),
    );

    expect(rendered).toContain('Design Sync');
    expect(rendered).toContain('Messages (1)');
    expect(rendered).toContain('Alex');
    expect(rendered).toContain('Morning');
  });
});

describe('detectTeamsShellError', () => {
  it('detects the Teams retry shell and surfaces its message', () => {
    expect(
      detectTeamsShellError({
        bodyText: 'Oops\nOops, unknown error!\nRetry\nClear cache and retry',
        buttonTexts: ['Retry', 'Clear cache and retry'],
      }),
    ).toBe(
      'Teams web client reached its retry screen ("Oops, unknown error!"). Open Teams manually and let it finish loading, then retry.',
    );
  });

  it('ignores incidental Retry buttons when the Teams shell otherwise looks healthy', () => {
    expect(
      detectTeamsShellError({
        bodyText: 'Chat\nCalendar\nCalls\nPlanner\nTeams and channels',
        buttonTexts: ['Retry', 'Clear cache and retry'],
      }),
    ).toBeNull();
  });
});

describe('formatTeamsShellErrorMessage', () => {
  it('includes the auto-wait timeout when Teams never recovers', () => {
    expect(formatTeamsShellErrorMessage('Oops, unknown error!', 60)).toBe(
      'Teams web client stayed on its retry screen for 60 seconds ("Oops, unknown error!"). Open Teams manually and let it finish loading, then retry.',
    );
  });
});

describe('classifyTeamsAuthProbeStatus', () => {
  it('treats 200 responses as authenticated', () => {
    expect(classifyTeamsAuthProbeStatus(200)).toBe('authenticated');
  });

  it('treats 401 responses as interactive auth required', () => {
    expect(classifyTeamsAuthProbeStatus(401)).toBe('interactive_auth_required');
  });

  it('treats unexpected responses as probe failures', () => {
    expect(classifyTeamsAuthProbeStatus(503)).toBe('probe_failed');
  });
});

describe('formatTeamsAuthTimeoutMessage', () => {
  it('explains that Teams sign-in did not become ready in time', () => {
    expect(formatTeamsAuthTimeoutMessage(120)).toBe(
      'Teams needs an interactive sign-in before chats or channels can be read. A Teams window was opened and waited for 120 seconds, but auth never became ready. Finish signing in there, then retry.',
    );
  });
});

describe('settleTeamsInteractiveLoginTrigger', () => {
  it('returns triggered when the login handoff resolves promptly', async () => {
    await expect(settleTeamsInteractiveLoginTrigger(async () => undefined, 10)).resolves.toBe(
      'triggered',
    );
  });

  it('returns timed_out when the login handoff never settles', async () => {
    await expect(
      settleTeamsInteractiveLoginTrigger(async () => new Promise<void>(() => undefined), 10),
    ).resolves.toBe('timed_out');
  });
});

describe('extractTeamsTokensFromMsalCache', () => {
  const makeCacheEntry = (audience: string, secret: string): TeamsMsalCacheEntry => ({
    secret,
    target: `${audience}/user_impersonation ${audience}/.default`,
    expires_on: String(Math.floor(Date.now() / 1000) + 3600),
    cached_at: String(Math.floor(Date.now() / 1000)),
  });

  it('extracts all three audience tokens from an MSAL localStorage dump', () => {
    const cache: Record<string, TeamsMsalCacheEntry> = {
      'oid.tid-login.windows.net-accesstoken-clientId-tid-skype': makeCacheEntry(
        'https://api.spaces.skype.com',
        'skype-token-abc',
      ),
      'oid.tid-login.windows.net-accesstoken-clientId-tid-csa': makeCacheEntry(
        'https://chatsvcagg.teams.microsoft.com',
        'csa-token-def',
      ),
      'oid.tid-login.windows.net-accesstoken-clientId-tid-ic3': makeCacheEntry(
        'https://ic3.teams.office.com',
        'ic3-token-ghi',
      ),
    };

    const result = extractTeamsTokensFromMsalCache(cache);
    expect(result).toEqual({
      skype: 'skype-token-abc',
      chatSvcAgg: 'csa-token-def',
      chatSvc: 'ic3-token-ghi',
    });
  });

  it('returns null when a required audience token is missing', () => {
    const cache: Record<string, TeamsMsalCacheEntry> = {
      'some-key': makeCacheEntry('https://api.spaces.skype.com', 'skype-only'),
    };
    expect(extractTeamsTokensFromMsalCache(cache)).toBeNull();
  });

  it('ignores expired tokens and prefers the newest cached matching entry', () => {
    const now = Math.floor(Date.now() / 1000);
    const cache: Record<string, TeamsMsalCacheEntry> = {
      expired: {
        secret: 'expired-skype',
        target: 'https://api.spaces.skype.com/.default',
        expires_on: String(now - 10),
        cached_at: String(now - 20),
      },
      olderCsa: {
        secret: 'older-csa',
        target: 'https://chatsvcagg.teams.microsoft.com/.default',
        expires_on: String(now + 3600),
        cached_at: String(now - 30),
      },
      newerCsa: {
        secret: 'newer-csa',
        target: 'https://chatsvcagg.teams.microsoft.com/.default',
        expires_on: String(now + 7200),
        cached_at: String(now - 5),
      },
      skype: {
        secret: 'fresh-skype',
        target: 'https://api.spaces.skype.com/.default',
        expires_on: String(now + 3600),
        cached_at: String(now - 5),
      },
      chatSvc: {
        secret: 'fresh-ic3',
        target: 'https://ic3.teams.office.com/.default',
        expires_on: String(now + 3600),
        cached_at: String(now - 5),
      },
    };

    expect(extractTeamsTokensFromMsalCache(cache)).toEqual({
      skype: 'fresh-skype',
      chatSvcAgg: 'newer-csa',
      chatSvc: 'fresh-ic3',
    });
  });
});

describe('parseTeamsChatListResponse', () => {
  it('normalizes raw CSA groupchats response into TeamsListCandidate items', () => {
    const raw = [
      {
        id: '19:abc@thread.v2',
        title: 'Design Sync',
        chatType: 'chat',
        lastMessage: {
          content: '<p>See you tomorrow</p>',
          imdisplayname: 'Alex',
          composetime: '2026-03-18T09:00:00Z',
        },
        hidden: false,
      },
      {
        id: '19:def@thread.v2',
        title: null,
        chatType: 'chat',
        lastMessage: {
          content: 'Hello',
          imdisplayname: 'Sam',
          composetime: '2026-03-17T08:00:00Z',
        },
        members: [
          { isMuted: false, mri: '8:orgid:user1', objectId: 'user1', role: 'Admin' },
          { isMuted: false, mri: '8:orgid:user2', objectId: 'user2', role: 'Admin' },
        ],
        hidden: false,
      },
    ];

    const items = parseTeamsChatListResponse(raw);
    expect(items).toHaveLength(2);

    const [first, second] = items;
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first?.id).toBe('/l/chat/19%3Aabc%40thread.v2');
    expect(first?.path).toBe('/l/chat/19%3Aabc%40thread.v2');
    expect(first?.title).toBe('Design Sync');
    expect(first?.kind).toBe('chat');
    expect(first?.preview).toBe('See you tomorrow');
    expect(second?.title).toContain('user1');
  });
});

describe('mergeTeamsListCandidates', () => {
  it('keeps direct chat results and appends missing DOM channels without duplicates', () => {
    const merged = mergeTeamsListCandidates(
      [
        {
          id: '/l/chat/19%3Achat1%40thread.v2',
          kind: 'chat',
          title: 'Project Alpha',
          path: '/l/chat/19%3Achat1%40thread.v2',
          preview: 'Latest update',
          order: 0,
        },
      ],
      [
        {
          id: '/l/chat/19%3Achat1%40thread.v2',
          kind: 'chat',
          title: 'Project Alpha',
          path: '/l/chat/19%3Achat1%40thread.v2',
          preview: 'Latest update',
          order: 3,
        },
        {
          id: '/l/channel/19%3Achannel1%40thread.tacv2/General?groupId=team-1',
          kind: 'channel',
          title: 'General',
          path: 'Engineering / General',
          preview: 'Build is green',
          order: 4,
        },
      ],
    );

    expect(merged.map((item) => item.kind)).toEqual(['chat', 'channel']);
    expect(merged[1]?.order).toBe(1);
  });
});

describe('parseTeamsMessagesResponse', () => {
  it('normalizes raw chatsvc messages into TeamsMessage items', () => {
    const raw = {
      messages: [
        {
          id: '111',
          imdisplayname: 'Alex',
          composetime: '2026-03-18T09:00:00Z',
          content: '<p>Morning</p>',
          messagetype: 'RichText/Html',
          type: 'Message',
        },
        {
          id: '222',
          imdisplayname: '',
          composetime: '2026-03-18T09:01:00Z',
          content: '',
          messagetype: 'ThreadActivity/TopicUpdate',
          type: 'Message',
        },
      ],
    };

    const messages = parseTeamsMessagesResponse(raw);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({
      id: '111',
      author: 'Alex',
      sentAt: '2026-03-18T09:00:00Z',
      text: 'Morning',
    });
  });
});

describe('settleTeamsAsyncAction', () => {
  it('returns the action result when it settles before the timeout', async () => {
    await expect(
      settleTeamsAsyncAction(
        async () => 'ready',
        10,
        () => 'timed_out',
      ),
    ).resolves.toBe('ready');
  });

  it('returns the timeout fallback when the action never settles', async () => {
    await expect(
      settleTeamsAsyncAction(
        async () => new Promise<string>(() => undefined),
        10,
        () => 'timed_out',
      ),
    ).resolves.toBe('timed_out');
  });

  it('clears the timeout when the action settles first', async () => {
    vi.useFakeTimers();
    try {
      const resultPromise = settleTeamsAsyncAction(
        async () => 'ready',
        10_000,
        () => 'timed_out',
      );
      await Promise.resolve();

      expect(await resultPromise).toBe('ready');
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

// --- Direct HTTP client tests (fetch mocked) ---

const stubTokens: TeamsTokenSet = {
  skype: 'skype-bearer',
  chatSvcAgg: 'csa-bearer',
  chatSvc: 'ic3-bearer',
};

describe('fetchTeamsAuthzBootstrap', () => {
  it('posts to authz and returns region + skypeToken from the response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        regionGtms: { middleTier: 'https://teams.microsoft.com' },
        region: 'uk',
        partition: 'uk02',
        tokens: { skypeToken: 'skype-token-from-authz' },
      }),
    });

    const result = await fetchTeamsAuthzBootstrap(stubTokens.skype, mockFetch);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://teams.microsoft.com/api/authsvc/v1.0/authz',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer skype-bearer',
        }),
      }),
    );
    expect(result.region).toBe('uk');
    expect(result.partition).toBe('uk02');
    expect(result.skypeToken).toBe('skype-token-from-authz');
  });

  it('throws on non-OK response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    });

    await expect(fetchTeamsAuthzBootstrap(stubTokens.skype, mockFetch)).rejects.toThrow(
      /authz.*401/i,
    );
  });
});

describe('fetchTeamsChatList', () => {
  it('fetches groupchats with correct auth and region headers', async () => {
    const chatPayload = [{ id: '19:abc@thread.v2', title: 'Chat A', chatType: 'chat' }];
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => chatPayload,
    });

    const result = await fetchTeamsChatList(
      { token: stubTokens.chatSvcAgg, region: 'uk', partition: 'uk02' },
      mockFetch,
    );

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/csa/uk/api/v1/teams/users/me/groupchats'),
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: 'Bearer csa-bearer',
          'x-ms-region': 'uk',
          'x-ms-partition': 'uk02',
        }),
      }),
    );
    expect(result).toEqual(chatPayload);
  });
});

describe('fetchTeamsMessages', () => {
  it('fetches messages for a conversation with correct headers', async () => {
    const messagesPayload = {
      messages: [
        {
          id: '1',
          imdisplayname: 'Bob',
          composetime: '2026-01-01T00:00:00Z',
          content: 'Hello',
          messagetype: 'Text',
          type: 'Message',
        },
      ],
    };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => messagesPayload,
    });

    const result = await fetchTeamsMessages(
      {
        token: stubTokens.chatSvc,
        region: 'uk',
        partition: 'uk02',
        conversationId: '19:abc@thread.v2',
        pageSize: 50,
      },
      mockFetch,
    );

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(
        '/api/chatsvc/uk/v1/users/ME/conversations/19%3Aabc%40thread.v2/messages',
      ),
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: 'Bearer ic3-bearer',
        }),
      }),
    );
    expect(result).toEqual(messagesPayload);
  });
});

describe('listTeamsDirect', () => {
  it('fetches authz bootstrap, then chat list, and returns a TeamsListResult', async () => {
    const authzResponse = {
      ok: true,
      json: async (): Promise<unknown> => ({
        region: 'uk',
        partition: 'uk02',
        tokens: { skypeToken: 'skype-realtime' },
        regionGtms: {},
      }),
    };
    const chatListResponse = {
      ok: true,
      json: async (): Promise<unknown> => [
        {
          id: '19:chat1@thread.v2',
          title: 'Project Alpha',
          chatType: 'chat',
          lastMessage: { content: 'Latest update', imdisplayname: 'Jo' },
        },
        {
          id: '19:chat2@thread.v2',
          title: 'Standup',
          chatType: 'chat',
          lastMessage: { content: 'Done for today', imdisplayname: 'Alex' },
        },
      ],
    };

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(authzResponse)
      .mockResolvedValueOnce(chatListResponse);

    const { listTeamsDirect } = await import('@clawpilot/browser/teams.js');
    const result = await listTeamsDirect(stubTokens, { limit: 20, offset: 0 }, mockFetch);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.chats).toHaveLength(2);
    expect(result.chats[0]?.title).toBe('Project Alpha');
    expect(result.page.total).toBe(2);
  });
});

describe('readTeamsDirect', () => {
  it('fetches authz bootstrap, then messages, and returns a TeamsReadResult', async () => {
    const authzResponse = {
      ok: true,
      json: async (): Promise<unknown> => ({
        region: 'uk',
        partition: 'uk02',
        tokens: { skypeToken: 'skype-realtime' },
        regionGtms: {},
      }),
    };
    const messagesResponse = {
      ok: true,
      json: async (): Promise<unknown> => ({
        messages: [
          {
            id: '1',
            imdisplayname: 'Jo',
            composetime: '2026-03-18T10:00:00Z',
            content: '<p>Hello team</p>',
            messagetype: 'RichText/Html',
            type: 'Message',
          },
        ],
      }),
    };

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(authzResponse)
      .mockResolvedValueOnce(messagesResponse);

    const { readTeamsDirect } = await import('@clawpilot/browser/teams.js');
    const result = await readTeamsDirect(
      stubTokens,
      { id: '/l/chat/19%3Achat1%40thread.v2', limit: 50, offset: 0 },
      mockFetch,
    );

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/conversations/19%3Achat1%40thread.v2/messages'),
      expect.any(Object),
    );
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]?.text).toBe('Hello team');
    expect(result.target.id).toBe('/l/chat/19%3Achat1%40thread.v2');
  });
});
