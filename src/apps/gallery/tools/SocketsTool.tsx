import React from 'react';
import NcApp from '../../NcApp';
import { CodeExamples } from '../components/CodeExamples';
import { examplesFor } from '../examples';

/**
 * Sockets lab: docs strip + existing sockets console.
 * Examples stay visible above the interactive tool (self-documenting).
 */
export default function SocketsTool({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <div className="shrink-0 border-b border-gray-800 bg-gray-950/90 px-3 sm:px-4 py-3 z-20">
        <div className="max-w-4xl mx-auto">
          <CodeExamples
            snippets={examplesFor('sockets')}
            title="Playground · agapi.net / dgram"
            defaultOpen={false}
            compact
            interactive
          />
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        <NcApp onBack={onBack} />
      </div>
    </div>
  );
}
