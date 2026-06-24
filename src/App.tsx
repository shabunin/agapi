import React, { useState, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import { Application, Assets } from 'pixi.js';
import gsap from 'gsap';
import { Upload, AlertCircle, Maximize2, Minimize2, FolderOpen, RefreshCw, Terminal } from 'lucide-react';
import { parseGUI, CFProject } from './lib/parser';
import { CFRenderer } from './lib/renderer';
import { joinStore } from './lib/joinStore';
import { CFAPI } from './lib/cf';

// Disable createImageBitmap as it is notoriously buggy in WebKitGTK (Tauri Linux)
// causing WebGL textures to swap, corrupt, or bleed into each other.
Assets.setPreferences({
  preferCreateImageBitmap: false
});


export default function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectLoaded, setProjectLoaded] = useState(false);
  const [project, setProject] = useState<CFProject | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const appRef = useRef<Application | null>(null);
  const rendererRef = useRef<CFRenderer | null>(null);
  const blobUrlsRef = useRef<string[]>([]);
  const scriptElementsRef = useRef<HTMLScriptElement[]>([]);

  const revokeAllBlobUrls = () => {
    blobUrlsRef.current.forEach(url => {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        console.error("Failed to revoke blob URL", url, e);
      }
    });
    blobUrlsRef.current = [];

    // Remove injected project script elements from document.head and revoke their blob URLs
    scriptElementsRef.current.forEach(el => {
      try {
        if (el.parentNode) el.parentNode.removeChild(el);
        if (el.src?.startsWith('blob:')) URL.revokeObjectURL(el.src);
      } catch (e) {
        console.error("Failed to remove script element", el, e);
      }
    });
    scriptElementsRef.current = [];
  };

  const actionsRef = useRef({ handleNativeOpen: () => { }, toggleFullscreen: () => { } });

  useEffect(() => {
    let unmounted = false;
    let unlistenFn: (() => void) | undefined;
    import('@tauri-apps/api/event').then(api => {
      api.listen('menu-action', (event) => {
        const action = event.payload as string;
        switch (action) {
          case 'open_native':
            actionsRef.current.handleNativeOpen();
            break;
          case 'open_browser':
            fileInputRef.current?.click();
            break;
          case 'reload':
            window.location.reload();
            break;
          case 'devtools':
            import('@tauri-apps/api/core').then(core => {
              core.invoke('is_devtools_open').then(isOpen => {
                core.invoke('set_devtools', { open: !isOpen });
              });
            });
            break;
          case 'outline':
            setDebugMode(prev => !prev);
            break;
          case 'fullscreen':
            actionsRef.current.toggleFullscreen();
            break;
          case 'landscape':
            setOrientation('landscape');
            break;
          case 'portrait':
            setOrientation('portrait');
            break;
        }
      }).then(u => {
        if (unmounted) {
          u();
        } else {
          unlistenFn = u;
        }
      });
    });
    return () => {
      unmounted = true;
      if (unlistenFn) unlistenFn();
    };
  }, []);

  useEffect(() => {
    const disableContextMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', disableContextMenu);
    return () => document.removeEventListener('contextmenu', disableContextMenu);
  }, []);

  useEffect(() => {
    if (projectLoaded && project) {
      const o = orientation;
      const width = o === 'landscape' ? (project.properties.landscape?.width || 1024) : (project.properties.portrait?.width || 768);
      const height = o === 'landscape' ? (project.properties.landscape?.height || 768) : (project.properties.portrait?.height || 1024);
      console.log(`[AutoResize] Attempting to set window size to ${width}x${height} for ${o}`);
      import('@tauri-apps/api/core').then(core => {
        core.invoke('resize_window', { width: Number(width), height: Number(height) }).catch(console.error);
      });
    }
  }, [projectLoaded, project, orientation]);

  useEffect(() => {
    return () => {
      gsap.globalTimeline.clear();
      if (rendererRef.current) {
        rendererRef.current.destroy();
      } else if (appRef.current) {
        appRef.current.destroy({ removeView: false }, { children: true });
      }
      joinStore.clear();
      revokeAllBlobUrls();
    };
  }, []);

  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setDebugMode(debugMode);
    }
  }, [debugMode]);

  useEffect(() => {
    if (appRef.current && rendererRef.current && rendererRef.current.project) {
      const proj = rendererRef.current.project;
      const o = orientation;
      const width = o === 'landscape' ? (proj.properties.landscape?.width || 1024) : (proj.properties.portrait?.width || 768);
      const height = o === 'landscape' ? (proj.properties.landscape?.height || 768) : (proj.properties.portrait?.height || 1024);
      appRef.current.renderer.resize(width, height);
      if (rendererRef.current.currentPageName) {
        rendererRef.current.navigate(rendererRef.current.currentPageName, o);
      }
    }
  }, [orientation]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error("Error attempting to enable fullscreen:", err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const startProject = async (guiXml: string, imageMap: Record<string, string>, scriptMap: Record<string, string>) => {
    console.log("Parsing GUI");
    await new Promise(resolve => setTimeout(resolve, 50));
    const project = await parseGUI(guiXml);

    console.log("Clearing gsap");
    gsap.globalTimeline.clear();

    console.log("Checking existing renderer...");
    if (rendererRef.current) {
      // Do NOT destroy the app. Just remove children to avoid WebGL context loss.
      appRef.current?.stage.removeChildren();
      rendererRef.current = null;
    }
    joinStore.clear();

    const canvas = canvasRef.current;
    if (!canvas) throw new Error("Canvas reference missing");

    const width = orientation === 'landscape' ? (project.properties.landscape?.width || 1024) : (project.properties.portrait?.width || 768);
    const height = orientation === 'landscape' ? (project.properties.landscape?.height || 768) : (project.properties.portrait?.height || 1024);

    let app = appRef.current;
    if (!app) {
      app = new Application();
      await app.init({
        canvas,
        width,
        height,
        backgroundColor: 0x000000,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        antialias: true,
        preference: "webgl",
      });
      appRef.current = app;
    } else {
      app.renderer.resize(width, height);
    }

    const renderer = new CFRenderer(app, project, imageMap);
    renderer.targetOrientation = orientation;
    renderer.setDebugMode(debugMode);

    CFAPI.makeGlobal(renderer);
    const globalCF = (window as any).CF;
    renderer.cfApi = globalCF;
    renderer.onOrientationChange = (newO) => {
      setOrientation(newO);
    };
    globalCF.userMain = undefined;

    if (project.scripts) {
      for (const scriptNode of project.scripts) {
        if (scriptNode.name) {
          const targetName = scriptNode.name.toLowerCase().replace(/\\/g, '/');
          const targetLeaf = targetName.split('/').pop() || "";

          let scriptContent = "";
          for (const [key, content] of Object.entries(scriptMap)) {
            const normalizedKey = key.toLowerCase().replace(/\\/g, '/');
            if (
              normalizedKey === targetName ||
              normalizedKey.endsWith("/" + targetName) ||
              normalizedKey === targetLeaf ||
              normalizedKey.endsWith("/" + targetLeaf)
            ) {
              scriptContent = content;
              break;
            }
          }

          if (scriptContent) {
            try {
              const blobContent = `${scriptContent}\n//# sourceURL=cf-script://${scriptNode.name}`;
              const blob = new Blob([blobContent], { type: 'application/javascript' });
              const blobUrl = URL.createObjectURL(blob);
              const scriptElement = document.createElement('script');
              scriptElement.src = blobUrl;

              await new Promise((resolve) => {
                scriptElement.onload = resolve;
                scriptElement.onerror = resolve;
                document.head.appendChild(scriptElement);
              });

              // Track the element so revokeAllBlobUrls() can remove it on next load
              scriptElementsRef.current.push(scriptElement);
            } catch (e) {
              console.error(`Error executing project script ${scriptNode.name}:`, e);
            }
          }
        }
      }
    }

    rendererRef.current = renderer;
    await renderer.start();

    // Call module setup functions
    if (globalCF && Array.isArray(globalCF.modules)) {
      for (const mod of globalCF.modules) {
        if (typeof mod.setup === 'function') {
          try {
            mod.setup.call(mod.object || window);
          } catch (e) {
            console.error(`Error in module setup for ${mod.name}:`, e);
          }
        }
      }
    }

    const userMainFn = typeof globalCF.userMain === 'function'
      ? globalCF.userMain
      : typeof (window as any).userMain === 'function' ? (window as any).userMain : undefined;

    if (userMainFn) {
      try {
        userMainFn();
      } catch (e) {
        console.error("Error in CF.userMain:", e);
      }
    }

    // Now that scripts are loaded and userMain has executed (registering watchers),
    // we can safely start the external control systems.
    if (globalCF && typeof globalCF.startSystems === 'function') {
      globalCF.startSystems();
    }

    // Dispatch PreloadingCompleteEvent after userMain has run.
    // Use setTimeout(0) so watchers registered inside userMain() are in place before the event fires.

    setTimeout(() => {
      if (globalCF && typeof globalCF.dispatchEvent === 'function') {
        globalCF.dispatchEvent(globalCF.PreloadingCompleteEvent);
      }
    }, 0);

    console.log("Project loaded successfully!");
    setProject(project);
    setProjectLoaded(true);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setProject(null);
    revokeAllBlobUrls();

    try {
      const zip = await JSZip.loadAsync(file);
      let guiXml = "";
      const imageMap: Record<string, string> = {};
      const scriptMap: Record<string, string> = {};

      for (const [path, zipEntry] of Object.entries(zip.files)) {
        if (zipEntry.dir) continue;
        const filename = path.split('/').pop() || "";

        if (filename.toLowerCase().endsWith('.gui')) {
          guiXml = await zipEntry.async("string");
        } else if (/\.(png|jpe?g|gif|webp|svg)$/i.test(filename)) {
          const rawBlob = await zipEntry.async("blob");
          const ext = filename.split('.').pop()?.toLowerCase() || 'png';
          const mimeType = ext === 'jpg' ? 'image/jpeg' : (ext === 'svg' ? 'image/svg+xml' : `image/${ext}`);
          const blob = new Blob([rawBlob], { type: mimeType });
          const blobUrl = URL.createObjectURL(blob);
          imageMap[filename] = blobUrl;
          blobUrlsRef.current.push(blobUrl);
        } else if (filename.toLowerCase().endsWith('.js')) {
          scriptMap[path] = await zipEntry.async("string");
        }
      }

      if (!guiXml) throw new Error("No .gui file found in the zip archive.");
      await startProject(guiXml, imageMap, scriptMap);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
      setProject(null);
      setProjectLoaded(false);
    } finally {
      if (event.target) event.target.value = '';
      setLoading(false);
    }
  };

  const handleNativeOpen = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const { readTextFile, readFile, writeFile, mkdir, readDir } = await import('@tauri-apps/plugin-fs');
      const { dirname, join, tempDir } = await import('@tauri-apps/api/path');
      const { convertFileSrc } = await import('@tauri-apps/api/core');

      const selectedPath = await open({
        multiple: false,
        filters: [{ name: 'CF GUI Files', extensions: ['gui', 'zip'] }]
      });

      if (!selectedPath || typeof selectedPath !== 'string') return;

      setLoading(true);
      setError(null);
      setProject(null);
      revokeAllBlobUrls();

      let guiXml = "";
      const imageMap: Record<string, string> = {};
      const scriptMap: Record<string, string> = {};

      if (selectedPath.toLowerCase().endsWith('.zip')) {
        const fileData = await readFile(selectedPath);
        const zip = await JSZip.loadAsync(fileData);

        const tempDirPath = await tempDir();
        const extractPath = await join(tempDirPath, 'agapi_extracted');

        try { await mkdir(extractPath, { recursive: true }); } catch (e) { }

        for (const [path, zipEntry] of Object.entries(zip.files)) {
          if (zipEntry.dir) continue;
          const filename = path.split('/').pop() || "";

          if (filename.toLowerCase().endsWith('.gui')) {
            guiXml = await zipEntry.async("string");
          } else if (/\.(png|jpe?g|gif|webp|svg)$/i.test(filename)) {
            const buffer = await zipEntry.async("uint8array");
            const outPath = await join(extractPath, filename);
            await writeFile(outPath, buffer);
            imageMap[filename] = convertFileSrc(outPath);
          } else if (filename.toLowerCase().endsWith('.js')) {
            scriptMap[path] = await zipEntry.async("string");
          }
        }
      } else if (selectedPath.toLowerCase().endsWith('.gui')) {
        guiXml = await readTextFile(selectedPath);
        const dir = await dirname(selectedPath);
        const entries = await readDir(dir);

        for (const entry of entries) {
          if (!entry.isFile) continue;
          if (/\.(png|jpe?g|gif|webp|svg)$/i.test(entry.name)) {
            const filePath = await join(dir, entry.name);
            imageMap[entry.name] = convertFileSrc(filePath);
          } else if (entry.name.toLowerCase().endsWith('.js')) {
            scriptMap[entry.name] = await readTextFile(await join(dir, entry.name));
          }
        }
      }

      if (!guiXml) throw new Error("No .gui file found.");
      await startProject(guiXml, imageMap, scriptMap);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
      setProject(null);
      setProjectLoaded(false);
    } finally {
      setLoading(false);
    }
  };

  actionsRef.current = { handleNativeOpen, toggleFullscreen };

  const currentWidth = project
    ? (orientation === 'landscape' ? (project.properties.landscape?.width || 1024) : (project.properties.portrait?.width || 768))
    : 1024;
  const currentHeight = project
    ? (orientation === 'landscape' ? (project.properties.landscape?.height || 768) : (project.properties.portrait?.height || 1024))
    : 768;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <input type="file" accept=".zip" className="hidden" ref={fileInputRef} onChange={handleFileUpload} disabled={loading} />

      {/* Main Content */}
      <div className="flex-1 overflow-auto relative bg-black flex">
        {!projectLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10 p-4">
            <div className="bg-gray-800 p-6 md:p-8 rounded-2xl shadow-2xl max-w-md w-full border border-gray-700/50 backdrop-blur-sm">
              <h1 className="text-3xl font-bold mb-8 text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                agapi
              </h1>

              <div className="space-y-4 mb-8">
                <button
                  onClick={handleNativeOpen}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 bg-blue-600/90 hover:bg-blue-600 text-white py-3.5 px-4 rounded-xl transition-all font-medium active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 shadow-lg shadow-blue-500/20"
                >
                  <FolderOpen size={20} />
                  Open Project (native fs .gui/.gui.zip)
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 bg-purple-600/90 hover:bg-purple-600 text-white py-3.5 px-4 rounded-xl transition-all font-medium active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 shadow-lg shadow-purple-500/20"
                >
                  <Upload size={20} />
                  Open Project (jszip .gui.zip)
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">Settings</h3>
                  <label className="flex items-center gap-3 cursor-pointer group p-3 bg-gray-700/30 rounded-xl hover:bg-gray-700/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={debugMode}
                      onChange={(e) => setDebugMode(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-600 text-blue-500 focus:ring-blue-500 bg-gray-800"
                    />
                    <span className="text-gray-300 group-hover:text-white transition-colors font-medium">Show Outline</span>
                  </label>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">Orientation</h3>
                  <div className="flex gap-3">
                    <label className={`flex items-center justify-center gap-2 cursor-pointer flex-1 py-3 px-2 rounded-xl transition-colors border ${orientation === 'landscape' ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-gray-700/30 border-transparent text-gray-400 hover:bg-gray-700/50 hover:text-gray-300'}`}>
                      <input
                        type="radio"
                        name="orientation"
                        value="landscape"
                        checked={orientation === 'landscape'}
                        onChange={() => setOrientation('landscape')}
                        className="hidden"
                      />
                      <span className="font-medium text-sm">Landscape</span>
                    </label>
                    <label className={`flex items-center justify-center gap-2 cursor-pointer flex-1 py-3 px-2 rounded-xl transition-colors border ${orientation === 'portrait' ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-gray-700/30 border-transparent text-gray-400 hover:bg-gray-700/50 hover:text-gray-300'}`}>
                      <input
                        type="radio"
                        name="orientation"
                        value="portrait"
                        checked={orientation === 'portrait'}
                        onChange={() => setOrientation('portrait')}
                        className="hidden"
                      />
                      <span className="font-medium text-sm">Portrait</span>
                    </label>
                  </div>
                </div>
              </div>

              {loading && (
                <div className="mt-8 flex items-center justify-center gap-3 text-blue-400 p-4 bg-blue-500/10 rounded-xl border border-blue-500/20">
                  <RefreshCw className="animate-spin" size={20} />
                  <span className="font-medium">Loading project...</span>
                </div>
              )}
              {error && (
                <div className="mt-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400 text-sm">
                  <AlertCircle size={20} className="shrink-0 mt-0.5" />
                  <p className="font-medium leading-relaxed">{error}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* The Canvas wrapper */}
        <div
          ref={containerRef}
          className={`relative overflow-hidden transition-opacity duration-500 ${projectLoaded ? 'opacity-100 block' : 'opacity-0 hidden'}`}
          style={isFullscreen ? {
            width: '100vw',
            height: '100vh',
            maxWidth: '100vw',
            maxHeight: '100vh',
            background: '#000000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          } : {
            /* We can let it scale automatically to fit screen using max-width/max-height */
            maxWidth: '100%',
            maxHeight: '100%',
            aspectRatio: `${currentWidth} / ${currentHeight}`
          }}
        >
          <div
            style={isFullscreen ? {
              width: '100%',
              height: '100%',
              maxWidth: '100%',
              maxHeight: '100%',
              aspectRatio: `${currentWidth} / ${currentHeight}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            } : {
              width: '100%',
              height: '100%'
            }}
          >
            <canvas
              ref={canvasRef}
              className="w-full h-full object-contain bg-black"
            />
          </div>
        </div>
      </div>
    </div>
  );
}