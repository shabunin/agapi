/**
 * Compatibility shim — Tauri HTTP backend lives in @agapi/host-tauri/http.
 * Prefer: installStdlib(createTauriHost()) then import http from '@agapi/stdlib/http'
 * or use window.http in CF scripts.
 */
export {
  createServer,
  request,
  get,
  Server,
  IncomingMessage,
  ServerResponse,
  ClientRequest,
  WebSocketServer,
  WebSocketConnection,
} from '@agapi/host-tauri/http';

export type { HttpRequestEvent, HttpResponsePayload, RequestOptions } from '@agapi/host-tauri/http';

import * as http from '@agapi/host-tauri/http';
export default http;
