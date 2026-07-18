/**
 * Shell-only helpers: load CF project assets from browser File or native path.
 * Runtime lives in @agapi/cf-runtime (loadProject) — not here.
 */
import JSZip from 'jszip';

export interface ProjectAssets {
  guiXml: string;
  imageMap: Record<string, string>;
  scriptMap: Record<string, string>;
  /** blob: URLs that the shell must revoke later */
  blobUrls: string[];
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
  const scriptMap: Record<string, string> = {};
  const blobUrls: string[] = [];

  for (const [path, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir) continue;
    const filename = path.split('/').pop() || '';

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
    } else if (filename.toLowerCase().endsWith('.js')) {
      scriptMap[path] = await zipEntry.async('string');
    }
  }

  if (!guiXml) throw new Error('No .gui file found in the zip archive.');
  return { guiXml, imageMap, scriptMap, blobUrls };
}

/** Open .gui / .gui.zip via Tauri dialog + fs plugins. */
export async function openProjectNative(): Promise<ProjectAssets | null> {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const { readTextFile, readFile, writeFile, mkdir, readDir } = await import(
    '@tauri-apps/plugin-fs'
  );
  const { dirname, join, tempDir } = await import('@tauri-apps/api/path');
  const { convertFileSrc } = await import('@tauri-apps/api/core');

  const selectedPath = await open({
    multiple: false,
    filters: [{ name: 'CF GUI Files', extensions: ['gui', 'zip'] }],
  });

  if (!selectedPath || typeof selectedPath !== 'string') return null;

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
    const entries = await readDir(dir);
    const imageMap: Record<string, string> = {};
    const scriptMap: Record<string, string> = {};

    for (const entry of entries) {
      if (!entry.isFile) continue;
      if (/\.(png|jpe?g|gif|webp|svg)$/i.test(entry.name)) {
        imageMap[entry.name] = convertFileSrc(await join(dir, entry.name));
      } else if (entry.name.toLowerCase().endsWith('.js')) {
        scriptMap[entry.name] = await readTextFile(await join(dir, entry.name));
      }
    }

    if (!guiXml) throw new Error('No .gui file found.');
    return { guiXml, imageMap, scriptMap, blobUrls: [] };
  }

  throw new Error('Unsupported file type (expected .gui or .zip).');
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
