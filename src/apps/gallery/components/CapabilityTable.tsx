import React from 'react';

export interface CapRow {
  name: string;
  supported: boolean;
  detail?: string;
}

export function CapabilityTable({ rows }: { rows: CapRow[] }) {
  return (
    <div className="rounded-xl border border-gray-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-900/80 text-left text-xs uppercase tracking-wide text-gray-500">
            <th className="px-4 py-2.5 font-medium">API</th>
            <th className="px-4 py-2.5 font-medium w-28">Status</th>
            <th className="px-4 py-2.5 font-medium">Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-t border-gray-800/80">
              <td className="px-4 py-2.5 font-mono text-gray-200">{r.name}</td>
              <td className="px-4 py-2.5">
                <span
                  className={
                    r.supported
                      ? 'text-emerald-400 font-medium'
                      : 'text-red-400/90 font-medium'
                  }
                >
                  {r.supported ? 'yes' : 'no'}
                </span>
              </td>
              <td className="px-4 py-2.5 text-gray-500">{r.detail ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
