import { EventEmitter, ITcpSocket, isIPv6 } from '../net';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { NetEventPayload } from '../net';

export const activeSockets = new Map<string, TauriTcpSocket>();

let globalSocketListenerPromise: Promise<UnlistenFn> | null = null;

export function ensureGlobalSocketListener() {
    if (globalSocketListenerPromise) return;
    globalSocketListenerPromise = listen<NetEventPayload>('plugin:net:tcp', (event) => {
        const socket = activeSockets.get(event.payload.id);
        if (socket) {
            socket.handleNetEvent(event.payload);
        }
    });
}

interface TcpConnectResult {
    id: string;
    remote_address: string;
    remote_port: number;
    local_address: string;
    local_port: number;
    family: string;
}

export class TauriTcpSocket extends EventEmitter implements ITcpSocket {
    public destroyed: boolean = false;
    public connecting: boolean = false;
    public readyState: string = 'closed';

    public bytesRead: number = 0;
    public bytesWritten: number = 0;
    public bufferSize: number = 0;

    public localAddress?: string;
    public localPort?: number;
    public localFamily?: string;

    public remoteAddress?: string;
    public remotePort?: number;
    public remoteFamily?: string;

    public timeout?: number;

    private socketId: string | null = null;
    private encoding: string | null = null;
    private timeoutTimer: any = null;
    private isPaused: boolean = false;
    private pausedBuffer: Uint8Array[] = [];

    constructor(existingId?: string, options?: any) {
        super();
        if (options && options.encoding) {
            this.setEncoding(options.encoding);
        }
        if (existingId) {
            this.socketId = existingId;
            this.readyState = 'open';
            activeSockets.set(existingId, this);
            ensureGlobalSocketListener();
        }
    }

    get pending(): boolean {
        return this.connecting;
    }

    /** @internal */
    public handleNetEvent(payload: NetEventPayload) {
        switch (payload.event) {
            case 'data':
                if (payload.data) {
                    const chunk = new Uint8Array(payload.data);
                    this.bytesRead += chunk.length;
                    this.resetTimeoutTimer();

                    if (this.isPaused) {
                        this.pausedBuffer.push(chunk);
                    } else {
                        this.emitData(chunk);
                    }
                }
                break;
            case 'close':
                this.readyState = 'closed';
                this.emit('end');
                this.emit('close', false);
                this.cleanup();
                break;
            case 'error':
                this.readyState = 'closed';
                const err = new Error(payload.error || 'Unknown error');
                this.emit('error', err);
                this.emit('close', true);
                this.cleanup();
                break;
        }
    }

    private emitData(chunk: Uint8Array) {
        if (this.encoding) {
            const decoder = new TextDecoder(this.encoding);
            this.emit('data', decoder.decode(chunk));
        } else {
            this.emit('data', chunk);
        }
    }

    connect(port: number, host: string, connectionListener?: () => void): this;
    connect(options: any, connectionListener?: () => void): this;
    connect(path: string, connectionListener?: () => void): this;
    connect(portOrOptionsOrPath: any, hostOrCreateListener?: any, connectionListener?: () => void): this {
        if (this.socketId) throw new Error("Socket already connected");

        let port = 0;
        let host = '127.0.0.1';
        let listener = connectionListener;
        let keepAlive = false;
        let keepAliveDelay = 0;
        let noDelay = false;

        if (typeof portOrOptionsOrPath === 'number') {
            port = portOrOptionsOrPath;
            if (typeof hostOrCreateListener === 'string') {
                host = hostOrCreateListener;
            } else if (typeof hostOrCreateListener === 'function') {
                listener = hostOrCreateListener;
            }
        } else if (typeof portOrOptionsOrPath === 'object' && portOrOptionsOrPath !== null) {
            port = portOrOptionsOrPath.port || 0;
            host = portOrOptionsOrPath.host || '127.0.0.1';
            keepAlive = !!portOrOptionsOrPath.keepAlive;
            keepAliveDelay = portOrOptionsOrPath.keepAliveInitialDelay || 0;
            noDelay = !!portOrOptionsOrPath.noDelay;
            if (typeof hostOrCreateListener === 'function') {
                listener = hostOrCreateListener;
            }
        } else if (typeof portOrOptionsOrPath === 'string') {
            throw new Error("IPC / Unix Domain Sockets are not supported on Tauri");
        }

        this.connecting = true;
        this.readyState = 'opening';
        this.remoteAddress = host;
        this.remotePort = port;

        if (listener) {
            this.once('connect', listener);
        }

        invoke<TcpConnectResult>('tcp_connect', { host, port })
            .then(result => {
                this.socketId = result.id;
                this.remoteAddress = result.remote_address;
                this.remotePort = result.remote_port;
                this.remoteFamily = result.family;
                this.localAddress = result.local_address;
                this.localPort = result.local_port;
                this.localFamily = result.family;

                this.connecting = false;
                this.readyState = 'open';

                activeSockets.set(result.id, this);
                ensureGlobalSocketListener();

                if (keepAlive) {
                    this.setKeepAlive(true, keepAliveDelay);
                }
                if (noDelay) {
                    this.setNoDelay(true);
                }

                this.resetTimeoutTimer();

                this.emit('connect');
                this.emit('ready');
            })
            .catch(err => {
                this.connecting = false;
                this.readyState = 'closed';
                this.emit('error', new Error(String(err)));
                this.emit('close', true);
            });

        return this;
    }

    write(data: string | Uint8Array, encoding: string = 'utf8', callback?: () => void): boolean {
        if (this.destroyed || !this.socketId) return false;

        let payload: number[];
        if (typeof data === 'string') {
            const encoder = new TextEncoder();
            payload = Array.from(encoder.encode(data));
        } else {
            payload = Array.from(data);
        }

        this.bytesWritten += payload.length;
        this.resetTimeoutTimer();

        invoke('tcp_write', { id: this.socketId, data: payload })
            .then(() => {
                if (callback) callback();
            })
            .catch(err => {
                this.emit('error', new Error(String(err)));
            });

        return true;
    }

    end(data?: string | Uint8Array, encoding?: string, callback?: () => void): this {
        if (data) {
            this.write(data, encoding, callback);
        }
        this.destroy();
        return this;
    }

    destroy(err?: Error): this {
        if (this.destroyed) return this;
        this.destroyed = true;

        if (this.socketId) {
            invoke('tcp_destroy', { id: this.socketId }).catch(console.error);
        }

        if (err) this.emit('error', err);

        this.cleanup();
        this.emit('close', !!err);
        return this;
    }

    destroySoon(): this {
        return this.destroy();
    }

    resetAndDestroy(): this {
        return this.destroy();
    }

    setKeepAlive(enable: boolean = false, initialDelay: number = 0): this {
        if (this.destroyed || !this.socketId) return this;
        invoke('tcp_set_keep_alive', {
            id: this.socketId,
            enable,
            delay: initialDelay > 0 ? initialDelay : null
        }).catch(err => this.emit('error', new Error(String(err))));
        return this;
    }

    setNoDelay(noDelay: boolean = true): this {
        if (this.destroyed || !this.socketId) return this;
        invoke('tcp_set_no_delay', {
            id: this.socketId,
            noDelay
        }).catch(err => this.emit('error', new Error(String(err))));
        return this;
    }

    setTimeout(timeout: number, callback?: () => void): this {
        this.timeout = timeout;
        if (callback) {
            this.on('timeout', callback);
        }
        this.resetTimeoutTimer();
        return this;
    }

    private resetTimeoutTimer() {
        if (this.timeoutTimer) {
            clearTimeout(this.timeoutTimer);
            this.timeoutTimer = null;
        }

        if (this.timeout && this.timeout > 0 && !this.destroyed) {
            this.timeoutTimer = setTimeout(() => {
                this.emit('timeout');
            }, this.timeout);
        }
    }

    setEncoding(encoding: string): this {
        if (encoding === 'utf-8' || encoding === 'utf8') {
            this.encoding = 'utf-8';
        } else {
            this.encoding = encoding;
        }
        return this;
    }

    pause(): this {
        this.isPaused = true;
        return this;
    }

    resume(): this {
        if (!this.isPaused) return this;
        this.isPaused = false;
        const buffer = this.pausedBuffer;
        this.pausedBuffer = [];
        for (const chunk of buffer) {
            this.emitData(chunk);
        }
        return this;
    }

    address() {
        if (this.destroyed || this.readyState === 'closed') return null;
        return {
            port: this.localPort || 0,
            family: this.localFamily || 'IPv4',
            address: this.localAddress || '127.0.0.1'
        };
    }

    private cleanup() {
        if (this.socketId) {
            activeSockets.delete(this.socketId);
        }
        if (this.timeoutTimer) {
            clearTimeout(this.timeoutTimer);
            this.timeoutTimer = null;
        }
        this.socketId = null;
        this.destroyed = true;
        this.connecting = false;
        this.readyState = 'closed';
    }
}
