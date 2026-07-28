import { getHost } from '../host';
import type { NotificationActionEvent, NotificationOptions } from '../host';
import { mapHostError } from '../errors';

export type { NotificationActionEvent, NotificationOptions } from '../host';

const NO_HOST_MESSAGE =
    '@agapi/stdlib/notifications: no NotificationHost installed. Call installStdlib(createTauriHost()) in Tauri app bootstrap.';

/**
 * ```js
 * let granted = await agapi.notifications.isPermissionGranted();
 * if (!granted) granted = (await agapi.notifications.requestPermission()) === 'granted';
 * if (granted) agapi.notifications.show({ title: 'agapi', body: 'hello' });
 * ```
 */
export function isPermissionGranted(): Promise<boolean> {
    const host = getHost();
    if (!host?.notifications) {
        return Promise.reject(mapHostError(NO_HOST_MESSAGE, { syscall: 'isPermissionGranted' }));
    }
    return host.notifications.isPermissionGranted().catch((err) => {
        throw mapHostError(err, { syscall: 'isPermissionGranted' });
    });
}

export function requestPermission(): Promise<NotificationPermission> {
    const host = getHost();
    if (!host?.notifications) {
        return Promise.reject(mapHostError(NO_HOST_MESSAGE, { syscall: 'requestPermission' }));
    }
    return host.notifications.requestPermission().catch((err) => {
        throw mapHostError(err, { syscall: 'requestPermission' });
    });
}

/** Synchronous, like the underlying host plugin — throws immediately on a bad options shape. */
export function show(options: NotificationOptions | string): void {
    const host = getHost();
    if (!host?.notifications) {
        throw mapHostError(NO_HOST_MESSAGE, { syscall: 'show' });
    }
    host.notifications.show(options);
}

/** Fires when the user taps the notification or one of its action buttons. */
export function onAction(callback: (event: NotificationActionEvent) => void): Promise<() => void> {
    const host = getHost();
    if (!host?.notifications) {
        return Promise.reject(mapHostError(NO_HOST_MESSAGE, { syscall: 'onAction' }));
    }
    return host.notifications.onAction(callback).catch((err) => {
        throw mapHostError(err, { syscall: 'onAction' });
    });
}

const notifications = {
    isPermissionGranted,
    requestPermission,
    show,
    onAction,
};

export default notifications;
