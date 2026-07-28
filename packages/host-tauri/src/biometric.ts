import { checkStatus, authenticate, BiometryType as WireBiometryType } from '@tauri-apps/plugin-biometric';
import type {
    BiometricAuthOptions,
    BiometricHost,
    BiometricStatus,
    BiometryType,
} from '@agapi/stdlib/host';
import { mapHostError } from '@agapi/stdlib/errors';

const BIOMETRY_TYPE_MAP: Record<WireBiometryType, BiometryType> = {
    [WireBiometryType.None]: 'none',
    [WireBiometryType.TouchID]: 'touchId',
    [WireBiometryType.FaceID]: 'faceId',
    [WireBiometryType.Iris]: 'iris',
};

export class TauriBiometricHost implements BiometricHost {
    name = 'TauriBiometricHost';

    async checkStatus(): Promise<BiometricStatus> {
        try {
            const s = await checkStatus();
            return {
                isAvailable: s.isAvailable,
                biometryType: BIOMETRY_TYPE_MAP[s.biometryType] ?? 'none',
                error: s.error,
                errorCode: s.errorCode,
            };
        } catch (err) {
            throw mapHostError(err, { syscall: 'biometric.checkStatus' });
        }
    }

    async authenticate(reason: string, options: BiometricAuthOptions = {}): Promise<void> {
        try {
            await authenticate(reason, {
                allowDeviceCredential: options.allowDeviceCredential,
                cancelTitle: options.cancelTitle,
                fallbackTitle: options.fallbackTitle,
                title: options.title,
                subtitle: options.subtitle,
                confirmationRequired: options.confirmationRequired,
                // the plugin's own field name is a typo ("Attemps"); our public
                // API spells it correctly and maps it here.
                maxAttemps: options.maxAttempts,
            } as any);
        } catch (err) {
            throw mapHostError(err, { syscall: 'biometric.authenticate' });
        }
    }
}

export function createBiometricHost(): BiometricHost {
    return new TauriBiometricHost();
}
