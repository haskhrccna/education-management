import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';
import i18n from '../i18n';
import { secureStorage } from '../storage/secureStorage';

export const BIOMETRIC_ENABLED_KEY = 'biometric_login_enabled';

export interface BiometricStatus {
  enabled: boolean;
  available: boolean;
  hasStoredSession: boolean;
  label: string;
  reason?: string;
}

type BiometricTextKey =
  | 'biometrics'
  | 'biometricFaceId'
  | 'biometricFingerprint'
  | 'biometricIris'
  | 'biometricUnavailable'
  | 'biometricWebUnavailable'
  | 'biometricNoHardware'
  | 'biometricNotEnrolled'
  | 'biometricPromptTitle'
  | 'biometricPromptSubtitle'
  | 'biometricCancel'
  | 'biometricFallback'
  | 'biometricCancelled'
  | 'biometricFailed'
  | 'biometricPasswordFirst';

export function biometricText(key: BiometricTextKey, isAr = false, options?: Record<string, string>): string {
  return i18n.t(key, { lng: isAr ? 'ar' : 'en', ...options });
}

export async function isBiometricPreferenceEnabled(): Promise<boolean> {
  return (await secureStorage.getItem(BIOMETRIC_ENABLED_KEY)) === 'true';
}

function labelForTypes(types: LocalAuthentication.AuthenticationType[], isAr: boolean): string {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return biometricText('biometricFaceId', isAr);
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return biometricText('biometricFingerprint', isAr);
  }
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return biometricText('biometricIris', isAr);
  }
  return biometricText('biometrics', isAr);
}

export async function getBiometricStatus(isAr = false): Promise<BiometricStatus> {
  const enabled = await isBiometricPreferenceEnabled();
  const hasStoredSession = Boolean(
    (await secureStorage.getItem('auth_token')) || (await secureStorage.getItem('refresh_token'))
  );

  if (Platform.OS === 'web') {
    return {
      enabled,
      available: false,
      hasStoredSession,
      label: biometricText('biometrics', isAr),
      reason: biometricText('biometricWebUnavailable', isAr),
    };
  }

  const [hasHardware, isEnrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  const label = labelForTypes(types, isAr);

  if (!hasHardware) {
    return {
      enabled,
      available: false,
      hasStoredSession,
      label,
      reason: biometricText('biometricNoHardware', isAr),
    };
  }

  if (!isEnrolled) {
    return {
      enabled,
      available: false,
      hasStoredSession,
      label,
      reason: biometricText('biometricNotEnrolled', isAr),
    };
  }

  return { enabled, available: true, hasStoredSession, label };
}

export async function setBiometricPreference(enabled: boolean): Promise<void> {
  if (enabled) {
    await secureStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
  } else {
    await secureStorage.deleteItem(BIOMETRIC_ENABLED_KEY);
  }
}

export async function promptForBiometrics(isAr = false, label?: string): Promise<void> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: biometricText('biometricPromptTitle', isAr, { method: label ?? biometricText('biometrics', isAr) }),
    promptSubtitle: biometricText('biometricPromptSubtitle', isAr),
    cancelLabel: biometricText('biometricCancel', isAr),
    fallbackLabel: biometricText('biometricFallback', isAr),
    biometricsSecurityLevel: 'strong',
  });

  if (!result.success) {
    throw new Error(
      result.error === 'user_cancel'
        ? biometricText('biometricCancelled', isAr)
        : biometricText('biometricFailed', isAr)
    );
  }
}
