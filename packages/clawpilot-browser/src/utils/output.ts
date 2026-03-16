export interface SuccessResponse<T = unknown> {
  ok: true;
  data?: T;
}

export interface ErrorResponse {
  ok: false;
  error: string;
  message: string;
}

export type CLIResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

export function success<T>(data?: T): SuccessResponse<T> {
  if (data === undefined) return { ok: true } as SuccessResponse<T>;
  return { ok: true, data };
}

export function error(type: string, message: string): ErrorResponse {
  return { ok: false, error: type, message };
}

export function formatOutput(response: CLIResponse): string {
  return JSON.stringify(response, null, 2);
}

/** Print response to stdout and exit with appropriate code */
export function output(response: CLIResponse): void {
  console.log(formatOutput(response));
  process.exitCode = response.ok ? 0 : 1;
}
