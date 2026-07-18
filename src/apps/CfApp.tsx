import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Application, Assets } from 'pixi.js';
import gsap from 'gsap';
import { Upload, AlertCircle, FolderOpen, RefreshCw } from 'lucide-react';
import {
  loadProject,
  joinStore,
  type CFProject,
  type CFRenderer,
} from '@agapi/cf-runtime';
import {
  openProjectFromZipFile,
  openProjectNative,
  revokeBlobUrls,
  type ProjectAssets,
} from './cf/openProject';

// WebKitGTK (Tauri Linux): createImageBitmap corrupts WebGL textures
Assets.setPreferences({ preferCreateImageBitmap: false });

export interface CfAppProps {
  onBack?: () => void;
}

/**
 * Thin CF shell: open assets → loadProject(@agapi/cf-runtime) → canvas.
 * No parser/renderer/CF API here — that lives in the package.
 */
export default function CfApp({ onBack }: CfAppProps) {
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

  const cleanupAssets = useCallback(() => {
    revokeBlobUrls(blobUrlsRef.current);
    blobUrlsRef.current = [];
    scriptElementsRef.current.forEach((el) => {
      try {
        el.parentNode?.removeChild(el);
        if (el.src?.startsWith('blob:')) URL.revokeObjectURL(el.src);
      } catch {
        /* ignore */
      }
    });
    scriptElementsRef.current = [];
  }, []);

  const actionsRef = useRef({ handleNativeOpen: () => {}, toggleFullscreen: () => {} });

  useEffect(() => {
    let unmounted = false;
    let unlistenFn: (() => void) | undefined;
    import('@tauri-apps/api/event').then((api) => {
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
            import('@tauri-apps/api/core').then((core) => {
              core.invoke('is_devtools_open').then((isOpen) => {
                core.invoke('set_devtools', { open: !isOpen });
              });
            });
            break;
          case 'outline':
            setDebugMode((prev) => !prev);
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
      }).then((u) => {
        if (unmounted) u();
        else unlistenFn = u;
      });
    });
    return () => {
      unmounted = true;
      unlistenFn?.();
    };
  }, []);

  useEffect(() => {
    const disableContextMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', disableContextMenu);
    return () => document.removeEventListener('contextmenu', disableContextMenu);
  }, []);

  useEffect(() => {
    if (!projectLoaded || !project) return;
    const o = orientation;
    const width =
      o === 'landscape'
        ? project.properties.landscape?.width || 1024
        : project.properties.portrait?.width || 768;
    const height =
      o === 'landscape'
        ? project.properties.landscape?.height || 768
        : project.properties.portrait?.height || 1024;
    import('@tauri-apps/api/core').then((core) => {
      core
        .invoke('resize_window', { width: Number(width), height: Number(height) })
        .catch(console.error);
    });
  }, [projectLoaded, project, orientation]);

  useEffect(() => {
    return () => {
      gsap.globalTimeline.clear();
      if (rendererRef.current) rendererRef.current.destroy();
      else if (appRef.current) {
        appRef.current.destroy({ removeView: false }, { children: true });
      }
      joinStore.clear();
      cleanupAssets();
    };
  }, [cleanupAssets]);

  useEffect(() => {
    rendererRef.current?.setDebugMode(debugMode);
  }, [debugMode]);

  useEffect(() => {
    if (!appRef.current || !rendererRef.current?.project) return;
    const proj = rendererRef.current.project;
    const o = orientation;
    const width =
      o === 'landscape'
        ? proj.properties.landscape?.width || 1024
        : proj.properties.portrait?.width || 768;
    const height =
      o === 'landscape'
        ? proj.properties.landscape?.height || 768
        : proj.properties.portrait?.height || 1024;
    appRef.current.renderer.resize(width, height);
    if (rendererRef.current.currentPageName) {
      rendererRef.current.navigate(rendererRef.current.currentPageName, o);
    }
  }, [orientation]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen();
    }
  };

  const boot = async (assets: ProjectAssets) => {
    const canvas = canvasRef.current;
    if (!canvas) throw new Error('Canvas reference missing');

    blobUrlsRef.current.push(...assets.blobUrls);
    await new Promise((r) => setTimeout(r, 50));

    const result = await loadProject({
      guiXml: assets.guiXml,
      imageMap: assets.imageMap,
      scriptMap: assets.scriptMap,
      canvas,
      app: appRef.current,
      orientation,
      debugMode,
      previousRenderer: rendererRef.current,
      onOrientationChange: setOrientation,
    });

    appRef.current = result.app;
    rendererRef.current = result.renderer;
    scriptElementsRef.current.push(...result.scriptElements);
    blobUrlsRef.current.push(...result.scriptBlobUrls);
    setProject(result.project);
    setProjectLoaded(true);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    setProject(null);
    cleanupAssets();
    try {
      await boot(await openProjectFromZipFile(file));
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setProjectLoaded(false);
    } finally {
      if (event.target) event.target.value = '';
      setLoading(false);
    }
  };

  const handleNativeOpen = async () => {
    try {
      setLoading(true);
      setError(null);
      const assets = await openProjectNative();
      if (!assets) {
        setLoading(false);
        return;
      }
      setProject(null);
      cleanupAssets();
      await boot(assets);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setProjectLoaded(false);
    } finally {
      setLoading(false);
    }
  };

  actionsRef.current = { handleNativeOpen, toggleFullscreen };

  const currentWidth = project
    ? orientation === 'landscape'
      ? project.properties.landscape?.width || 1024
      : project.properties.portrait?.width || 768
    : 1024;
  const currentHeight = project
    ? orientation === 'landscape'
      ? project.properties.landscape?.height || 768
      : project.properties.portrait?.height || 1024
    : 768;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <input
        type="file"
        accept=".zip"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileUpload}
        disabled={loading}
      />

      <div className="flex-1 overflow-auto relative bg-black flex">
        {!projectLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10 p-4">
            <div className="bg-gray-800 p-6 md:p-8 rounded-2xl shadow-2xl max-w-md w-full border border-gray-700/50">
              <h1 className="text-3xl font-bold mb-2 text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                CF App
              </h1>
              <p className="text-center text-gray-500 text-sm mb-2">
                Shell for @agapi/cf-runtime
              </p>
              <p className="text-center text-gray-600 text-xs mb-6 font-mono">
                open assets → loadProject()
              </p>

              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="w-full mb-4 text-sm text-gray-400 hover:text-white py-2 rounded-lg border border-gray-700 hover:border-gray-500"
                >
                  ← Back to launcher
                </button>
              )}

              <div className="space-y-4 mb-8">
                <button
                  onClick={handleNativeOpen}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 bg-blue-600/90 hover:bg-blue-600 text-white py-3.5 px-4 rounded-xl font-medium disabled:opacity-50"
                >
                  <FolderOpen size={20} />
                  Open Project (native fs)
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 bg-purple-600/90 hover:bg-purple-600 text-white py-3.5 px-4 rounded-xl font-medium disabled:opacity-50"
                >
                  <Upload size={20} />
                  Open Project (.gui.zip)
                </button>
              </div>

              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer p-3 bg-gray-700/30 rounded-xl">
                  <input
                    type="checkbox"
                    checked={debugMode}
                    onChange={(e) => setDebugMode(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-600 text-blue-500 bg-gray-800"
                  />
                  <span className="text-gray-300 font-medium">Show Outline</span>
                </label>
                <div className="flex gap-3">
                  {(['landscape', 'portrait'] as const).map((o) => (
                    <label
                      key={o}
                      className={`flex-1 text-center py-3 rounded-xl border cursor-pointer text-sm font-medium capitalize ${
                        orientation === o
                          ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                          : 'bg-gray-700/30 border-transparent text-gray-400'
                      }`}
                    >
                      <input
                        type="radio"
                        name="orientation"
                        className="hidden"
                        checked={orientation === o}
                        onChange={() => setOrientation(o)}
                      />
                      {o}
                    </label>
                  ))}
                </div>
              </div>

              {loading && (
                <div className="mt-8 flex items-center justify-center gap-3 text-blue-400 p-4 bg-blue-500/10 rounded-xl">
                  <RefreshCw className="animate-spin" size={20} />
                  <span className="font-medium">Loading…</span>
                </div>
              )}
              {error && (
                <div className="mt-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-3 text-red-400 text-sm">
                  <AlertCircle size={20} className="shrink-0" />
                  <p className="font-medium">{error}</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div
          ref={containerRef}
          className={`relative overflow-hidden transition-opacity duration-500 ${
            projectLoaded ? 'opacity-100 block' : 'opacity-0 hidden'
          }`}
          style={
            isFullscreen
              ? {
                  width: '100vw',
                  height: '100vh',
                  background: '#000',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }
              : {
                  maxWidth: '100%',
                  maxHeight: '100%',
                  aspectRatio: `${currentWidth} / ${currentHeight}`,
                }
          }
        >
          <div
            style={
              isFullscreen
                ? {
                    width: '100%',
                    height: '100%',
                    aspectRatio: `${currentWidth} / ${currentHeight}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }
                : { width: '100%', height: '100%' }
            }
          >
            <canvas ref={canvasRef} className="w-full h-full object-contain bg-black" />
          </div>
        </div>
      </div>
    </div>
  );
}
