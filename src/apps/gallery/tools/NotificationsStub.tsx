import React from 'react';
import { ToolShell } from '../components/ToolShell';
import { StubPanel } from '../components/StubPanel';
import { examplesFor } from '../examples';

export default function NotificationsStub({ onBack }: { onBack: () => void }) {
  return (
    <ToolShell
      title="Notifications"
      surface="agapi.notifications (planned)"
      status="stub"
      onBack={onBack}
      examples={examplesFor('notifications')}
    >
      <StubPanel
        title="Local notifications"
        roadmap={[
          'agapi.notifications.requestPermission() — OS / web',
          'agapi.notifications.show({ title, body, … }) — local notify',
          'Optional tap / dismiss events (host-dependent)',
        ]}
      />
    </ToolShell>
  );
}
