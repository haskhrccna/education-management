import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

/**
 * React Query's default onlineManager listens for browser `online`/`offline`
 * events, which don't exist in React Native — it silently assumes "always
 * online," so paused-query/mutation resume-on-reconnect never actually
 * triggers. This is the official React Native recipe: back onlineManager
 * with real device connectivity via NetInfo.
 *
 * WEB IS DELIBERATELY EXCLUDED. NetInfo's web implementation polls
 * `HEAD /` (see its `internal/defaultConfiguration.web.js`) to decide
 * `isInternetReachable`. On a GitHub Pages *project* site the app is served
 * from `/education-management/`, so `HEAD /` returns 404 forever — NetInfo
 * reports "not reachable", onlineManager pauses EVERY query and mutation, and
 * the app is wedged behind a permanent offline banner with no way to log in.
 * Browsers already expose real connectivity through the `online`/`offline`
 * events that React Query listens to by default, so on web we leave that
 * default listener in place instead of replacing it.
 */
export function setupOnlineManager(): void {
  if (Platform.OS === 'web') return;

  onlineManager.setEventListener((setOnline) => {
    return NetInfo.addEventListener((state) => {
      setOnline(!!state.isConnected && state.isInternetReachable !== false);
    });
  });
}
