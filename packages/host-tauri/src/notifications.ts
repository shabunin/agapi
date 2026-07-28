import {
    isPermissionGranted,
    requestPermission,
    sendNotification,
    onAction,
} from '@tauri-apps/plugin-notification';
import type {
    NotificationActionEvent,
    NotificationHost,
    NotificationOptions,
} from '@agapi/stdlib/host';
import { mapHostError } from '@agapi/stdlib/errors';

export class TauriNotificationHost implements NotificationHost {
    name = 'TauriNotificationHost';

    isPermissionGranted(): Promise<boolean> {
        return isPermissionGranted().catch((err) => {
            throw mapHostError(err, { syscall: 'notifications.isPermissionGranted' });
        });
    }

    requestPermission(): Promise<NotificationPermission> {
        return requestPermission().catch((err) => {
            throw mapHostError(err, { syscall: 'notifications.requestPermission' });
        });
    }

    show(options: NotificationOptions | string): void {
        // sendNotification is synchronous — a bad option shape throws immediately,
        // not via a rejected promise.
        sendNotification(options as any);
    }

    async onAction(callback: (event: NotificationActionEvent) => void): Promise<() => void> {
        try {
            const listener = await onAction((notification: any) => {
                callback({ notification, actionId: notification?.actionId });
            });
            return () => {
                void listener.unregister();
            };
        } catch (err) {
            throw mapHostError(err, { syscall: 'notifications.onAction' });
        }
    }
}

export function createNotificationHost(): NotificationHost {
    return new TauriNotificationHost();
}
