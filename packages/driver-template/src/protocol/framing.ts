/**
 * Split a TCP byte stream into CRLF / LF terminated lines.
 * Devices often deliver partial chunks — never assume one write == one line.
 */

/** Guard against a device that never sends a line terminator. */
const MAX_BUFFERED_CHARS = 64 * 1024;

export class LineBuffer {
  private buf = '';

  /** Push a decoded chunk; return complete lines (without trailing CR/LF). */
  push(text: string): string[] {
    this.buf += text;
    if (this.buf.length > MAX_BUFFERED_CHARS) {
      throw new Error(`LineBuffer: no line terminator within ${MAX_BUFFERED_CHARS} chars`);
    }
    const lines: string[] = [];
    for (;;) {
      const crlf = this.buf.indexOf('\r\n');
      const lf = this.buf.indexOf('\n');
      let cut = -1;
      let skip = 0;
      if (crlf >= 0 && (lf < 0 || crlf <= lf)) {
        cut = crlf;
        skip = 2;
      } else if (lf >= 0) {
        cut = lf;
        skip = 1;
      }
      if (cut < 0) break;
      lines.push(this.buf.slice(0, cut).replace(/\r$/, ''));
      this.buf = this.buf.slice(cut + skip);
    }
    return lines;
  }

  clear() {
    this.buf = '';
  }
}

/** Encode a command the way this template expects: trailing CRLF. */
export function encodeLine(command: string): string {
  const trimmed = command.replace(/\r?\n$/g, '');
  return `${trimmed}\r\n`;
}
