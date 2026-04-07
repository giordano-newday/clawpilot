import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';

const outputMock = vi.fn();
const successMock = vi.fn((data?: unknown) => ({ ok: true as const, data }));
const errorMock = vi.fn((type: string, message: string) => ({
  ok: false as const,
  error: type,
  message,
}));
const resolveConfluenceCredentialsMock = vi.fn();
const getConfluencePageMock = vi.fn();
const createConfluenceChildPageMock = vi.fn();
const updateConfluencePageMock = vi.fn();
const formatConfluencePageMock = vi.fn(() => 'formatted confluence page');
const consoleLogMock = vi.spyOn(console, 'log').mockImplementation(() => undefined);

vi.mock('@clawpilot/browser/utils/output.js', () => ({
  output: outputMock,
  success: successMock,
  error: errorMock,
}));

vi.mock('@clawpilot/browser/confluence.js', () => ({
  resolveConfluenceCredentials: resolveConfluenceCredentialsMock,
  getConfluencePage: getConfluencePageMock,
  createConfluenceChildPage: createConfluenceChildPageMock,
  updateConfluencePage: updateConfluencePageMock,
  formatConfluencePage: formatConfluencePageMock,
}));

async function createProgram(): Promise<Command> {
  const { registerConfluenceCommands } = await import('@clawpilot/browser/commands/confluence.js');
  const program = new Command();
  registerConfluenceCommands(program);
  return program;
}

describe('registerConfluenceCommands', () => {
  beforeEach(() => {
    vi.resetModules();
    outputMock.mockClear();
    successMock.mockClear();
    errorMock.mockClear();
    resolveConfluenceCredentialsMock.mockReset();
    getConfluencePageMock.mockReset();
    createConfluenceChildPageMock.mockReset();
    updateConfluencePageMock.mockReset();
    formatConfluencePageMock.mockClear();
    consoleLogMock.mockClear();
    resolveConfluenceCredentialsMock.mockReturnValue({
      siteBaseUrl: 'https://newdaycards.atlassian.net',
      apiBaseUrl: 'https://newdaycards.atlassian.net/wiki/api/v2',
      login: 'giordano.scalzo@newday.co.uk',
      apiToken: 'jira-token',
    });
  });

  it('prints JSON for confluence page get when requested', async () => {
    getConfluencePageMock.mockResolvedValue({
      id: '6161891597',
      title: '2026',
      status: 'current',
      spaceId: '3210313921',
      parentId: '5233803520',
      versionNumber: 1,
      body: '',
      webUrl: 'https://newdaycards.atlassian.net/wiki/spaces/~user/pages/6161891597/2026',
    });

    const program = await createProgram();
    await program.parseAsync(['node', 'test', 'confluence', 'page', 'get', '6161891597', '--json']);

    expect(getConfluencePageMock).toHaveBeenCalledWith({
      pageRef: '6161891597',
      auth: expect.any(Object),
    });
    expect(outputMock).toHaveBeenCalledWith({
      ok: true,
      data: expect.objectContaining({ id: '6161891597', title: '2026' }),
    });
  });

  it('prints human-readable output for child-page creation by default', async () => {
    createConfluenceChildPageMock.mockResolvedValue({
      id: '7000000001',
      title: 'Weekly work summary - 2026-04-06',
      status: 'current',
      spaceId: '3210313921',
      parentId: '6161891597',
      versionNumber: 1,
      body: '<p>Summary</p>',
      webUrl:
        'https://newdaycards.atlassian.net/wiki/spaces/~user/pages/7000000001/Weekly-work-summary-2026-04-06',
    });

    const program = await createProgram();
    await program.parseAsync([
      'node',
      'test',
      'confluence',
      'page',
      'create-child',
      '6161891597',
      '--title',
      'Weekly work summary - 2026-04-06',
      '--body',
      '<p>Summary</p>',
    ]);

    expect(createConfluenceChildPageMock).toHaveBeenCalledWith({
      parentRef: '6161891597',
      title: 'Weekly work summary - 2026-04-06',
      body: '<p>Summary</p>',
      auth: expect.any(Object),
    });
    expect(formatConfluencePageMock).toHaveBeenCalled();
    expect(consoleLogMock).toHaveBeenCalledWith('formatted confluence page');
  });

  it('prints JSON for page updates when requested', async () => {
    updateConfluencePageMock.mockResolvedValue({
      id: '7000000001',
      title: 'Weekly work summary - 2026-04-06',
      status: 'current',
      spaceId: '3210313921',
      parentId: '6161891597',
      versionNumber: 2,
      body: '<p>Updated</p>',
      webUrl:
        'https://newdaycards.atlassian.net/wiki/spaces/~user/pages/7000000001/Weekly-work-summary-2026-04-06',
    });

    const program = await createProgram();
    await program.parseAsync([
      'node',
      'test',
      'confluence',
      'page',
      'update',
      '7000000001',
      '--body',
      '<p>Updated</p>',
      '--json',
    ]);

    expect(updateConfluencePageMock).toHaveBeenCalledWith({
      pageRef: '7000000001',
      title: undefined,
      body: '<p>Updated</p>',
      auth: expect.any(Object),
    });
    expect(outputMock).toHaveBeenCalledWith({
      ok: true,
      data: expect.objectContaining({ id: '7000000001', versionNumber: 2 }),
    });
  });
});
