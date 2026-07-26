import React from 'react';
import { Construction } from 'lucide-react';

export function StubPanel({
  title,
  roadmap,
  children,
}: {
  title: string;
  roadmap: string[];
  children?: React.ReactNode;
}) {
  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
        <div className="flex items-start gap-3">
          <Construction className="text-amber-400 shrink-0 mt-0.5" size={22} />
          <div>
            <h2 className="font-semibold text-amber-100">{title}</h2>
            <p className="text-sm text-gray-400 mt-1 leading-relaxed">
              Placeholder for a future stdlib / host capability. UI shell is ready;
              wire host + façade when the roadmap phase starts.
            </p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
          Planned work
        </h3>
        <ul className="space-y-2">
          {roadmap.map((item) => (
            <li
              key={item}
              className="text-sm text-gray-300 flex gap-2 leading-relaxed"
            >
              <span className="text-amber-500/80 shrink-0">·</span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      {children}
    </div>
  );
}
