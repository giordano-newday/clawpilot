import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';

const outputMock = vi.fn();
const successMock = vi.fn((data?: unknown) => ({ ok: true as const, data }));
const errorMock = vi.fn((type: string, message: string) => ({
  ok: false as const,
  error: type,
  message,
}));

const hasSessionMock = vi.fn();
const validateSessionMock = vi.fn();
const loginMock = vi.fn();
const clearSessionMock = vi.fn();

vi.mock('../utils/output.js', () => ({
  output: outputMock,
  success: successMock,
  error: errorMock,
}));

vi.mock('../browser.js', () => ({
  BrowserManager: vi.fn(() => ({
    hasSession: hasSessionMock,
    validateSession: validateSessionMock,
    login: loginMock,
    clearSession: clearSessionMock,
  })),
}));

async function runAuthStatusCommand(args: string[] = []): Promise<void> {
  const { registerAuthCommands } = await import('../commands/auth.js');
  const program = new Command();
  registerAuthCommands(program);

  await program.parseAsync(['node', 'test', 'auth', 'status', ...args]);
}

describe('registerAuthCommands', () => {
  beforeEach(() => {
    vi.resetModules();
    outputMock.mockClear();
    successMock.mockClear();
    errorMock.mockClear();
    hasSessionMock.mockReset();
    validateSessionMock.mockReset();
    loginMock.mockReset();
    clearSessionMock.mockReset();
  });

  it('reports no browser session when no session files exist', async () => {
    hasSessionMock.mockReturnValue(false);

    await runAuthStatusCommand();

    expect(validateSessionMock).not.toHaveBeenCalled();
    expect(successMock).toHaveBeenCalledWith({
      authenticated: false,
      message: 'No browser session found. Run: clawpilot-browser auth login',
    });
    expect(outputMock).toHaveBeenCalledWith({
      ok: true,
      data: {
        authenticated: false,
        message: 'No browser session found. Run: clawpilot-browser auth login',
      },
    });
  });

  it('reports session files exist without validation by default', async () => {
    hasSessionMock.mockReturnValue(true);

    await runAuthStatusCommand();

    expect(validateSessionMock).not.toHaveBeenCalled();
    expect(successMock).toHaveBeenCalledWith({
      authenticated: true,
      validated: false,
      message: 'Session files exist. Use --validate to check if session is still active.',
    });
    expect(outputMock).toHaveBeenCalledWith({
      ok: true,
      data: {
        authenticated: true,
        validated: false,
        message: 'Session files exist. Use --validate to check if session is still active.',
      },
    });
  });

  it('validates the session when --validate is provided', async () => {
    hasSessionMock.mockReturnValue(true);
    validateSessionMock.mockResolvedValue({
      valid: true,
      teamsAccessible: true,
      outlookAccessible: true,
    });

    await runAuthStatusCommand(['--validate']);

    expect(validateSessionMock).toHaveBeenCalledTimes(1);
    expect(successMock).toHaveBeenCalledWith({
      authenticated: true,
      validated: true,
      teamsAccessible: true,
      outlookAccessible: true,
      message: 'Session is valid. Teams and Outlook are accessible.',
    });
    expect(outputMock).toHaveBeenCalledWith({
      ok: true,
      data: {
        authenticated: true,
        validated: true,
        teamsAccessible: true,
        outlookAccessible: true,
        message: 'Session is valid. Teams and Outlook are accessible.',
      },
    });
  });

  it('reports Teams-only validation success accurately', async () => {
    hasSessionMock.mockReturnValue(true);
    validateSessionMock.mockResolvedValue({
      valid: true,
      teamsAccessible: true,
      outlookAccessible: false,
    });

    await runAuthStatusCommand(['--validate']);

    expect(successMock).toHaveBeenCalledWith({
      authenticated: true,
      validated: true,
      teamsAccessible: true,
      outlookAccessible: false,
      message: 'Session is valid. Teams is accessible (Outlook check failed).',
    });
  });

  it('reports Outlook-only validation success accurately', async () => {
    hasSessionMock.mockReturnValue(true);
    validateSessionMock.mockResolvedValue({
      valid: true,
      teamsAccessible: false,
      outlookAccessible: true,
    });

    await runAuthStatusCommand(['--validate']);

    expect(successMock).toHaveBeenCalledWith({
      authenticated: true,
      validated: true,
      teamsAccessible: false,
      outlookAccessible: true,
      message: 'Session is valid. Outlook is accessible (Teams check failed).',
    });
  });

  it('reports validation failures as command errors', async () => {
    hasSessionMock.mockReturnValue(true);
    validateSessionMock.mockRejectedValue(new Error('kaboom'));

    await runAuthStatusCommand(['--validate']);

    expect(errorMock).toHaveBeenCalledWith('validation_failed', 'kaboom');
    expect(outputMock).toHaveBeenCalledWith({
      ok: false,
      error: 'validation_failed',
      message: 'kaboom',
    });
  });
});
