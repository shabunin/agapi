import React from 'react';
import { ToolShell } from '../components/ToolShell';
import { StubPanel } from '../components/StubPanel';
import { examplesFor } from '../examples';

export default function SensorsStub({ onBack }: { onBack: () => void }) {
  return (
    <ToolShell
      title="Sensors"
      surface="agapi.sensors (planned)"
      status="stub"
      onBack={onBack}
      examples={examplesFor('sensors')}
    >
      <StubPanel
        title="Sensors"
        roadmap={[
          'Accelerometer / gyroscope via DeviceMotion or host',
          'Attitude / heading via DeviceOrientation or host',
          'Location via Geolocation or host',
          'API sketch: agapi.sensors.start(type, options) → handle with stop() + data events',
        ]}
      />
    </ToolShell>
  );
}
