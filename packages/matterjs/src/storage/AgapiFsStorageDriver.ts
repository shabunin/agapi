import { fs } from '@agapi/stdlib';
import {
  fromJson,
  MemoryStorageDriver,
  Seconds,
  StorageDriver,
  StorageError,
  Time,
  toJson,
  type DataNamespace,
  type SupportedStorageTypes,
} from '@matter/general';

const STORAGE_DIR = 'matter';

/**
 * matter.js `StorageDriver` backed by `agapi.fs` (scoped app-data dir),
 * following the same "in-memory store + debounced write-through JSON file"
 * pattern as upstream's own Node reference (`JsonFileStorageDriver`) — just
 * swapping `node:fs` for `agapi.fs`, since matter.js has no browser/webview
 * filesystem driver of its own to build on.
 *
 * Not wrapped in matter.js's `Filesystem`/`Directory`/`DatafileRoot`
 * abstraction (`FilesystemStorageDriver`) — that needs a full `Filesystem`
 * service implementation we don't have. Extending the plain `StorageDriver`
 * base directly is enough for straightforward key/value persistence.
 */
export class AgapiFsStorageDriver extends StorageDriver {
  static readonly id = 'agapi-fs';

  static async create(namespace: DataNamespace) {
    const storage = new AgapiFsStorageDriver(namespace.namespace);
    try {
      await storage.initialize();
    } catch (error) {
      await storage.close().catch(() => {});
      throw error;
    }
    return storage;
  }

  /** Resolves once the most recent write-through has actually committed to disk. */
  committed = Promise.resolve();

  #store = new MemoryStorageDriver();
  #initialized = false;
  #closed = false;
  #resolveCommitted?: () => void;
  readonly #path: string;
  readonly #commitTimer = Time.getTimer('agapi-fs storage commit', Seconds(1), () => this.#commit());

  constructor(namespace: string) {
    super();
    this.#path = `${STORAGE_DIR}/${namespace}.json`;
  }

  override get initialized() {
    return this.#initialized;
  }

  override async initialize() {
    if (this.#initialized) throw new StorageError('Storage already initialized!');
    await fs.mkdir(STORAGE_DIR, { recursive: true });

    let data: Record<string, Record<string, SupportedStorageTypes>> = {};
    if (await fs.exists(this.#path)) {
      data = fromJson(await fs.readTextFile(this.#path)) as typeof data;
    }
    this.#store = new MemoryStorageDriver(data);
    this.#store.initialize();
    this.#initialized = true;
  }

  #triggerCommit() {
    if (!this.#commitTimer.isRunning) {
      this.committed = new Promise((resolve) => {
        this.#resolveCommitted = resolve;
      });
      this.#commitTimer.start();
    }
  }

  override get(contexts: string[], key: string) {
    return this.#store.get(contexts, key);
  }

  override set(contexts: string[], values: Record<string, SupportedStorageTypes>): void;
  override set(contexts: string[], key: string, value: SupportedStorageTypes): void;
  override set(contexts: string[], keyOrValues: string | Record<string, SupportedStorageTypes>, value?: SupportedStorageTypes) {
    this.#store.set(contexts, keyOrValues as string, value as SupportedStorageTypes);
    this.#triggerCommit();
  }

  override delete(contexts: string[], key: string) {
    this.#store.delete(contexts, key);
    this.#triggerCommit();
  }

  override keys(contexts: string[]) {
    return this.#store.keys(contexts);
  }

  override values(contexts: string[]) {
    return this.#store.values(contexts);
  }

  override contexts(contexts: string[]) {
    return this.#store.contexts(contexts);
  }

  override clearAll(contexts: string[]) {
    this.#store.clearAll(contexts);
    this.#triggerCommit();
  }

  async #commit() {
    if (!this.#initialized || this.#closed) return;
    if (this.#commitTimer.isRunning) this.#commitTimer.stop();
    try {
      await fs.writeFile(this.#path, toJson(this.#store.data, 1));
    } finally {
      this.#resolveCommitted?.();
    }
  }

  override async close() {
    this.#commitTimer.stop();
    await this.#commit();
    await this.#store.close();
    this.#closed = true;
  }
}
