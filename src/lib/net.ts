import { EVENTS } from './jsapi/constants';

export interface NetEventPayload {
    id: string;
    event: string;
    data: number[] | null;
    error: string | null;
    remote_address: string | null;
    remote_port: number | null;
    local_address?: string | null;
    local_port?: number | null;
    family?: string | null;
}

/**
 * IP address validation helper functions
 */
export function isIPv4(input: string): boolean {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipv4Regex.test(input);
}

export function isIPv6(input: string): boolean {
    const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
    return ipv6Regex.test(input);
}

export function isIP(input: string): number {
    if (isIPv4(input)) return 4;
    if (isIPv6(input)) return 6;
    return 0;
}

/**
 * Class: net.SocketAddress
 */
export class SocketAddress {
    readonly address: string;
    readonly family: 'ipv4' | 'ipv6';
    readonly flowlabel: number;
    readonly port: number;

    constructor(options: { address?: string; family?: 'ipv4' | 'ipv6'; flowlabel?: number; port?: number } = {}) {
        this.family = options.family === 'ipv6' ? 'ipv6' : 'ipv4';
        this.address = options.address || (this.family === 'ipv4' ? '127.0.0.1' : '::');
        this.flowlabel = options.flowlabel || 0;
        this.port = options.port || 0;
    }

    static parse(input: string): SocketAddress | undefined {
        if (typeof input !== 'string') return undefined;

        // Try IPv6 with port: [address]:port
        const ipv6WithPort = input.match(/^\[([a-fA-F0-9:.]+)\]:(\d+)$/);
        if (ipv6WithPort) {
            const address = ipv6WithPort[1];
            const port = parseInt(ipv6WithPort[2], 10);
            if (isIPv6(address) && port >= 0 && port <= 65535) {
                return new SocketAddress({ address, family: 'ipv6', port });
            }
            return undefined;
        }

        // Try IPv4 with port: address:port
        const ipv4WithPort = input.match(/^([\d.]+):(\d+)$/);
        if (ipv4WithPort) {
            const address = ipv4WithPort[1];
            const port = parseInt(ipv4WithPort[2], 10);
            if (isIPv4(address) && port >= 0 && port <= 65535) {
                return new SocketAddress({ address, family: 'ipv4', port });
            }
        }

        // Try plain IPv6
        if (isIPv6(input)) {
            return new SocketAddress({ address: input, family: 'ipv6', port: 0 });
        }

        // Try plain IPv4
        if (isIPv4(input)) {
            return new SocketAddress({ address: input, family: 'ipv4', port: 0 });
        }

        return undefined;
    }
}

/**
 * Базовый интерфейс для TCP сокета
 */
export interface ITcpSocket {
    connect(port: number, host: string, connectionListener?: () => void): this;
    connect(options: any, connectionListener?: () => void): this;
    connect(path: string, connectionListener?: () => void): this;
    
    write(data: string | Uint8Array, encoding?: string, callback?: () => void): boolean;
    end(data?: string | Uint8Array, encoding?: string, callback?: () => void): this;
    destroy(err?: Error): this;
    destroySoon(): this;
    resetAndDestroy(): this;
    
    setKeepAlive(enable?: boolean, initialDelay?: number): this;
    setNoDelay(noDelay?: boolean): this;
    setTimeout(timeout: number, callback?: () => void): this;
    setEncoding(encoding: string): this;
    
    pause(): this;
    resume(): this;
    address(): any;
    
    on(event: string, listener: (...args: any[]) => void): this;
    once(event: string, listener: (...args: any[]) => void): this;
    off(event: string, listener: (...args: any[]) => void): this;
    
    destroyed: boolean;
    connecting: boolean;
    pending: boolean;
    readyState: string;
    bytesRead: number;
    bytesWritten: number;
    bufferSize: number;
    localAddress?: string;
    localPort?: number;
    localFamily?: string;
    remoteAddress?: string;
    remotePort?: number;
    remoteFamily?: string;
    timeout?: number;
}

/**
 * Базовый интерфейс для UDP сокета (включая мультикаст)
 */
export interface IUdpSocket {
    bind(port?: number, address?: string, callback?: () => void): this;
    send(msg: string | Uint8Array, offset: number, length: number, port: number, address: string, callback?: (error: Error | null) => void): void;
    close(callback?: () => void): this;
    addMembership(multicastAddress: string, multicastInterface?: string): void;
    dropMembership(multicastAddress: string, multicastInterface?: string): void;
    setBroadcast(flag: boolean): void;
    
    on(event: string, listener: (...args: any[]) => void): this;
    once(event: string, listener: (...args: any[]) => void): this;
    off(event: string, listener: (...args: any[]) => void): this;
}

/**
 * Базовый интерфейс для TCP Сервера
 */
export interface ITcpServer {
    listen(port?: number, hostname?: string, backlog?: number, listeningListener?: () => void): this;
    listen(port?: number, hostname?: string, listeningListener?: () => void): this;
    listen(port?: number, listeningListener?: () => void): this;
    listen(path: string, backlog?: number, listeningListener?: () => void): this;
    listen(path: string, listeningListener?: () => void): this;
    listen(options: any, listeningListener?: () => void): this;
    listen(handle: any, backlog?: number, listeningListener?: () => void): this;
    listen(handle: any, listeningListener?: () => void): this;
    
    close(callback?: (err?: Error) => void): this;
    address(): any;
    getConnections(callback: (err: Error | null, count: number) => void): this;
    ref(): this;
    unref(): this;
    [Symbol.asyncDispose](): Promise<void>;
    closeAllConnections(): this;
    closeIdleConnections(): this;
    
    on(event: string, listener: (...args: any[]) => void): this;
    once(event: string, listener: (...args: any[]) => void): this;
    off(event: string, listener: (...args: any[]) => void): this;
    
    listening: boolean;
    maxConnections: number;
    dropMaxConnection: boolean;
}

/**
 * Провайдер сетевых возможностей (Адаптер для конкретной платформы)
 */
export interface INetworkProvider {
    name: string;
    createTcpSocket(): ITcpSocket;
    createUdpSocket(type?: 'udp4' | 'udp6' | any): IUdpSocket;
    createTcpServer(options?: any, connectionListener?: (socket: ITcpSocket) => void): ITcpServer;
    
    Socket: any;
    Server: any;
}

/**
 * A lightweight, browser-safe implementation of Node.js EventEmitter.
 */
export class EventEmitter {
    private listeners: Record<string, Function[]> = {};

    on(event: string, fn: Function): this {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(fn);
        return this;
    }

    once(event: string, fn: Function): this {
        const wrapper = (...args: any[]) => {
            this.off(event, wrapper);
            fn(...args);
        };
        return this.on(event, wrapper);
    }

    off(event: string, fn: Function): this {
        if (!this.listeners[event]) return this;
        this.listeners[event] = this.listeners[event].filter(l => l !== fn);
        return this;
    }

    emit(event: string, ...args: any[]): boolean {
        if (!this.listeners[event] || this.listeners[event].length === 0) return false;
        const currentListeners = this.listeners[event].slice();
        currentListeners.forEach(fn => {
            try {
                fn(...args);
            } catch (err) {
                console.error(`Error in Event [${event}] listener:`, err);
            }
        });
        return true;
    }

    removeAllListeners(event?: string): this {
        if (event) {
            delete this.listeners[event];
        } else {
            this.listeners = {};
        }
        return this;
    }
}

// ============================================================================
// MOCK PROVIDER (для работы в браузере где нет реальных сокетов)
// ============================================================================

export class MockTcpSocket extends EventEmitter implements ITcpSocket {
    public destroyed: boolean = false;
    public connecting: boolean = false;
    public pending: boolean = false;
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
    private mockInterval: any = null;

    connect(port: number, host: string, connectionListener?: () => void): this;
    connect(options: any, connectionListener?: () => void): this;
    connect(path: string, connectionListener?: () => void): this;
    connect(portOrOptionsOrPath: any, hostOrCreateListener?: any, connectionListener?: () => void): this {
        let port = 0;
        let host = '127.0.0.1';
        let listener = connectionListener;

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
            if (typeof hostOrCreateListener === 'function') {
                listener = hostOrCreateListener;
            }
        } else if (typeof portOrOptionsOrPath === 'string') {
            host = 'localhost';
            if (typeof hostOrCreateListener === 'function') {
                listener = hostOrCreateListener;
            }
        }

        this.connecting = true;
        this.pending = true;
        this.readyState = 'opening';
        this.remoteAddress = host;
        this.remotePort = port;
        this.remoteFamily = isIPv6(host) ? 'IPv6' : 'IPv4';
        
        if (listener) this.once('connect', listener);

        console.log(`[Mock TCP] Connecting to ${host}:${port}...`);
        
        setTimeout(() => {
            if (this.destroyed) return;
            this.connecting = false;
            this.pending = false;
            this.readyState = 'open';
            this.localAddress = '127.0.0.1';
            this.localPort = Math.floor(Math.random() * 50000) + 10000;
            this.localFamily = 'IPv4';

            this.emit('connect');
            this.emit('ready');
            
            this.mockInterval = setInterval(() => {
                if (this.destroyed) return;
                const chunk = new Uint8Array([0x01, 0x02, 0x03]);
                this.bytesRead += chunk.length;
                this.emit('data', chunk);
            }, 10000);
        }, 500);

        return this;
    }

    write(data: string | Uint8Array, encoding: string = 'utf8', callback?: () => void): boolean {
        if (this.destroyed) {
            this.emit('error', new Error('Socket is closed'));
            return false;
        }
        const len = typeof data === 'string' ? new TextEncoder().encode(data).length : data.length;
        this.bytesWritten += len;
        console.log(`[Mock TCP Write -> ${this.remoteAddress}:${this.remotePort}]`, data);
        if (callback) setTimeout(callback, 0);
        return true;
    }

    end(data?: string | Uint8Array, encoding?: string, callback?: () => void): this {
        if (data) this.write(data, encoding, callback);
        this.emit('end');
        this.destroy();
        return this;
    }

    destroy(err?: Error): this {
        if (this.destroyed) return this;
        this.destroyed = true;
        this.connecting = false;
        this.pending = false;
        this.readyState = 'closed';
        if (this.mockInterval) clearInterval(this.mockInterval);
        console.log(`[Mock TCP] Disconnected from ${this.remoteAddress}:${this.remotePort}`);
        if (err) this.emit('error', err);
        this.emit('close', !!err);
        return this;
    }

    destroySoon(): this {
        return this.destroy();
    }

    resetAndDestroy(): this {
        return this.destroy();
    }

    setKeepAlive(enable?: boolean, initialDelay?: number): this {
        console.log(`[Mock TCP] setKeepAlive: ${enable}, delay: ${initialDelay}`);
        return this;
    }

    setNoDelay(noDelay?: boolean): this {
        console.log(`[Mock TCP] setNoDelay: ${noDelay}`);
        return this;
    }

    setTimeout(timeout: number, callback?: () => void): this {
        console.log(`[Mock TCP] setTimeout: ${timeout}`);
        this.timeout = timeout;
        if (callback) this.on('timeout', callback);
        return this;
    }

    setEncoding(encoding: string): this {
        console.log(`[Mock TCP] setEncoding: ${encoding}`);
        return this;
    }

    pause(): this {
        console.log(`[Mock TCP] paused`);
        return this;
    }

    resume(): this {
        console.log(`[Mock TCP] resumed`);
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
}

export class MockTcpServer extends EventEmitter implements ITcpServer {
    public listening: boolean = false;
    public maxConnections: number = Infinity;
    public dropMaxConnection: boolean = false;
    private localPort?: number;
    private localAddress?: string;

    constructor(options?: any, connectionListener?: (socket: ITcpSocket) => void) {
        super();
        if (options) {
            this.maxConnections = options.maxConnections ?? Infinity;
            this.dropMaxConnection = !!options.dropMaxConnection;
        }
        if (connectionListener) {
            this.on('connection', connectionListener);
        }
    }

    listen(port?: number, hostname?: string, backlog?: number, listeningListener?: () => void): this;
    listen(port?: number, hostname?: string, listeningListener?: () => void): this;
    listen(port?: number, listeningListener?: () => void): this;
    listen(path: string, backlog?: number, listeningListener?: () => void): this;
    listen(path: string, listeningListener?: () => void): this;
    listen(options: any, listeningListener?: () => void): this;
    listen(handle: any, backlog?: number, listeningListener?: () => void): this;
    listen(handle: any, listeningListener?: () => void): this;
    listen(portOrOptionsOrPath?: any, hostOrListener?: any, backlogOrListener?: any, callback?: () => void): this {
        let port = 0;
        let host = '0.0.0.0';
        let listener = callback;

        if (typeof portOrOptionsOrPath === 'number') {
            port = portOrOptionsOrPath;
            if (typeof hostOrListener === 'string') {
                host = hostOrListener;
                if (typeof backlogOrListener === 'function') {
                    listener = backlogOrListener;
                }
            } else if (typeof hostOrListener === 'function') {
                listener = hostOrListener;
            }
        } else if (typeof portOrOptionsOrPath === 'object' && portOrOptionsOrPath !== null) {
            port = portOrOptionsOrPath.port || 0;
            host = portOrOptionsOrPath.host || '0.0.0.0';
            if (typeof hostOrListener === 'function') {
                listener = hostOrListener;
            }
        } else if (typeof portOrOptionsOrPath === 'function') {
            listener = portOrOptionsOrPath;
        }

        this.listening = true;
        this.localPort = port || Math.floor(Math.random() * 50000) + 10000;
        this.localAddress = host;

        if (listener) this.once('listening', listener);

        console.log(`[Mock TCP Server] Listening on ${host}:${this.localPort}`);
        setTimeout(() => {
            this.emit('listening');
        }, 10);

        return this;
    }

    close(callback?: (err?: Error) => void): this {
        if (!this.listening) {
            if (callback) setTimeout(() => callback(new Error("Server not listening")), 0);
            return this;
        }
        this.listening = false;
        console.log(`[Mock TCP Server] Closed`);
        this.emit('close');
        if (callback) setTimeout(() => callback(), 0);
        return this;
    }

    address() {
        if (!this.listening) return null;
        return {
            port: this.localPort || 0,
            family: isIPv6(this.localAddress || '') ? 'IPv6' : 'IPv4',
            address: this.localAddress || '0.0.0.0'
        };
    }

    getConnections(callback: (err: Error | null, count: number) => void): this {
        setTimeout(() => callback(null, 0), 0);
        return this;
    }

    ref(): this {
        return this;
    }

    unref(): this {
        return this;
    }

    async [Symbol.asyncDispose](): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.close((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    closeAllConnections(): this {
        console.log(`[Mock TCP Server] closeAllConnections`);
        return this;
    }

    closeIdleConnections(): this {
        console.log(`[Mock TCP Server] closeIdleConnections`);
        return this;
    }
}

class DefaultMockProvider implements INetworkProvider {
    name = "MockBrowserProvider";
    createTcpSocket() { return new MockTcpSocket(); }
    createUdpSocket() { return new MockUdpSocket(); }
    createTcpServer(options?: any, connectionListener?: (socket: ITcpSocket) => void) { 
        return new MockTcpServer(options, connectionListener); 
    }
    Socket = MockTcpSocket;
    Server = MockTcpServer;
}

export class MockUdpSocket extends EventEmitter implements IUdpSocket {
    bind(port?: number, address?: string, callback?: () => void): this {
        console.log(`[Mock UDP] Binding to ${address || '0.0.0.0'}:${port}`);
        if (callback) setTimeout(callback, 10);
        return this;
    }
    send(msg: string | Uint8Array, offset: number, length: number, port: number, address: string, callback?: (error: Error | null) => void): void {
        console.log(`[Mock UDP Send -> ${address}:${port}]`, msg);
        if (callback) setTimeout(() => callback(null), 0);
    }
    close(callback?: () => void): this {
        console.log(`[Mock UDP] Closed`);
        this.emit('close');
        if (callback) setTimeout(callback, 0);
        return this;
    }
    addMembership(multicastAddress: string, multicastInterface?: string): void {
        console.log(`[Mock UDP] Joined Multicast Group: ${multicastAddress}`);
    }
    dropMembership(multicastAddress: string, multicastInterface?: string): void {
        console.log(`[Mock UDP] Left Multicast Group: ${multicastAddress}`);
    }
    setBroadcast(flag: boolean): void {
        console.log(`[Mock UDP] setBroadcast: ${flag}`);
    }
}

// ============================================================================
// NETWORK MANAGER (Глобальная точка входа)
// ============================================================================

class NetworkManager {
    private provider: INetworkProvider = new DefaultMockProvider();

    // Node.js API Compatibility
    public Socket: any = MockTcpSocket;
    public Server: any = MockTcpServer;
    public SocketAddress = SocketAddress;
    public isIP = isIP;
    public isIPv4 = isIPv4;
    public isIPv6 = isIPv6;

    /**
     * Позволяет инжектить провайдер для текущей платформы при старте приложения
     */
    public setProvider(provider: INetworkProvider) {
        console.log(`[NetworkManager] Network provider changed to: ${provider.name}`);
        this.provider = provider;
        this.Socket = provider.Socket;
        this.Server = provider.Server;
    }

    public getProvider(): INetworkProvider {
        return this.provider;
    }

    public createConnection(port: number, host: string, connectionListener?: () => void): ITcpSocket;
    public createConnection(options: any, connectionListener?: () => void): ITcpSocket;
    public createConnection(path: string, connectionListener?: () => void): ITcpSocket;
    public createConnection(portOrOptionsOrPath: any, hostOrCreateListener?: any, connectionListener?: () => void): ITcpSocket {
        const socket = this.provider.createTcpSocket();
        socket.connect(portOrOptionsOrPath, hostOrCreateListener, connectionListener);
        return socket;
    }

    public connect(port: number, host: string, connectionListener?: () => void): ITcpSocket;
    public connect(options: any, connectionListener?: () => void): ITcpSocket;
    public connect(path: string, connectionListener?: () => void): ITcpSocket;
    public connect(portOrOptionsOrPath: any, hostOrCreateListener?: any, connectionListener?: () => void): ITcpSocket {
        return this.createConnection(portOrOptionsOrPath, hostOrCreateListener, connectionListener);
    }
    
    public createServer(connectionListener?: (socket: ITcpSocket) => void): ITcpServer;
    public createServer(options?: any, connectionListener?: (socket: ITcpSocket) => void): ITcpServer;
    public createServer(optionsOrCreateListener?: any, connectionListener?: (socket: ITcpSocket) => void): ITcpServer {
        let options = undefined;
        let listener = connectionListener;

        if (typeof optionsOrCreateListener === 'function') {
            listener = optionsOrCreateListener;
        } else if (typeof optionsOrCreateListener === 'object') {
            options = optionsOrCreateListener;
        }

        return this.provider.createTcpServer(options, listener);
    }
}

export const net = new NetworkManager();

export const dgram = {
    createSocket(
        typeOrOptions: 'udp4' | 'udp6' | any,
        callback?: (msg: Uint8Array, rinfo: any) => void
    ): IUdpSocket {
        const socket = net.getProvider().createUdpSocket(typeOrOptions);
        if (callback) {
            socket.on('message', callback as any);
        }
        return socket;
    }
};

export const Socket = MockTcpSocket;

export default net;
