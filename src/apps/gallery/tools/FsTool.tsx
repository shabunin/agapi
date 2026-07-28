import React, { useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { fs, type FsBaseDir } from '@agapi/stdlib';
import { ToolShell } from '../components/ToolShell';
import { examplesFor } from '../examples';

const BASE_DIRS: FsBaseDir[] = ['appData', 'appConfig', 'appLocalData', 'appCache', 'appLog', 'temp'];

export default function FsTool({ onBack }: { onBack: () => void }) {
  const [baseDir, setBaseDir] = useState<FsBaseDir>('appData');
  const [path, setPath] = useState('agapi-gallery/notes.txt');
  const [content, setContent] = useState('hello from the gallery\n');
  const [log, setLog] = useState<string[]>([]);

  const pushLog = (line: string) => {
    setLog((prev) => [...prev.slice(-80), `${new Date().toLocaleTimeString('en-GB')}  ${line}`]);
  };

  const run = (label: string, action: () => Promise<unknown>) => {
    action()
      .then((result) => pushLog(`${label} → ${result === undefined ? 'ok' : JSON.stringify(result)}`))
      .catch((e) => pushLog(`${label} → err: ${e?.message || e}`));
  };

  const dir = () => path.split('/').slice(0, -1).join('/') || '.';

  return (
    <ToolShell
      title="Filesystem"
      surface="agapi.fs"
      status="lab"
      onBack={onBack}
      examples={examplesFor('fs')}
    >
      <div className="p-4 max-w-lg mx-auto space-y-4">
        <div className="flex flex-wrap gap-2">
          <select
            className="rounded-lg bg-gray-900 border border-gray-800 px-2 py-1.5 text-sm font-mono"
            value={baseDir}
            onChange={(e) => setBaseDir(e.target.value as FsBaseDir)}
          >
            {BASE_DIRS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <input
            className="flex-1 min-w-[12rem] rounded-lg bg-gray-900 border border-gray-800 px-3 py-2 text-sm font-mono"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="relative/path.txt"
          />
        </div>

        <label className="block text-xs text-gray-500">
          Content (for write / append)
          <textarea
            className="mt-1 w-full h-20 rounded-lg bg-gray-900 border border-gray-800 px-3 py-2 text-sm font-mono"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => run('mkdir', () => fs.mkdir(dir(), { baseDir, recursive: true }))}
            className="px-3 py-1.5 rounded-lg border border-gray-700 text-sm hover:bg-gray-800"
          >
            mkdir (dir)
          </button>
          <button
            type="button"
            onClick={() => run('writeFile', () => fs.writeFile(path, content, { baseDir }))}
            className="px-3 py-1.5 rounded-lg bg-teal-600/90 hover:bg-teal-600 text-sm font-medium"
          >
            Write
          </button>
          <button
            type="button"
            onClick={() => run('appendFile', () => fs.appendFile(path, content, { baseDir }))}
            className="px-3 py-1.5 rounded-lg bg-teal-600/90 hover:bg-teal-600 text-sm font-medium"
          >
            Append
          </button>
          <button
            type="button"
            onClick={() => run('readTextFile', () => fs.readTextFile(path, { baseDir }))}
            className="px-3 py-1.5 rounded-lg border border-gray-700 text-sm hover:bg-gray-800"
          >
            Read
          </button>
          <button
            type="button"
            onClick={() =>
              run('readdir', async () =>
                (await fs.readdir(dir(), { baseDir })).map((e) => e.name)
              )
            }
            className="px-3 py-1.5 rounded-lg border border-gray-700 text-sm hover:bg-gray-800"
          >
            <FolderOpen size={14} className="inline mr-1 -mt-0.5" /> readdir (dir)
          </button>
          <button
            type="button"
            onClick={() => run('exists', () => fs.exists(path, { baseDir }))}
            className="px-3 py-1.5 rounded-lg border border-gray-700 text-sm hover:bg-gray-800"
          >
            exists
          </button>
          <button
            type="button"
            onClick={() =>
              run('stat', async () => {
                const info = await fs.stat(path, { baseDir });
                return { size: info.size, isFile: info.isFile, isDirectory: info.isDirectory };
              })
            }
            className="px-3 py-1.5 rounded-lg border border-gray-700 text-sm hover:bg-gray-800"
          >
            stat
          </button>
          <button
            type="button"
            onClick={() => run('remove', () => fs.remove(path, { baseDir }))}
            className="px-3 py-1.5 rounded-lg border border-red-500/30 text-red-300 text-sm hover:bg-red-500/10"
          >
            Remove
          </button>
        </div>

        <pre className="rounded-xl border border-gray-800 bg-black/40 p-3 text-[11px] font-mono text-gray-400 max-h-56 overflow-auto whitespace-pre-wrap">
          {log.length ? log.join('\n') : '— log —'}
        </pre>

        <p className="text-xs text-gray-600">
          Needs Tauri. Scoped to app data/config/cache/log dirs + temp — not the whole disk
          (see capabilities/default.json's <code className="text-gray-500">fs:allow-app-*-recursive</code>).
          "mkdir (dir)"/"readdir (dir)" operate on the path's parent folder.
        </p>
      </div>
    </ToolShell>
  );
}
