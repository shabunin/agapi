import React from 'react';
import { ToolShell } from '../components/ToolShell';
import { StubPanel } from '../components/StubPanel';
import { examplesFor } from '../examples';

export default function BiometricsStub({ onBack }: { onBack: () => void }) {
  return (
    <ToolShell
      title="Biometric"
      surface="agapi.biometric (planned)"
      status="stub"
      onBack={onBack}
      examples={examplesFor('biometrics')}
    >
      <StubPanel
        title="Biometric"
        roadmap={[
          'agapi.biometric.isAvailable() — face / fingerprint / none',
          'agapi.biometric.authenticate({ reason }) — unlock / confirm action',
          'Host-only on mobile/desktop OS; no pure-browser guarantee',
        ]}
      />
    </ToolShell>
  );
}
