import { getHost } from '../host';
import type {
    FsBaseDirOptions,
    FsDirEntry,
    FsFileInfo,
    FsHost,
    FsMkdirOptions,
    FsReadOptions,
    FsRemoveOptions,
    FsWriteOptions,
} from '../host';
import { mapHostError } from '../errors';

export type { FsBaseDir, FsDirEntry, FsFileInfo } from '../host';

const NO_HOST_MESSAGE =
    '@agapi/stdlib/fs: no FsHost installed. Call installStdlib(createTauriHost()) in Tauri app bootstrap.';

async function requireFsHost(syscall: string): Promise<FsHost> {
    const host = getHost();
    if (!host?.fs) {
        throw mapHostError(NO_HOST_MESSAGE, { syscall });
    }
    return host.fs;
}

/**
 * Scoped filesystem subset (T3) — app data/config/cache/log dirs + temp,
 * not a full-disk `fs`. `baseDir` defaults to `'appData'` on every call.
 *
 * ```js
 * await agapi.fs.mkdir('logs', { recursive: true });
 * await agapi.fs.writeFile('logs/run.txt', 'started\n');
 * await agapi.fs.appendFile('logs/run.txt', 'still running\n');
 * const text = await agapi.fs.readTextFile('logs/run.txt');
 * for (const entry of await agapi.fs.readdir('logs')) console.log(entry.name);
 * ```
 */
export async function readFile(path: string, options?: FsBaseDirOptions): Promise<Uint8Array> {
    const host = await requireFsHost('readFile');
    return host.readFile(path, options).catch((err) => {
        throw mapHostError(err, { syscall: 'readFile' });
    });
}

export async function readTextFile(path: string, options?: FsReadOptions): Promise<string> {
    const host = await requireFsHost('readTextFile');
    return host.readTextFile(path, options).catch((err) => {
        throw mapHostError(err, { syscall: 'readTextFile' });
    });
}

export async function writeFile(
    path: string,
    data: Uint8Array | string,
    options?: FsWriteOptions
): Promise<void> {
    const host = await requireFsHost('writeFile');
    return host.writeFile(path, data, options).catch((err) => {
        throw mapHostError(err, { syscall: 'writeFile' });
    });
}

export async function appendFile(
    path: string,
    data: Uint8Array | string,
    options?: FsWriteOptions
): Promise<void> {
    const host = await requireFsHost('appendFile');
    return host.appendFile(path, data, options).catch((err) => {
        throw mapHostError(err, { syscall: 'appendFile' });
    });
}

export async function mkdir(path: string, options?: FsMkdirOptions): Promise<void> {
    const host = await requireFsHost('mkdir');
    return host.mkdir(path, options).catch((err) => {
        throw mapHostError(err, { syscall: 'mkdir' });
    });
}

export async function readdir(path: string, options?: FsBaseDirOptions): Promise<FsDirEntry[]> {
    const host = await requireFsHost('readdir');
    return host.readdir(path, options).catch((err) => {
        throw mapHostError(err, { syscall: 'readdir' });
    });
}

export async function stat(path: string, options?: FsBaseDirOptions): Promise<FsFileInfo> {
    const host = await requireFsHost('stat');
    return host.stat(path, options).catch((err) => {
        throw mapHostError(err, { syscall: 'stat' });
    });
}

export async function remove(path: string, options?: FsRemoveOptions): Promise<void> {
    const host = await requireFsHost('remove');
    return host.remove(path, options).catch((err) => {
        throw mapHostError(err, { syscall: 'remove' });
    });
}

export async function exists(path: string, options?: FsBaseDirOptions): Promise<boolean> {
    const host = await requireFsHost('exists');
    return host.exists(path, options).catch((err) => {
        throw mapHostError(err, { syscall: 'exists' });
    });
}

const fs = {
    readFile,
    readTextFile,
    writeFile,
    appendFile,
    mkdir,
    readdir,
    stat,
    remove,
    exists,
};

export default fs;
