/**
 * Shell-only helpers: load CF project assets from browser File or native path.
 * Runtime lives in @agapi/cf-runtime (loadProject) — not here.
 *
 * Scripts: only files listed in <scripts><script name="..."/> of the .gui
 * are loaded (paths may point into subfolders, e.g. scripts/foo.js).
 */
import JSZip from 'jszip';

export interface ProjectAssets {
  guiXml: string;
  imageMap: Record<string, string>;
  scriptMap: Record<string, string>;
  /** blob: URLs that the shell must revoke later */
  blobUrls: string[];
}

/** Parse <script name="..."> entries from gui XML (order preserved). */
export function extractScriptNamesFromGui(guiXml: string): string[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(guiXml, 'application/xml');
  const names: string[] = [];
  const nodes = doc.querySelectorAll('gui > scripts > script, scripts > script');
  nodes.forEach((el) => {
    const name = el.getAttribute('name')?.trim();
    if (name) names.push(name);
  });
  return names;
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\/+/, '');
}

/** Match a listed script name against a file path (zip entry or relative path). */
function pathMatchesScript(filePath: string, scriptName: string): boolean {
  const key = normalizePath(filePath).toLowerCase();
  const want = normalizePath(scriptName).toLowerCase();
  const leaf = want.split('/').pop() || want;
  return (
    key === want ||
    key.endsWith('/' + want) ||
    key === leaf ||
    key.endsWith('/' + leaf)
  );
}

/** Unpack a browser File (.gui.zip) via JSZip. */
export async function openProjectFromZipFile(file: File): Promise<ProjectAssets> {
  const zip = await JSZip.loadAsync(file);
  return unpackZip(zip);
}

async function unpackZip(
  zip: JSZip,
  imageHandler?: (filename: string, data: Uint8Array) => Promise<string> | string
): Promise<ProjectAssets> {
  let guiXml = '';
  const imageMap: Record<string, string> = {};
  const blobUrls: string[] = [];

  // First pass: gui + images only (not all .js)
  for (const [path, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir) continue;
    const filename = path.split(/[/\\]/).pop() || '';

    if (filename.toLowerCase().endsWith('.gui')) {
      guiXml = await zipEntry.async('string');
    } else if (/\.(png|jpe?g|gif|webp|svg)$/i.test(filename)) {
      if (imageHandler) {
        const buffer = await zipEntry.async('uint8array');
        imageMap[filename] = await imageHandler(filename, buffer);
      } else {
        const rawBlob = await zipEntry.async('blob');
        const ext = filename.split('.').pop()?.toLowerCase() || 'png';
        const mimeType =
          ext === 'jpg' ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
        const blob = new Blob([rawBlob as BlobPart], { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);
        imageMap[filename] = blobUrl;
        blobUrls.push(blobUrl);
      }
    }
  }

  if (!guiXml) throw new Error('No .gui file found in the zip archive.');

  const scriptMap = await loadScriptsFromZip(zip, extractScriptNamesFromGui(guiXml));
  return { guiXml, imageMap, scriptMap, blobUrls };
}

async function loadScriptsFromZip(
  zip: JSZip,
  scriptNames: string[]
): Promise<Record<string, string>> {
  const scriptMap: Record<string, string> = {};
  const entries = Object.entries(zip.files).filter(([, e]) => !e.dir);

  for (const name of scriptNames) {
    const hit = entries.find(([path]) => pathMatchesScript(path, name));
    if (!hit) {
      console.warn(`[openProject] script listed in .gui but not found in zip: ${name}`);
      continue;
    }
    const [, zipEntry] = hit;
    // Key by the name from .gui so loadProject matching is exact
    scriptMap[name] = await zipEntry.async('string');
  }

  return scriptMap;
}

/** Open .gui / .gui.zip via Tauri dialog + fs plugins. */
export async function openProjectNative(): Promise<ProjectAssets | null> {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const { readTextFile, readFile, writeFile, mkdir, readDir } = await import(
    '@tauri-apps/plugin-fs'
  );
  const { dirname, join, tempDir } = await import('@tauri-apps/api/path');
  const { convertFileSrc, invoke } = await import('@tauri-apps/api/core');

  const selectedPath = await open({
    multiple: false,
    filters: [{ name: 'CF GUI Files', extensions: ['gui', 'zip'] }],
  });

  if (!selectedPath || typeof selectedPath !== 'string') return null;

  // The fs plugin's static capability scope is app-dirs-only (see
  // capabilities/default.json); a user can pick a project from anywhere,
  // so grant runtime read access to just this path + its folder.
  await invoke('fs_allow_read_path', { path: selectedPath });

  if (selectedPath.toLowerCase().endsWith('.zip')) {
    const fileData = await readFile(selectedPath);
    const zip = await JSZip.loadAsync(fileData);
    const tempDirPath = await tempDir();
    const extractPath = await join(tempDirPath, 'agapi_extracted');
    try {
      await mkdir(extractPath, { recursive: true });
    } catch {
      /* exists */
    }

    return unpackZip(zip, async (filename, buffer) => {
      const outPath = await join(extractPath, filename);
      await writeFile(outPath, buffer);
      return convertFileSrc(outPath);
    });
  }

  if (selectedPath.toLowerCase().endsWith('.gui')) {
    const guiXml = await readTextFile(selectedPath);
    const dir = await dirname(selectedPath);
    const imageMap: Record<string, string> = {};

    // Images: still scan project root (and one level of common image folders is enough later)
    const entries = await readDir(dir);
    for (const entry of entries) {
      if (!entry.isFile) continue;
      if (/\.(png|jpe?g|gif|webp|svg)$/i.test(entry.name)) {
        imageMap[entry.name] = convertFileSrc(await join(dir, entry.name));
      }
    }

    const scriptNames = extractScriptNamesFromGui(guiXml);
    const scriptMap = await loadScriptsFromNativeDir(dir, scriptNames, {
      readTextFile,
      join,
    });

    if (!guiXml) throw new Error('No .gui file found.');
    return { guiXml, imageMap, scriptMap, blobUrls: [] };
  }

  throw new Error('Unsupported file type (expected .gui or .zip).');
}

/**
 * Load only script names from the .gui, resolving relative paths under projectDir
 * (e.g. "scripts/upnp_from0.js" → projectDir/scripts/upnp_from0.js).
 */
async function loadScriptsFromNativeDir(
  projectDir: string,
  scriptNames: string[],
  fs: {
    readTextFile: (path: string) => Promise<string>;
    join: (...parts: string[]) => Promise<string>;
  }
): Promise<Record<string, string>> {
  const scriptMap: Record<string, string> = {};

  for (const name of scriptNames) {
    const rel = normalizePath(name);
    // join each path segment so nested scripts/foo/bar.js works
    const segments = rel.split('/').filter(Boolean);
    let fullPath = projectDir;
    for (const seg of segments) {
      fullPath = await fs.join(fullPath, seg);
    }

    try {
      scriptMap[name] = await fs.readTextFile(fullPath);
    } catch (e) {
      // Fallback: try leaf name in project root (some projects list "foo.js" but file is nested)
      const leaf = segments[segments.length - 1];
      if (leaf && leaf !== rel) {
        try {
          const leafPath = await fs.join(projectDir, leaf);
          scriptMap[name] = await fs.readTextFile(leafPath);
          console.warn(
            `[openProject] script "${name}" not at relative path; loaded from root as "${leaf}"`
          );
          continue;
        } catch {
          /* fall through */
        }
      }
      console.warn(`[openProject] script listed in .gui but not found on disk: ${name}`, e);
    }
  }

  return scriptMap;
}

export function revokeBlobUrls(urls: string[]) {
  for (const url of urls) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }
}
