import type { HostErrorInit } from '@agapi/host-protocol';

/**
 * Node-like system error for stdlib network/fs APIs.
 */
export class SystemError extends Error {
  code?: string;
  errno?: number;
  syscall?: string;
  address?: string;
  port?: number;

  constructor(init: HostErrorInit | string) {
    if (typeof init === 'string') {
      super(init);
      this.name = 'SystemError';
      return;
    }
    super(init.message);
    this.name = 'SystemError';
    this.code = init.code;
    this.errno = init.errno;
    this.syscall = init.syscall;
    this.address = init.address;
    this.port = init.port;
  }
}

/** Best-effort map from opaque host/Rust error strings. */
export function mapHostError(err: unknown, fallbackSyscall?: string): SystemError {
  const message = String(err instanceof Error ? err.message : err);

  const patterns: Array<{ re: RegExp; code: string }> = [
    { re: /connection refused|ECONNREFUSED/i, code: 'ECONNREFUSED' },
    { re: /address already in use|EADDRINUSE/i, code: 'EADDRINUSE' },
    { re: /network is unreachable|ENETUNREACH/i, code: 'ENETUNREACH' },
    { re: /host is unreachable|EHOSTUNREACH/i, code: 'EHOSTUNREACH' },
    { re: /timed out|ETIMEDOUT|timeout/i, code: 'ETIMEDOUT' },
    { re: /broken pipe|EPIPE/i, code: 'EPIPE' },
    { re: /connection reset|ECONNRESET/i, code: 'ECONNRESET' },
    { re: /not connected|ENOTCONN/i, code: 'ENOTCONN' },
    { re: /bad file|EBADF/i, code: 'EBADF' },
    { re: /permission denied|EACCES/i, code: 'EACCES' },
  ];

  for (const { re, code } of patterns) {
    if (re.test(message)) {
      return new SystemError({ message, code, syscall: fallbackSyscall });
    }
  }

  return new SystemError({ message, syscall: fallbackSyscall });
}
