import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { CodeExamples } from './CodeExamples';
import type { CodeSnippet } from '../examples';
import type { ToolStatus } from '../types';

export interface ToolShellProps {
  title: string;
  surface?: string;
  status?: ToolStatus;
  onBack: () => void;
  children: React.ReactNode;
  /** Optional extra header actions */
  actions?: React.ReactNode;
  /**
   * Self-doc code samples (tabs + copy).
   * Shown in a collapsible panel under the header.
   */
  examples?: CodeSnippet[];
  /** Start examples open (default true) */
  examplesOpen?: boolean;
}

/** Shared chrome for gallery tools — header, optional code examples, body. */
export function ToolShell({
  title,
  surface,
  status,
  onBack,
  children,
  actions,
  examples,
  examplesOpen = true,
}: ToolShellProps) {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur px-4 py-3 flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white"
          title="Back to gallery"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-semibold text-base truncate">{title}</h1>
            {status && <StatusBadge status={status} />}
          </div>
          {surface && (
            <p className="text-xs text-gray-500 font-mono truncate mt-0.5">{surface}</p>
          )}
        </div>
        {actions}
      </header>

      {examples && examples.length > 0 && (
        <div className="shrink-0 border-b border-gray-800/80 bg-gray-950/80 px-3 sm:px-4 py-3">
          <div className="max-w-3xl mx-auto">
            <CodeExamples
              snippets={examples}
              defaultOpen={examplesOpen}
              compact
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
