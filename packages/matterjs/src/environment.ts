import './polyfills.js';
import { Environment, MemoryStorageDriver, Network, StorageService } from '@matter/general';
import { AgapiNetwork } from './net/AgapiNetwork.js';
import { AgapiFsStorageDriver } from './storage/AgapiFsStorageDriver.js';

/**
 * matter.js `Environment` wired to agapi/Tauri instead of Node.js.
 *
 * Crypto and Time need **no adapter**: matter.js's own `StandardCrypto` (Web
 * Crypto + a bundled pure-JS AES-CCM — Web Crypto alone doesn't cover AES-CCM)
 * and `StandardTime` (setTimeout/setInterval/MessageChannel) self-install as
 * long as the webview exposes `crypto.subtle`, which every Tauri target does.
 * See vendor/matter.js/packages/general/src/crypto/StandardCrypto.ts and
 * time/StandardTime.ts.
 *
 * Storage: unlike Crypto/Time it has no auto-install — `StorageService.open()`
 * throws "no drivers are registered" unless something registers at least
 * one. Both `AgapiFsStorageDriver` (JSON file under agapi.fs's app-data dir —
 * fabric/commissioned nodes survive a restart) and matter.js's own
 * `MemoryStorageDriver` (session-only) are registered; `persistent` (default
 * true) picks which one is the *default* driver actually used.
 *
 * BLE is out of scope (see docs/STDLIB_ROADMAP.md C9 — no official Tauri
 * plugin) — this only supports "on-network" (already-IP-connected)
 * commissioning, not BLE-first pairing.
 *
 * Uses `Environment.default` itself rather than a fresh child Environment —
 * matching the proven-working pattern in matter.js's own nodejs-shell
 * reference (`MatterNode.ts`: `this.#environment = Environment.default`).
 * Node.js's own bootstrap (`@matter/nodejs`'s register.ts) actually replaces
 * `Environment.default` wholesale with its configured environment; some
 * internal singletons (e.g. the mDNS service) look up `Network` via
 * `Environment.default` directly rather than through whatever Environment a
 * ServerNode was constructed with, so a Network registered only on a
 * separate child Environment isn't visible to them — hence "Required
 * dependency Network is not available" even though the controller's own
 * environment chain had it set.
 */
export interface AgapiMatterEnvironmentOptions {
  /** Persist fabric/commissioned-node state to agapi.fs. Default true. */
  persistent?: boolean;
}

export function createAgapiMatterEnvironment(options: AgapiMatterEnvironmentOptions = {}): Environment {
  const { persistent = true } = options;
  const env = Environment.default;

  if (!env.has(Network)) {
    env.set(Network, new AgapiNetwork());
  }

  const storage = env.get(StorageService);
  if (!storage.isConfigured) {
    storage.registerDriver(MemoryStorageDriver);
    storage.registerDriver(AgapiFsStorageDriver);
  }
  // Re-applied even if already configured, so a later call with a different
  // `persistent` value (e.g. restarting the controller) still takes effect —
  // the built-in default ('wal') needs a Filesystem we don't provide, so
  // always pick one of these two explicitly rather than leaving it unset.
  storage.defaultDriver = persistent ? AgapiFsStorageDriver.id : MemoryStorageDriver.id;

  return env;
}
