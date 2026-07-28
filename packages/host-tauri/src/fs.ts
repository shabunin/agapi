import {
    readFile as pluginReadFile,
    readTextFile as pluginReadTextFile,
    writeFile as pluginWriteFile,
    writeTextFile as pluginWriteTextFile,
    mkdir as pluginMkdir,
    readDir as pluginReadDir,
    stat as pluginStat,
    remove as pluginRemove,
    exists as pluginExists,
    BaseDirectory,
} from '@tauri-apps/plugin-fs';
import type {
    FsBaseDir,
    FsBaseDirOptions,
    FsDirEntry,
    FsFileInfo,
    FsHost,
    FsMkdirOptions,
    FsReadOptions,
    FsRemoveOptions,
    FsWriteOptions,
} from '@agapi/stdlib/host';
import { mapHostError } from '@agapi/stdlib/errors';

const BASE_DIR_MAP: Record<FsBaseDir, BaseDirectory> = {
    appData: BaseDirectory.AppData,
    appConfig: BaseDirectory.AppConfig,
    appLocalData: BaseDirectory.AppLocalData,
    appCache: BaseDirectory.AppCache,
    appLog: BaseDirectory.AppLog,
    temp: BaseDirectory.Temp,
};

function resolveBaseDir(baseDir?: FsBaseDir): BaseDirectory {
    return BASE_DIR_MAP[baseDir ?? 'appData'];
}

export class TauriFsHost implements FsHost {
    name = 'TauriFsHost';

    async readFile(path: string, options?: FsBaseDirOptions): Promise<Uint8Array> {
        try {
            return await pluginReadFile(path, { baseDir: resolveBaseDir(options?.baseDir) });
        } catch (err) {
            throw mapHostError(err, { syscall: 'readFile' });
        }
    }

    async readTextFile(path: string, options?: FsReadOptions): Promise<string> {
        try {
            return await pluginReadTextFile(path, {
                baseDir: resolveBaseDir(options?.baseDir),
                encoding: options?.encoding,
            });
        } catch (err) {
            throw mapHostError(err, { syscall: 'readTextFile' });
        }
    }

    async writeFile(
        path: string,
        data: Uint8Array | string,
        options?: FsWriteOptions
    ): Promise<void> {
        try {
            const baseDir = resolveBaseDir(options?.baseDir);
            if (typeof data === 'string') {
                await pluginWriteTextFile(path, data, { baseDir });
            } else {
                await pluginWriteFile(path, data, { baseDir });
            }
        } catch (err) {
            throw mapHostError(err, { syscall: 'writeFile' });
        }
    }

    async appendFile(
        path: string,
        data: Uint8Array | string,
        options?: FsWriteOptions
    ): Promise<void> {
        try {
            const baseDir = resolveBaseDir(options?.baseDir);
            if (typeof data === 'string') {
                await pluginWriteTextFile(path, data, { baseDir, append: true });
            } else {
                await pluginWriteFile(path, data, { baseDir, append: true });
            }
        } catch (err) {
            throw mapHostError(err, { syscall: 'appendFile' });
        }
    }

    async mkdir(path: string, options?: FsMkdirOptions): Promise<void> {
        try {
            await pluginMkdir(path, {
                baseDir: resolveBaseDir(options?.baseDir),
                recursive: options?.recursive,
            });
        } catch (err) {
            throw mapHostError(err, { syscall: 'mkdir' });
        }
    }

    async readdir(path: string, options?: FsBaseDirOptions): Promise<FsDirEntry[]> {
        try {
            const entries = await pluginReadDir(path, { baseDir: resolveBaseDir(options?.baseDir) });
            return entries.map((e) => ({
                name: e.name,
                isDirectory: e.isDirectory,
                isFile: e.isFile,
                isSymlink: e.isSymlink,
            }));
        } catch (err) {
            throw mapHostError(err, { syscall: 'readdir' });
        }
    }

    async stat(path: string, options?: FsBaseDirOptions): Promise<FsFileInfo> {
        try {
            const info = await pluginStat(path, { baseDir: resolveBaseDir(options?.baseDir) });
            return {
                isFile: info.isFile,
                isDirectory: info.isDirectory,
                isSymlink: info.isSymlink,
                size: info.size,
                mtime: info.mtime,
                atime: info.atime,
                birthtime: info.birthtime,
                readonly: info.readonly,
            };
        } catch (err) {
            throw mapHostError(err, { syscall: 'stat' });
        }
    }

    async remove(path: string, options?: FsRemoveOptions): Promise<void> {
        try {
            await pluginRemove(path, {
                baseDir: resolveBaseDir(options?.baseDir),
                recursive: options?.recursive,
            });
        } catch (err) {
            throw mapHostError(err, { syscall: 'remove' });
        }
    }

    async exists(path: string, options?: FsBaseDirOptions): Promise<boolean> {
        try {
            return await pluginExists(path, { baseDir: resolveBaseDir(options?.baseDir) });
        } catch (err) {
            throw mapHostError(err, { syscall: 'exists' });
        }
    }
}

export function createFsHost(): FsHost {
    return new TauriFsHost();
}
