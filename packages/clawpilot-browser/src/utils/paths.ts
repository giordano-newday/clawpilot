function getHomeDir(): string {
  const home = process.env.HOME;
  if (!home) throw new Error('HOME environment variable is not set');
  return home;
}

export const DEFAULT_STATE_DIR = `${getHomeDir()}/.clawpilot/state/browser-state`;
