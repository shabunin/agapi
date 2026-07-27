import React from 'react';
import { ToolShell } from '../components/ToolShell';
import { StubPanel } from '../components/StubPanel';
import { examplesFor } from '../examples';

export default function FsStub({ onBack }: { onBack: () => void }) {
  return (
    <ToolShell
      title="Filesystem"
      surface="agapi.fs (planned)"
      status="stub"
      onBack={onBack}
      examples={examplesFor('fs')}
    >
      <StubPanel
        title="Filesystem (scoped subset, T3)"
        roadmap={[
          'readFile / writeFile / appendFile — logs, config, cache',
          'mkdir / readdir / stat / remove — app data dir',
          'Scoped roots: app data, cache, optional user-picked dir',
          'No arbitrary whole-disk access without an explicit picker/permission',
        ]}
      />
    </ToolShell>
  );
}
