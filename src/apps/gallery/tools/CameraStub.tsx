import React from 'react';
import { ToolShell } from '../components/ToolShell';
import { StubPanel } from '../components/StubPanel';
import { examplesFor } from '../examples';

export default function CameraStub({ onBack }: { onBack: () => void }) {
  return (
    <ToolShell
      title="Camera"
      surface="host mobile API (planned)"
      status="stub"
      onBack={onBack}
      examples={examplesFor('camera')}
    >
      <StubPanel
        title="Camera capture"
        roadmap={[
          'Mobile host: preview + snapshot (permissions UX)',
          'Optional: getUserMedia path in desktop webview for labs',
          'stdlib or host API: open / capture / close — keep out of CF runtime',
          'Gallery: live preview tile when host lands',
        ]}
      />
    </ToolShell>
  );
}
