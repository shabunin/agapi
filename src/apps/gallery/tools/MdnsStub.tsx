import React from 'react';
import { ToolShell } from '../components/ToolShell';
import { StubPanel } from '../components/StubPanel';

export default function MdnsStub({ onBack }: { onBack: () => void }) {
  return (
    <ToolShell title="mDNS" surface="agapi.mdns (planned)" status="stub" onBack={onBack}>
      <StubPanel
        title="Local service discovery"
        roadmap={[
          'Host plugin: browse + advertise (Bonjour / Avahi / Android NsdManager)',
          'stdlib façade: agapi.mdns.browse / advertise (or host-only until stable)',
          'Gallery: live service list + advertise test service',
          'Used later by Matter / device discovery — not a CF feature',
        ]}
      />
    </ToolShell>
  );
}
