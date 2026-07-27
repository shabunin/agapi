import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  Eraser,
  Play,
  RotateCcw,
} from 'lucide-react';
import type { CodeSnippet } from '../examples';
import { runGalleryScript, type LogLevel } from '../runScript';

export interface CodeExamplesProps {
  snippets: CodeSnippet[];
  /** Section title */
  title?: string;
  /** Start expanded (default true for tools, false for compact hub) */
  defaultOpen?: boolean;
  /** Tighter padding for embedding above full-screen tools */
  compact?: boolean;
  className?: string;
  /** Allow edit + Run (default true) */
  interactive?: boolean;
}

interface OutLine {
  id: number;
  level: LogLevel;
  text: string;
}

let outSeq = 0;

const LEVEL_CLASS: Record<LogLevel, string> = {
  log: 'text-gray-300',
  info: 'text-sky-300',
  warn: 'text-amber-300',
  error: 'text-red-400',
  debug: 'text-gray-500',
  sys: 'text-gray-600',
};

/**
 * Interactive, self-documenting playground:
 * pick a sample → edit freely → Run against live `agapi`.
 */
export function CodeExamples({
  snippets,
  title = 'Code playground',
  defaultOpen = true,
  compact = false,
  className = '',
  interactive = true,
}: CodeExamplesProps) {
  const list = useMemo(() => snippets.filter((s) => s.code?.trim()), [snippets]);
  const [open, setOpen] = useState(defaultOpen);
  const [activeId, setActiveId] = useState(list[0]?.id ?? '');
  const [code, setCode] = useState(list[0]?.code ?? '');
  const [dirty, setDirty] = useState(false);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [output, setOutput] = useState<OutLine[]>([]);
  const outEndRef = useRef<HTMLDivElement>(null);

  const active = list.find((s) => s.id === activeId) ?? list[0];
  const runnable = interactive && active?.runnable !== false;

  // Sync editor when switching tabs (unless we want to keep dirty — reset on tab change)
  useEffect(() => {
    if (!active) return;
    setCode(active.code);
    setDirty(false);
  }, [active?.id]);

  useEffect(() => {
    outEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [output]);

  if (!list.length) return null;

  const pushOut = (level: LogLevel, text: string) => {
    setOutput((prev) => {
      const next = [...prev, { id: ++outSeq, level, text }];
      return next.length > 300 ? next.slice(-300) : next;
    });
  };

  const selectSnippet = (id: string) => {
    setActiveId(id);
  };

  const reset = () => {
    if (!active) return;
    setCode(active.code);
    setDirty(false);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const run = async () => {
    if (!runnable || running) return;
    setRunning(true);
    setOutput([]);
    try {
      await runGalleryScript(code, pushOut);
    } finally {
      setRunning(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl/Cmd+Enter → Run
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      void run();
    }
    // Tab inserts spaces in textarea
    if (e.key === 'Tab' && e.target instanceof HTMLTextAreaElement) {
      e.preventDefault();
      const ta = e.target;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const next = code.slice(0, start) + '  ' + code.slice(end);
      setCode(next);
      setDirty(true);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
    }
  };

  return (
    <div
      className={`border border-gray-800 rounded-xl bg-gray-900/50 overflow-hidden ${className}`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-2 text-left hover:bg-gray-800/40 transition-colors ${
          compact ? 'px-3 py-2' : 'px-4 py-3'
        }`}
      >
        {open ? (
          <ChevronDown size={16} className="text-gray-500 shrink-0" />
        ) : (
          <ChevronRight size={16} className="text-gray-500 shrink-0" />
        )}
        <Code2 size={16} className="text-cyan-400/90 shrink-0" />
        <span className="text-sm font-medium text-gray-200 flex-1">{title}</span>
        {interactive && (
          <span className="text-[10px] text-emerald-500/80 font-medium mr-1">live</span>
        )}
        <span className="text-[10px] uppercase tracking-wide text-gray-500">
          {list.length} sample{list.length === 1 ? '' : 's'}
        </span>
      </button>

      {open && (
        <div className={`border-t border-gray-800 ${compact ? 'p-2.5' : 'p-3 sm:p-4'}`}>
          {list.length > 1 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {list.map((s) => {
                const on = s.id === active.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => selectSnippet(s.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      on
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'bg-gray-800/80 text-gray-400 border border-transparent hover:text-gray-200'
                    }`}
                  >
                    {s.title}
                    {s.runnable === false ? (
                      <span className="ml-1 text-[9px] text-gray-600">docs</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}

          {active?.description && (
            <p className="text-xs text-gray-500 leading-relaxed mb-2">{active.description}</p>
          )}

          {interactive ? (
            <textarea
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setDirty(true);
              }}
              onKeyDown={onKeyDown}
              spellCheck={false}
              className={`w-full rounded-lg border border-gray-800 bg-black/60 font-mono text-[11px] sm:text-xs leading-relaxed text-gray-200 focus:outline-none focus:border-cyan-500/40 resize-y ${
                compact ? 'p-2.5 min-h-[8rem] max-h-56' : 'p-3 min-h-[12rem] max-h-80'
              }`}
              // monospaced editing
              style={{ tabSize: 2 }}
            />
          ) : (
            <pre
              className={`rounded-lg border border-gray-800 bg-black/50 overflow-x-auto font-mono text-[11px] sm:text-xs leading-relaxed text-gray-300 ${
                compact ? 'p-2.5 max-h-48' : 'p-3 max-h-72'
              }`}
            >
              <code>{code}</code>
            </pre>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {runnable && (
              <button
                type="button"
                onClick={() => void run()}
                disabled={running || !code.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/90 hover:bg-emerald-600 text-white disabled:opacity-40"
                title="Ctrl/Cmd+Enter"
              >
                <Play size={13} className={running ? 'animate-pulse' : ''} />
                {running ? 'Running…' : 'Run'}
              </button>
            )}
            {!runnable && interactive && (
              <span className="text-[11px] text-amber-500/90">
                Docs only — not executable in playground
              </span>
            )}
            <button
              type="button"
              onClick={reset}
              disabled={!dirty}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] border border-gray-700 text-gray-400 hover:text-white disabled:opacity-30"
              title="Restore sample"
            >
              <RotateCcw size={12} /> Reset
            </button>
            <button
              type="button"
              onClick={() => void copy()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] border border-gray-700 text-gray-400 hover:text-white"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              type="button"
              onClick={() => setOutput([])}
              disabled={!output.length}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] border border-gray-700 text-gray-400 hover:text-white disabled:opacity-30"
            >
              <Eraser size={12} /> Clear out
            </button>
            {dirty && (
              <span className="text-[10px] text-amber-500/80 ml-auto">edited</span>
            )}
          </div>

          {(output.length > 0 || running) && (
            <div
              className={`mt-2 rounded-lg border border-gray-800 bg-black/70 font-mono text-[11px] leading-relaxed overflow-auto ${
                compact ? 'max-h-32 p-2' : 'max-h-44 p-2.5'
              }`}
            >
              {output.length === 0 && running && (
                <div className="text-gray-600">…</div>
              )}
              {output.map((line) => (
                <div key={line.id} className={LEVEL_CLASS[line.level] ?? 'text-gray-300'}>
                  {line.text}
                </div>
              ))}
              <div ref={outEndRef} />
            </div>
          )}

          <p className="mt-2 text-[10px] text-gray-600 leading-relaxed">
            Injected: <code className="text-gray-500">agapi</code>,{' '}
            <code className="text-gray-500">CF</code>,{' '}
            <code className="text-gray-500">console</code>,{' '}
            <code className="text-gray-500">Buffer</code>,{' '}
            <code className="text-gray-500">net/dgram/http/dns/tls/mdns</code>,{' '}
            <code className="text-gray-500">crypto</code>
            {' · '}
            <kbd className="text-gray-500">Ctrl+Enter</kbd> run
            {' · '}
            long-lived sockets stay open until you close them in code
          </p>
        </div>
      )}
    </div>
  );
}
