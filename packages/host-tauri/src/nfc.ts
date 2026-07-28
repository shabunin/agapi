import {
    isAvailable,
    scan,
    write,
    textRecord,
    uriRecord,
} from '@tauri-apps/plugin-nfc';
import type { NfcHost, NfcTag } from '@agapi/stdlib/host';
import { mapHostError } from '@agapi/stdlib/errors';

export class TauriNfcHost implements NfcHost {
    name = 'TauriNfcHost';

    isAvailable(): Promise<boolean> {
        return isAvailable().catch((err) => {
            throw mapHostError(err, { syscall: 'nfc.isAvailable' });
        });
    }

    async scan(scanType: any, options?: any): Promise<NfcTag> {
        try {
            return await scan(scanType, options);
        } catch (err) {
            throw mapHostError(err, { syscall: 'nfc.scan' });
        }
    }

    async write(records: any[], options?: any): Promise<void> {
        try {
            await write(records, options);
        } catch (err) {
            throw mapHostError(err, { syscall: 'nfc.write' });
        }
    }

    // Pure data-shaping helpers — no IPC involved, safe to call synchronously.
    textRecord(text: string, id?: string | number[], language?: string): any {
        return textRecord(text, id, language);
    }

    uriRecord(uri: string, id?: string | number[]): any {
        return uriRecord(uri, id);
    }
}

export function createNfcHost(): NfcHost {
    return new TauriNfcHost();
}
