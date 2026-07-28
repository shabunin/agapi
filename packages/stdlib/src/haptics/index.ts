import { getHost } from '../host';
import type { HapticsImpactStyle, HapticsNotificationType } from '../host';
import { mapHostError } from '../errors';

export type { HapticsImpactStyle, HapticsNotificationType } from '../host';

const NO_FALLBACK_MESSAGE =
    '@agapi/stdlib/haptics: no HapticsHost installed and navigator.vibrate unavailable.';

/** Best-effort browser fallback — real browsers/webviews, not every host has one. */
function browserVibrate(pattern: number | number[]): boolean {
    const v = (globalThis as any).navigator?.vibrate;
    return typeof v === 'function' ? Boolean(v.call(globalThis.navigator, pattern)) : false;
}

/**
 * Vibrate for `durationMs`. Mobile host preferred; falls back to
 * `navigator.vibrate` where present (desktop webview / browser).
 */
export async function vibrate(durationMs: number): Promise<void> {
    const host = getHost()?.haptics;
    if (host) return host.vibrate(durationMs);
    if (!browserVibrate(durationMs)) {
        throw mapHostError(NO_FALLBACK_MESSAGE, { syscall: 'vibrate' });
    }
}

const IMPACT_FALLBACK_MS: Record<HapticsImpactStyle, number> = {
    light: 10,
    medium: 20,
    heavy: 35,
    soft: 10,
    rigid: 20,
};

/** `style` defaults to 'medium'. */
export async function impact(style: HapticsImpactStyle = 'medium'): Promise<void> {
    const host = getHost()?.haptics;
    if (host) return host.impactFeedback(style);
    if (!browserVibrate(IMPACT_FALLBACK_MS[style] ?? 20)) {
        throw mapHostError(NO_FALLBACK_MESSAGE, { syscall: 'impact' });
    }
}

const NOTIFICATION_FALLBACK_MS: Record<HapticsNotificationType, number[]> = {
    success: [10, 30, 10],
    warning: [20, 40, 20],
    error: [30, 50, 30, 50, 30],
};

/** `type` defaults to 'success'. */
export async function notification(type: HapticsNotificationType = 'success'): Promise<void> {
    const host = getHost()?.haptics;
    if (host) return host.notificationFeedback(type);
    if (!browserVibrate(NOTIFICATION_FALLBACK_MS[type] ?? [20])) {
        throw mapHostError(NO_FALLBACK_MESSAGE, { syscall: 'notification' });
    }
}

export async function selection(): Promise<void> {
    const host = getHost()?.haptics;
    if (host) return host.selectionFeedback();
    if (!browserVibrate(5)) {
        throw mapHostError(NO_FALLBACK_MESSAGE, { syscall: 'selection' });
    }
}

const haptics = {
    vibrate,
    impact,
    notification,
    selection,
};

export default haptics;
