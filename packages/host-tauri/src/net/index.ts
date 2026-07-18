import { TauriTcpSocket } from './socket';
import { TauriTcpServer } from './server';
import { TauriNetworkProvider } from './provider';
import { SocketAddress, isIP, isIPv4, isIPv6 } from '@agapi/stdlib/net';

// This is meant to be highly compatible with Node.js `net` and `dgram` modules.

class TauriNet {
    Socket = TauriTcpSocket;
    Server = TauriTcpServer;
    SocketAddress = SocketAddress;
    isIP = isIP;
    isIPv4 = isIPv4;
    isIPv6 = isIPv6;

    createConnection(port: number, host: string, connectionListener?: () => void): TauriTcpSocket;
    createConnection(options: any, connectionListener?: () => void): TauriTcpSocket;
    createConnection(path: string, connectionListener?: () => void): TauriTcpSocket;
    createConnection(portOrOptionsOrPath: any, hostOrCreateListener?: any, connectionListener?: () => void): TauriTcpSocket {
        const socket = new TauriTcpSocket();
        socket.connect(portOrOptionsOrPath, hostOrCreateListener, connectionListener);
        return socket;
    }

    connect(port: number, host: string, connectionListener?: () => void): TauriTcpSocket;
    connect(options: any, connectionListener?: () => void): TauriTcpSocket;
    connect(path: string, connectionListener?: () => void): TauriTcpSocket;
    connect(portOrOptionsOrPath: any, hostOrCreateListener?: any, connectionListener?: () => void): TauriTcpSocket {
        return this.createConnection(portOrOptionsOrPath, hostOrCreateListener, connectionListener);
    }

    createServer(connectionListener?: (socket: TauriTcpSocket) => void): TauriTcpServer;
    createServer(options?: any, connectionListener?: (socket: TauriTcpSocket) => void): TauriTcpServer;
    createServer(optionsOrCreateListener?: any, connectionListener?: (socket: TauriTcpSocket) => void): TauriTcpServer {
        let options = undefined;
        let listener = connectionListener;

        if (typeof optionsOrCreateListener === 'function') {
            listener = optionsOrCreateListener;
        } else if (typeof optionsOrCreateListener === 'object') {
            options = optionsOrCreateListener;
        }

        const server = new TauriTcpServer(options);
        if (listener) {
            server.on('connection', listener);
        }
        return server;
    }
}

export const net = new TauriNet();

import { TauriUdpSocket, TauriUdpSocketOptions, createSocket } from './udp';

export const dgram = {
    createSocket(
        typeOrOptions: 'udp4' | 'udp6' | TauriUdpSocketOptions,
        callback?: (msg: Uint8Array, rinfo: any) => void
    ): TauriUdpSocket {
        return createSocket(typeOrOptions, callback);
    }
};

export {
  TauriNetworkProvider,
  SocketAddress,
  TauriUdpSocket,
  TauriTcpSocket,
  TauriTcpServer,
  createSocket,
};

export { activeSockets, ensureGlobalSocketListener } from './socket';
export { activeServers, ensureGlobalServerListener } from './server';
export type { TauriUdpSocketOptions } from './udp';

