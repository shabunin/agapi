import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import type { ToolStatus } from '../types';

export interface ToolShellProps {
  title: string;
  surface?: string;
  status?: ToolStatus;
  onBack: () => void;
  children: React.ReactNode;
  /** Optional extra header actions */
  actions?: React.ReactNode;
}

/** Shared chrome for gallery tools (except full-screen NC which has its own header). */
export function ToolShell({
  title,
  surface,
  status,
  onBack,
  children,
  actions,
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
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
