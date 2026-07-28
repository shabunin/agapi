import { getHost } from '../host';
import type { NfcTag } from '../host';
import { mapHostError } from '../errors';

export type { NfcTag } from '../host';

const NO_HOST_MESSAGE =
    '@agapi/stdlib/nfc: no NfcHost installed. Mobile-only (Android/iOS) — not available on this host.';

function requireNfcHost() {
    const host = getHost();
    if (!host?.nfc) {
        throw mapHostError(NO_HOST_MESSAGE, { syscall: 'nfc' });
    }
    return host.nfc;
}

export function isAvailable(): Promise<boolean> {
    const host = getHost();
    if (!host?.nfc) {
        return Promise.reject(mapHostError(NO_HOST_MESSAGE, { syscall: 'isAvailable' }));
    }
    return host.nfc.isAvailable().catch((err) => {
        throw mapHostError(err, { syscall: 'isAvailable' });
    });
}

/**
 * ```js
 * const tag = await agapi.nfc.scan({ type: 'ndef' });
 * console.log(tag.records);
 * ```
 */
export function scan(scanType: any, options?: any): Promise<NfcTag> {
    const host = getHost();
    if (!host?.nfc) {
        return Promise.reject(mapHostError(NO_HOST_MESSAGE, { syscall: 'scan' }));
    }
    return host.nfc.scan(scanType, options).catch((err) => {
        throw mapHostError(err, { syscall: 'scan' });
    });
}

/**
 * ```js
 * await agapi.nfc.write([agapi.nfc.uriRecord('https://tauri.app')], { kind: { type: 'ndef' } });
 * ```
 */
export function write(records: any[], options?: any): Promise<void> {
    const host = getHost();
    if (!host?.nfc) {
        return Promise.reject(mapHostError(NO_HOST_MESSAGE, { syscall: 'write' }));
    }
    return host.nfc.write(records, options).catch((err) => {
        throw mapHostError(err, { syscall: 'write' });
    });
}

/** Pure data-shaping helper — no IPC, throws only if no host is installed at all. */
export function textRecord(text: string, id?: string | number[], language?: string): any {
    return requireNfcHost().textRecord(text, id, language);
}

/** Pure data-shaping helper — no IPC, throws only if no host is installed at all. */
export function uriRecord(uri: string, id?: string | number[]): any {
    return requireNfcHost().uriRecord(uri, id);
}

const nfc = {
    isAvailable,
    scan,
    write,
    textRecord,
    uriRecord,
};

export default nfc;
