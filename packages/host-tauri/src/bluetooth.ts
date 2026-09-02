import {
    checkPermissions,
    getAdapterState,
    startScan,
    stopScan,
    getScanningUpdates,
    connect,
    disconnect,
    getConnectionUpdates,
    listServices,
    getMtu,
    read,
    readString,
    send,
    sendString,
    subscribe,
    subscribeString,
    unsubscribe,
} from '@mnlphlp/plugin-blec';
import type { BluetoothHost, BleDevice, BleService, BleAdapterState, BleWriteType } from '@agapi/stdlib/host';
import { mapHostError } from '@agapi/stdlib/errors';

/**
 * BLE central/client host on the community `tauri-plugin-blec` (btleplug
 * desktop backends + native Android/iOS bridge). Peripheral/server mode isn't
 * covered — see the note on `BluetoothHost` in stdlib's host.ts.
 */
export class TauriBluetoothHost implements BluetoothHost {
    name = 'TauriBluetoothHost';

    checkPermissions(askIfDenied?: boolean): Promise<boolean> {
        return checkPermissions(askIfDenied).catch((err) => {
            throw mapHostError(err, { syscall: 'bluetooth.checkPermissions' });
        });
    }

    getAdapterState(): Promise<BleAdapterState> {
        return getAdapterState().catch((err) => {
            throw mapHostError(err, { syscall: 'bluetooth.getAdapterState' });
        });
    }

    startScan(onDevices: (devices: BleDevice[]) => void, timeoutMs: number, allowIbeacons?: boolean): Promise<void> {
        return startScan(onDevices, timeoutMs, allowIbeacons).catch((err) => {
            throw mapHostError(err, { syscall: 'bluetooth.startScan' });
        });
    }

    stopScan(): Promise<void> {
        return stopScan().catch((err) => {
            throw mapHostError(err, { syscall: 'bluetooth.stopScan' });
        });
    }

    onScanningChange(handler: (scanning: boolean) => void): Promise<void> {
        return getScanningUpdates(handler).catch((err) => {
            throw mapHostError(err, { syscall: 'bluetooth.onScanningChange' });
        });
    }

    connect(address: string, onDisconnect?: (() => void) | null, allowIbeacons?: boolean): Promise<void> {
        return connect(address, onDisconnect ?? null, allowIbeacons).catch((err) => {
            throw mapHostError(err, { syscall: 'bluetooth.connect' });
        });
    }

    disconnect(): Promise<void> {
        return disconnect().catch((err) => {
            throw mapHostError(err, { syscall: 'bluetooth.disconnect' });
        });
    }

    onConnectionChange(handler: (connected: boolean) => void): Promise<void> {
        return getConnectionUpdates(handler).catch((err) => {
            throw mapHostError(err, { syscall: 'bluetooth.onConnectionChange' });
        });
    }

    async listServices(address: string): Promise<BleService[]> {
        try {
            const result = await listServices(address);
            // Upstream returns `BleService[] | string` — a string means an
            // error message came back on the success path instead of a reject.
            if (typeof result === 'string') {
                throw new Error(result);
            }
            return result;
        } catch (err) {
            throw mapHostError(err, { syscall: 'bluetooth.listServices' });
        }
    }

    getMtu(): Promise<number> {
        return getMtu().catch((err) => {
            throw mapHostError(err, { syscall: 'bluetooth.getMtu' });
        });
    }

    read(characteristic: string, service?: string): Promise<number[]> {
        return read(characteristic, service).catch((err) => {
            throw mapHostError(err, { syscall: 'bluetooth.read' });
        });
    }

    readString(characteristic: string, service?: string): Promise<string> {
        return readString(characteristic, service).catch((err) => {
            throw mapHostError(err, { syscall: 'bluetooth.readString' });
        });
    }

    send(characteristic: string, data: number[], writeType?: BleWriteType, service?: string): Promise<void> {
        return send(characteristic, data, writeType, service).catch((err) => {
            throw mapHostError(err, { syscall: 'bluetooth.send' });
        });
    }

    sendString(characteristic: string, text: string, writeType?: BleWriteType, service?: string): Promise<void> {
        return sendString(characteristic, text, writeType, service).catch((err) => {
            throw mapHostError(err, { syscall: 'bluetooth.sendString' });
        });
    }

    subscribe(characteristic: string, service: string | null, handler: (data: number[]) => void): Promise<void> {
        return subscribe(characteristic, service, handler).catch((err) => {
            throw mapHostError(err, { syscall: 'bluetooth.subscribe' });
        });
    }

    subscribeString(characteristic: string, service: string | null, handler: (text: string) => void): Promise<void> {
        return subscribeString(characteristic, service, handler).catch((err) => {
            throw mapHostError(err, { syscall: 'bluetooth.subscribeString' });
        });
    }

    unsubscribe(characteristic: string, service?: string): Promise<void> {
        return unsubscribe(characteristic, service).catch((err) => {
            throw mapHostError(err, { syscall: 'bluetooth.unsubscribe' });
        });
    }
}

export function createBluetoothHost(): BluetoothHost {
    return new TauriBluetoothHost();
}
