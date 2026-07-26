import React, { useMemo } from 'react';
import { ToolShell } from '../components/ToolShell';
import { CapabilityTable, type CapRow } from '../components/CapabilityTable';

function has(name: string): boolean {
  return typeof (globalThis as any)[name] !== 'undefined';
}

export default function WebcodecsInfo({ onBack }: { onBack: () => void }) {
  const rows: CapRow[] = useMemo(
    () => [
      { name: 'VideoEncoder', supported: has('VideoEncoder') },
      { name: 'VideoDecoder', supported: has('VideoDecoder') },
      { name: 'AudioEncoder', supported: has('AudioEncoder') },
      { name: 'AudioDecoder', supported: has('AudioDecoder') },
      { name: 'VideoFrame', supported: has('VideoFrame') },
      { name: 'AudioData', supported: has('AudioData') },
      { name: 'EncodedVideoChunk', supported: has('EncodedVideoChunk') },
      { name: 'EncodedAudioChunk', supported: has('EncodedAudioChunk') },
      { name: 'ImageDecoder', supported: has('ImageDecoder') },
    ],
    []
  );

  const anySupport = rows.some((r) => r.supported);

  return (
    <ToolShell title="WebCodecs" surface="browser WebCodecs" status="info" onBack={onBack}>
      <div className="p-4 max-w-2xl mx-auto space-y-4">
        <p className="text-sm text-gray-400 leading-relaxed">
          Capability matrix for low-level encode/decode APIs in this webview. No stdlib
          wrapper planned until product needs hardware-assisted media pipelines.
        </p>
        {!anySupport && (
          <div className="rounded-lg border border-gray-700 bg-gray-900/50 px-3 py-2 text-sm text-gray-400">
            No WebCodecs constructors detected in this environment.
          </div>
        )}
        <CapabilityTable rows={rows} />
      </div>
    </ToolShell>
  );
}
