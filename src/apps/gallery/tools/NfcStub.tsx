import React from 'react';
import { ToolShell } from '../components/ToolShell';
import { StubPanel } from '../components/StubPanel';
import { examplesFor } from '../examples';

export default function NfcStub({ onBack }: { onBack: () => void }) {
  return (
    <ToolShell
      title="NFC"
      surface="agapi.nfc (planned)"
      status="stub"
      onBack={onBack}
      examples={examplesFor('nfc')}
    >
      <StubPanel
        title="NFC (NDEF)"
        roadmap={[
          'Scan / session — NDEF read',
          'Write (optional) — where OS allows',
          'Availability: Android-first; iOS limited; desktop rare',
          'Likely host plugin only — mobile host needed before this lands',
        ]}
      />
    </ToolShell>
  );
}
