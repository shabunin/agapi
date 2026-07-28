import React from 'react';
import { ToolShell } from '../components/ToolShell';
import { StubPanel } from '../components/StubPanel';
import { examplesFor } from '../examples';

export default function BluetoothStub({ onBack }: { onBack: () => void }) {
  return (
    <ToolShell
      title="Bluetooth"
      surface="host mobile API (planned)"
      status="stub"
      onBack={onBack}
      examples={examplesFor('bluetooth')}
    >
      <StubPanel
        title="Bluetooth / BLE"
        roadmap={[
          'Host: scan, connect, GATT read/write (platform-specific)',
          'Permission + pairing flows on Android / iOS',
          'Surface TBD: agapi.bluetooth vs host-only plugin',
          'Gallery: device list + characteristic lab when ready',
        ]}
      />
    </ToolShell>
  );
}
