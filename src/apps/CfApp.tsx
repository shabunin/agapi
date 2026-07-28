import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Application, Assets } from 'pixi.js';
import { Upload, AlertCircle, FolderOpen, RefreshCw } from 'lucide-react';
import {
  loadProject,
  joinStore,
  stopAllAnimations,
  type CFProject,
  type CFRenderer,
  type RuntimeMenu,
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
  /** Runtime chrome bar; outline/orientation live in the menu itself. */
  const [showMenu, setShowMenu] = useState(true);
  const [debugMode, setDebugMode] = useState(false);
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** Canvas box only — GUI surface / fullscreen target (no chrome). */
  const containerRef = useRef<HTMLDivElement>(null);
  /** Dedicated strip above the canvas for RuntimeMenu (no GUI overlap). */
  const chromeRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const appRef = useRef<Application | null>(null);
  const rendererRef = useRef<CFRenderer | null>(null);
  const menuRef = useRef<RuntimeMenu | null>(null);
  const blobUrlsRef = useRef<string[]>([]);
  const scriptElementsRef = useRef<HTMLScriptElement[]>([]);

  /** Stable host hooks for RuntimeMenu (avoids stale closures). */
  const hostActionsRef = useRef({
    openNative: async () => {},
    openZip: () => {},
    toggleDevtools: async () => {},
  });

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
    const stopNetwork = () => {
      try {
        (window as any).CF?.stopSystems?.();
      } catch {
        /* ignore */
      }
    };
    // Full page reload / navigate away — JS dies but Tauri process keeps OS sockets
    // unless we close them first.
    window.addEventListener('pagehide', stopNetwork);
    window.addEventListener('beforeunload', stopNetwork);

    return () => {
      window.removeEventListener('pagehide', stopNetwork);
      window.removeEventListener('beforeunload', stopNetwork);
      stopNetwork();
      stopAllAnimations();
      try {
        menuRef.current?.destroy();
      } catch {
        /* ignore */
      }
      menuRef.current = null;
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

  // Keep RuntimeMenu chrome in sync with start-screen checkbox / Ctrl+M
  useEffect(() => {
    menuRef.current?.setVisible(showMenu);
  }, [showMenu]);

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

  const boot = async (assets: ProjectAssets) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const chrome = chromeRef.current;
    if (!canvas) throw new Error('Canvas reference missing');
    if (!container) throw new Error('Container reference missing');
    if (!chrome) throw new Error('Chrome host missing');

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
      previousMenu: menuRef.current,
      onOrientationChange: setOrientation,
      menu: {
        // Strip above canvas — not over Pixi GUI
        mount: chrome,
        placement: 'bar',
        visible: showMenu,
        fullscreenTarget: container,
        host: {
          openNative: () => hostActionsRef.current.openNative(),
          openZip: () => hostActionsRef.current.openZip(),
          toggleDevtools: () => hostActionsRef.current.toggleDevtools(),
          // reload uses RuntimeMenu default (stopSystems + location.reload)
        },
        onDebugChange: setDebugMode,
        onVisibilityChange: setShowMenu,
      },
    });

    appRef.current = result.app;
    rendererRef.current = result.renderer;
    menuRef.current = result.menu;
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

  hostActionsRef.current = {
    openNative: handleNativeOpen,
    openZip: () => fileInputRef.current?.click(),
    toggleDevtools: async () => {
      try {
        const core = await import('@tauri-apps/api/core');
        const isOpen = await core.invoke<boolean>('is_devtools_open');
        await core.invoke('set_devtools', { open: !isOpen });
      } catch (e) {
        console.warn('[CfApp] toggleDevtools failed (not Tauri?):', e);
      }
    },
  };

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

              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer p-3 bg-gray-700/30 rounded-xl">
                  <input
                    type="checkbox"
                    checked={showMenu}
                    onChange={(e) => setShowMenu(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-600 text-blue-500 bg-gray-800"
                  />
                  <span className="text-gray-300 font-medium">Show menu</span>
                </label>
                <p className="text-center text-gray-500 text-xs px-1">
                  Toggle the runtime menu anytime with{' '}
                  <kbd className="px-1.5 py-0.5 rounded bg-gray-700/80 text-gray-300 font-mono text-[11px]">
                    Ctrl+M
                  </kbd>
                </p>
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

        {/* Project stage: chrome strip (sibling) + canvas box — menu never covers GUI */}
        <div
          className={`flex flex-col items-stretch transition-opacity duration-500 ${
            projectLoaded ? 'opacity-100' : 'opacity-0 pointer-events-none absolute'
          }`}
          style={
            isFullscreen
              ? { width: '100vw', height: '100vh', background: '#000' }
              : {
                  maxWidth: '100%',
                  maxHeight: '100%',
                  // chrome (~36px) + canvas aspect box
                  width: 'min(100%, max-content)',
                }
          }
        >
          <div ref={chromeRef} className="shrink-0 w-full relative z-20" />
          <div
            ref={containerRef}
            className="relative overflow-hidden bg-black"
            style={
              isFullscreen
                ? {
                    flex: 1,
                    minHeight: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }
                : {
                    width: currentWidth,
                    maxWidth: '100%',
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
    </div>
  );
}
