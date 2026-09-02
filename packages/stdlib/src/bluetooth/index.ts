import { getHost } from '../host';
import type { BleDevice, BleService, BleAdapterState, BleWriteType } from '../host';
import { mapHostError } from '../errors';

export type { BleDevice, BleService, BleCharacteristic, BleAdapterState, BleWriteType } from '../host';

const NO_HOST_MESSAGE =
    '@agapi/stdlib/bluetooth: no BluetoothHost installed. Client/central only — ' +
    'peripheral/server mode is not implemented (see STDLIB_ROADMAP.md C9).';

function requireBluetoothHost(syscall: string) {
    const host = getHost();
    if (!host?.bluetooth) {
        throw mapHostError(NO_HOST_MESSAGE, { syscall });
    }
    return host.bluetooth;
}

/** Whether the OS has granted Bluetooth permissions (asks the user if not, unless `askIfDenied: false`). */
export function checkPermissions(askIfDenied?: boolean): Promise<boolean> {
    try {
        return requireBluetoothHost('checkPermissions').checkPermissions(askIfDenied);
    } catch (err) {
        return Promise.reject(err);
    }
}

/** State of the local Bluetooth adapter/radio. */
export function getAdapterState(): Promise<BleAdapterState> {
    try {
        return requireBluetoothHost('getAdapterState').getAdapterState();
    } catch (err) {
        return Promise.reject(err);
    }
}

/**
 * ```js
 * await agapi.bluetooth.startScan((devices) => console.log(devices), 5000);
 * ```
 * `onDevices` fires repeatedly with the accumulated device list as the scan finds more.
 */
export function startScan(
    onDevices: (devices: BleDevice[]) => void,
    timeoutMs: number,
    allowIbeacons?: boolean
): Promise<void> {
    try {
        return requireBluetoothHost('startScan').startScan(onDevices, timeoutMs, allowIbeacons);
    } catch (err) {
        return Promise.reject(err);
    }
}

export function stopScan(): Promise<void> {
    try {
        return requireBluetoothHost('stopScan').stopScan();
    } catch (err) {
        return Promise.reject(err);
    }
}

/** Subscribe to scan start/stop transitions. */
export function onScanningChange(handler: (scanning: boolean) => void): Promise<void> {
    try {
        return requireBluetoothHost('onScanningChange').onScanningChange(handler);
    } catch (err) {
        return Promise.reject(err);
    }
}

/**
 * ```js
 * await agapi.bluetooth.connect(device.address, () => console.log('disconnected'));
 * ```
 * One active connection at a time (matches upstream — `disconnect()` takes no address).
 */
export function connect(
    address: string,
    onDisconnect?: (() => void) | null,
    allowIbeacons?: boolean
): Promise<void> {
    try {
        return requireBluetoothHost('connect').connect(address, onDisconnect, allowIbeacons);
    } catch (err) {
        return Promise.reject(err);
    }
}

export function disconnect(): Promise<void> {
    try {
        return requireBluetoothHost('disconnect').disconnect();
    } catch (err) {
        return Promise.reject(err);
    }
}

/** Subscribe to connect/disconnect transitions on the current connection. */
export function onConnectionChange(handler: (connected: boolean) => void): Promise<void> {
    try {
        return requireBluetoothHost('onConnectionChange').onConnectionChange(handler);
    } catch (err) {
        return Promise.reject(err);
    }
}

/** List GATT services + characteristics of the connected device. */
export function listServices(address: string): Promise<BleService[]> {
    try {
        return requireBluetoothHost('listServices').listServices(address);
    } catch (err) {
        return Promise.reject(err);
    }
}

/** Negotiated MTU (bytes) of the current connection. */
export function getMtu(): Promise<number> {
    try {
        return requireBluetoothHost('getMtu').getMtu();
    } catch (err) {
        return Promise.reject(err);
    }
}

export function read(characteristic: string, service?: string): Promise<number[]> {
    try {
        return requireBluetoothHost('read').read(characteristic, service);
    } catch (err) {
        return Promise.reject(err);
    }
}

export function readString(characteristic: string, service?: string): Promise<string> {
    try {
        return requireBluetoothHost('readString').readString(characteristic, service);
    } catch (err) {
        return Promise.reject(err);
    }
}

export function send(
    characteristic: string,
    data: number[],
    writeType?: BleWriteType,
    service?: string
): Promise<void> {
    try {
        return requireBluetoothHost('send').send(characteristic, data, writeType, service);
    } catch (err) {
        return Promise.reject(err);
    }
}

export function sendString(
    characteristic: string,
    text: string,
    writeType?: BleWriteType,
    service?: string
): Promise<void> {
    try {
        return requireBluetoothHost('sendString').sendString(characteristic, text, writeType, service);
    } catch (err) {
        return Promise.reject(err);
    }
}

/** Notifications/indications on a characteristic — `handler` fires on every update. */
export function subscribe(
    characteristic: string,
    service: string | null,
    handler: (data: number[]) => void
): Promise<void> {
    try {
        return requireBluetoothHost('subscribe').subscribe(characteristic, service, handler);
    } catch (err) {
        return Promise.reject(err);
    }
}

export function subscribeString(
    characteristic: string,
    service: string | null,
    handler: (text: string) => void
): Promise<void> {
    try {
        return requireBluetoothHost('subscribeString').subscribeString(characteristic, service, handler);
    } catch (err) {
        return Promise.reject(err);
    }
}

export function unsubscribe(characteristic: string, service?: string): Promise<void> {
    try {
        return requireBluetoothHost('unsubscribe').unsubscribe(characteristic, service);
    } catch (err) {
        return Promise.reject(err);
    }
}

const bluetooth = {
    checkPermissions,
    getAdapterState,
    startScan,
    stopScan,
    onScanningChange,
    connect,
    disconnect,
    onConnectionChange,
    listServices,
    getMtu,
    read,
    readString,
    send,
    sendString,
    subscribe,
    subscribeString,
    unsubscribe,
};

export default bluetooth;
