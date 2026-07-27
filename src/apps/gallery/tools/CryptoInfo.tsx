import React, { useMemo } from 'react';
import { ToolShell } from '../components/ToolShell';
import { CapabilityTable, type CapRow } from '../components/CapabilityTable';
import { examplesFor } from '../examples';

function hasSubtle(): boolean {
  return typeof globalThis.crypto?.subtle !== 'undefined';
}

function hasGetRandomValues(): boolean {
  return typeof globalThis.crypto?.getRandomValues === 'function';
}

function hasSubtleMethod(name: string): boolean {
  const s = globalThis.crypto?.subtle as SubtleCrypto | undefined;
  return !!s && typeof (s as any)[name] === 'function';
}

/**
 * Browser Web Crypto lab — no agapi.crypto yet.
 * Probe + playground against globalThis.crypto / crypto.subtle.
 */
export default function CryptoInfo({ onBack }: { onBack: () => void }) {
  const rows: CapRow[] = useMemo(() => {
    const subtle = hasSubtle();
    return [
      {
        name: 'crypto',
        supported: typeof globalThis.crypto !== 'undefined',
        detail: typeof globalThis.crypto,
      },
      {
        name: 'crypto.getRandomValues',
        supported: hasGetRandomValues(),
      },
      {
        name: 'crypto.randomUUID',
        supported: typeof globalThis.crypto?.randomUUID === 'function',
      },
      {
        name: 'crypto.subtle',
        supported: subtle,
        detail: subtle ? 'SubtleCrypto' : 'missing (insecure context?)',
      },
      { name: 'subtle.digest', supported: hasSubtleMethod('digest') },
      { name: 'subtle.importKey', supported: hasSubtleMethod('importKey') },
      { name: 'subtle.exportKey', supported: hasSubtleMethod('exportKey') },
      { name: 'subtle.generateKey', supported: hasSubtleMethod('generateKey') },
      { name: 'subtle.sign', supported: hasSubtleMethod('sign') },
      { name: 'subtle.verify', supported: hasSubtleMethod('verify') },
      { name: 'subtle.encrypt', supported: hasSubtleMethod('encrypt') },
      { name: 'subtle.decrypt', supported: hasSubtleMethod('decrypt') },
      { name: 'subtle.deriveBits', supported: hasSubtleMethod('deriveBits') },
      { name: 'subtle.deriveKey', supported: hasSubtleMethod('deriveKey') },
      {
        name: 'AES-GCM (via subtle)',
        supported: subtle,
        detail: 'algorithm; not AES-CCM',
      },
      {
        name: 'AES-CCM',
        supported: false,
        detail: 'not in Web Crypto (Matter needs JS/native)',
      },
      {
        name: 'MD5',
        supported: false,
        detail: 'not in Web Crypto (CF.hash uses pure-JS)',
      },
      {
        name: 'SHA-256',
        supported: hasSubtleMethod('digest'),
        detail: 'subtle.digest("SHA-256", …)',
      },
      {
        name: 'ECDSA / ECDH P-256',
        supported: hasSubtleMethod('generateKey') && hasSubtleMethod('sign'),
        detail: 'namedCurve: P-256',
      },
      {
        name: 'PBKDF2 / HKDF',
        supported: hasSubtleMethod('deriveBits'),
      },
    ];
  }, []);

  const isSecure =
    typeof window !== 'undefined' &&
    (window.isSecureContext ||
      location.protocol === 'https:' ||
      location.hostname === 'localhost' ||
      location.hostname === '127.0.0.1');

  return (
    <ToolShell
      title="Crypto"
      surface="browser Web Crypto (crypto.subtle)"
      status="lab"
      onBack={onBack}
      examples={examplesFor('crypto')}
    >
      <div className="p-4 max-w-2xl mx-auto space-y-4">
        <p className="text-sm text-gray-400 leading-relaxed">
          Lab for the <strong className="text-gray-300 font-medium">standard browser Web Crypto API</strong>
          — not <code className="text-gray-500">agapi.crypto</code> (not shipped yet). Playground runs against{' '}
          <code className="text-gray-500">globalThis.crypto</code>.
        </p>

        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            isSecure
              ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200/90'
              : 'border-amber-500/30 bg-amber-500/10 text-amber-200/90'
          }`}
        >
          {isSecure
            ? 'Secure context — subtle should be available (unless the webview strips it).'
            : 'Not a secure context — crypto.subtle may be missing. Prefer https / localhost / Tauri webview.'}
        </div>

        <CapabilityTable rows={rows} />

        <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-3 text-xs text-gray-500 leading-relaxed space-y-1">
          <p>
            <span className="text-gray-400">Matter note:</span> AES-CCM is not in Web Crypto; matter.js uses
            pure-JS CCM + subtle for the rest.
          </p>
          <p>
            <span className="text-gray-400">CF note:</span> <code className="text-gray-500">CF.hash</code> already
            uses subtle for SHA-* and pure-JS for MD5.
          </p>
        </div>
      </div>
    </ToolShell>
  );
}
