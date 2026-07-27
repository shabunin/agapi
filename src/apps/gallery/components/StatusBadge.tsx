import type { ToolStatus } from '../types';

const STYLES: Record<ToolStatus, string> = {
  live: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  lab: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  stub: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  info: 'bg-gray-500/15 text-gray-300 border-gray-500/30',
};

const LABELS: Record<ToolStatus, string> = {
  live: 'live',
  lab: 'lab',
  stub: 'stub',
  info: 'info',
};

export function StatusBadge({ status }: { status: ToolStatus }) {
  // 'live' / 'lab' badges were noise once most tools reached this stage —
  // 'stub' / 'info' still carry real signal (not implemented / read-only probe).
  if (status === 'live' || status === 'lab') return null;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide border ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
