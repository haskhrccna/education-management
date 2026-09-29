/**
 * ICE servers for halaqa audio. STUN alone connects most home Wi-Fi peers;
 * phones on mobile data or strict NAT usually need a TURN relay. Set
 * EXPO_PUBLIC_TURN_URL (+ _USERNAME / _CREDENTIAL) at build time to add one.
 * These values are baked into the bundle, so use a TURN service with its own
 * per-app restrictions (or short-lived credentials).
 */
export function iceServers(): { urls: string; username?: string; credential?: string }[] {
  const servers: { urls: string; username?: string; credential?: string }[] = [
    { urls: 'stun:stun.l.google.com:19302' },
  ];
  const turn = process.env.EXPO_PUBLIC_TURN_URL;
  if (turn) {
    servers.push({
      urls: turn,
      username: process.env.EXPO_PUBLIC_TURN_USERNAME,
      credential: process.env.EXPO_PUBLIC_TURN_CREDENTIAL,
    });
  }
  return servers;
}
