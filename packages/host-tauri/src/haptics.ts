import {
    vibrate,
    impactFeedback,
    notificationFeedback,
    selectionFeedback,
} from '@tauri-apps/plugin-haptics';
import type { HapticsHost, HapticsImpactStyle, HapticsNotificationType } from '@agapi/stdlib/host';
import { mapHostError } from '@agapi/stdlib/errors';

// The plugin's commands resolve a Rust-shaped `Result<null, Error>` instead of
// rejecting (its `Error` type is currently `never`, i.e. no known failure
// mode reports this way today — but check `.status` anyway rather than
// assume, since a plain IPC rejection is still possible if the platform
// doesn't have the plugin registered at all).
async function unwrap(
    call: Promise<{ status: 'ok'; data: null } | { status: 'error'; error: unknown }>,
    syscall: string
): Promise<void> {
    let result;
    try {
        result = await call;
    } catch (err) {
        throw mapHostError(err, { syscall });
    }
    if (result.status === 'error') {
        throw mapHostError(String(result.error), { syscall });
    }
}

export class TauriHapticsHost implements HapticsHost {
    name = 'TauriHapticsHost';

    vibrate(durationMs: number): Promise<void> {
        return unwrap(vibrate(durationMs), 'haptics.vibrate');
    }

    impactFeedback(style: HapticsImpactStyle): Promise<void> {
        return unwrap(impactFeedback(style), 'haptics.impactFeedback');
    }

    notificationFeedback(type: HapticsNotificationType): Promise<void> {
        return unwrap(notificationFeedback(type), 'haptics.notificationFeedback');
    }

    selectionFeedback(): Promise<void> {
        return unwrap(selectionFeedback(), 'haptics.selectionFeedback');
    }
}

export function createHapticsHost(): HapticsHost {
    return new TauriHapticsHost();
}
