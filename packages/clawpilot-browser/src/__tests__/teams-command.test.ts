import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';

const outputMock = vi.fn();
const successMock = vi.fn((data?: unknown) => ({ ok: true as const, data }));
const errorMock = vi.fn((type: string, message: string) => ({
  ok: false as const,
  error: type,
  message,
}));
const listTeamsMock = vi.fn();
const readTeamsMock = vi.fn();
const formatTeamsListMock = vi.fn(() => 'formatted teams list');
const formatTeamsReadMock = vi.fn(() => 'formatted teams read');
const consoleLogMock = vi.spyOn(console, 'log').mockImplementation(() => undefined);

vi.mock('@clawpilot/browser/utils/output.js', () => ({
  output: outputMock,
  success: successMock,
  error: errorMock,
}));

vi.mock('@clawpilot/browser/teams.js', () => ({
  listTeams: listTeamsMock,
  readTeams: readTeamsMock,
  formatTeamsList: formatTeamsListMock,
  formatTeamsRead: formatTeamsReadMock,
}));

async function createProgram(): Promise<Command> {
  const { registerTeamsCommands } = await import('@clawpilot/browser/commands/teams.js');
  const program = new Command();
  registerTeamsCommands(program);
  return program;
}

describe('registerTeamsCommands', () => {
  beforeEach(() => {
    vi.resetModules();
    outputMock.mockClear();
    successMock.mockClear();
    errorMock.mockClear();
    listTeamsMock.mockReset();
    readTeamsMock.mockReset();
    formatTeamsListMock.mockClear();
    formatTeamsReadMock.mockClear();
    consoleLogMock.mockClear();
  });

  it('prints JSON for teams list when requested', async () => {
    listTeamsMock.mockResolvedValue({
      page: { limit: 20, offset: 0, total: 1, hasMore: false, nextOffset: null },
      chats: [],
      channels: [],
    });

    const program = await createProgram();
    await program.parseAsync(['node', 'test', 'teams', 'list', '--json']);

    expect(listTeamsMock).toHaveBeenCalledWith({ limit: 20, offset: 0 });
    expect(outputMock).toHaveBeenCalledWith({
      ok: true,
      data: {
        page: { limit: 20, offset: 0, total: 1, hasMore: false, nextOffset: null },
        chats: [],
        channels: [],
      },
    });
  });

  it('prints human-readable output for teams read by default', async () => {
    readTeamsMock.mockResolvedValue({
      target: { id: '/l/chat/chat-1', kind: 'chat', title: 'Design Sync', path: 'Design Sync' },
      page: { limit: 20, offset: 0, total: 1, hasMore: false, nextOffset: null },
      messages: [{ id: 'm1', author: 'Alex', sentAt: null, text: 'Morning' }],
    });

    const program = await createProgram();
    await program.parseAsync(['node', 'test', 'teams', 'read', '/l/chat/chat-1']);

    expect(readTeamsMock).toHaveBeenCalledWith({ id: '/l/chat/chat-1', limit: 20, offset: 0 });
    expect(formatTeamsReadMock).toHaveBeenCalled();
    expect(consoleLogMock).toHaveBeenCalledWith('formatted teams read');
  });
});
