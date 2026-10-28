import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spacing } from '@/shared/theme/tokens';

import { Button } from './button';
import { Notice } from './notice';

type FlashAlertTone = 'error' | 'info' | 'success';
type FlashAlert = { dismissLabel?: string; message: string; tone: FlashAlertTone };
type FlashAlertContextValue = {
  dismissAlert(): void;
  showAlert(alert: FlashAlert): void;
};

const FlashAlertContext = createContext<FlashAlertContextValue>({
  dismissAlert() {},
  showAlert() {},
});

const AUTO_DISMISS_MS = 5_000;

export function FlashAlertProvider({ children }: { children: ReactNode }) {
  const [alert, setAlert] = useState<FlashAlert>();
  const dismissAlert = useCallback(() => setAlert(undefined), []);
  const showAlert = useCallback((next: FlashAlert) => setAlert(next), []);
  const value = useMemo(() => ({ dismissAlert, showAlert }), [dismissAlert, showAlert]);

  useEffect(() => {
    if (!alert || alert.tone === 'error') return;
    const timeout = setTimeout(dismissAlert, AUTO_DISMISS_MS);
    return () => clearTimeout(timeout);
  }, [alert, dismissAlert]);

  return (
    <FlashAlertContext.Provider value={value}>
      <View style={styles.root}>
        {children}
        {alert ? (
          <SafeAreaView
            edges={[]}
            pointerEvents="box-none"
            style={styles.overlay}
            testID="flash-alert-overlay"
          >
            <View style={styles.alert} testID="flash-alert">
              <Notice title={alert.message} tone={alert.tone} />
              <Button
                accessibilityLabel={alert.dismissLabel ?? 'Dismiss notification'}
                onPress={dismissAlert}
                style={styles.dismiss}
                testID="dismiss-flash-alert"
                variant="ghost"
              >
                ×
              </Button>
            </View>
          </SafeAreaView>
        ) : null}
      </View>
    </FlashAlertContext.Provider>
  );
}

export function useFlashAlert() {
  return useContext(FlashAlertContext);
}

const styles = StyleSheet.create({
  alert: {
    gap: spacing.x2,
    margin: spacing.x4,
  },
  dismiss: { alignSelf: 'flex-end' },
  overlay: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 10,
  },
  root: { flex: 1 },
});
