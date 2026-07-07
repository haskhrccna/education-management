import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

/**
 * React Query's default onlineManager listens for browser `online`/`offline`
 * events, which don't exist in React Native — it silently assumes "always
 * online," so paused-query/mutation resume-on-reconnect never actually
 * triggers. This is the official React Native recipe: back onlineManager
 * with real device connectivity via NetInfo.
 */
export function setupOnlineManager(): void {
  onlineManager.setEventListener((setOnline) => {
    return NetInfo.addEventListener((state) => {
      setOnline(!!state.isConnected && state.isInternetReachable !== false);
    });
  });
}
