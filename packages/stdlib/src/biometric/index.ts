import { getHost } from '../host';
import type { BiometricAuthOptions, BiometricStatus } from '../host';
import { mapHostError } from '../errors';

export type { BiometricAuthOptions, BiometricStatus, BiometryType } from '../host';

const NO_HOST_MESSAGE =
    '@agapi/stdlib/biometric: no BiometricHost installed. Mobile-only (Android/iOS) — not available on this host.';

/**
 * ```js
 * const status = await agapi.biometric.checkStatus();
 * if (status.isAvailable) {
 *   await agapi.biometric.authenticate('Confirm it\'s you');
 * }
 * ```
 */
export function checkStatus(): Promise<BiometricStatus> {
    const host = getHost();
    if (!host?.biometric) {
        return Promise.reject(mapHostError(NO_HOST_MESSAGE, { syscall: 'checkStatus' }));
    }
    return host.biometric.checkStatus().catch((err) => {
        throw mapHostError(err, { syscall: 'checkStatus' });
    });
}

/** Convenience: `(await checkStatus()).isAvailable`. */
export async function isAvailable(): Promise<boolean> {
    return (await checkStatus()).isAvailable;
}

/** Rejects if the user cancels or authentication fails. */
export function authenticate(reason: string, options?: BiometricAuthOptions): Promise<void> {
    const host = getHost();
    if (!host?.biometric) {
        return Promise.reject(mapHostError(NO_HOST_MESSAGE, { syscall: 'authenticate' }));
    }
    return host.biometric.authenticate(reason, options).catch((err) => {
        throw mapHostError(err, { syscall: 'authenticate' });
    });
}

const biometric = {
    checkStatus,
    isAvailable,
    authenticate,
};

export default biometric;
