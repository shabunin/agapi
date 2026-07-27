import React from 'react';
import { ToolShell } from '../components/ToolShell';
import { StubPanel } from '../components/StubPanel';
import { examplesFor } from '../examples';

export default function HapticsStub({ onBack }: { onBack: () => void }) {
  return (
    <ToolShell
      title="Haptics"
      surface="agapi.haptics (planned)"
      status="stub"
      onBack={onBack}
      examples={examplesFor('haptics')}
    >
      <StubPanel
        title="Haptics"
        roadmap={[
          'agapi.haptics.impact(style?) — light / medium / heavy',
          'agapi.haptics.notification(type?) — success / warning / error',
          'agapi.haptics.selection() — tick',
          'Browser: navigator.vibrate fallback where present; mobile host preferred',
        ]}
      />
    </ToolShell>
  );
}
