/**
 * WebRTC adapter, web build: the browser's own RTCPeerConnection. Metro picks
 * webrtc.native.ts on iOS/Android (react-native-webrtc). Both expose the same
 * surface, so useWebRTC stays platform-free.
 */
import { iceServers } from './webrtcConfig';

export type PeerConnection = RTCPeerConnection;
export type LocalStream = MediaStream;

export function createPeerConnection(): PeerConnection {
  return new RTCPeerConnection({ iceServers: iceServers() });
}

/** Microphone only. Rejects if there is no mic or permission is refused. */
export async function getLocalAudio(): Promise<LocalStream> {
  return navigator.mediaDevices.getUserMedia({ audio: true, video: false });
}

export const toDescription = (d: RTCSessionDescriptionInit) => d;
export const toCandidate = (c: RTCIceCandidateInit) => c;

// Browsers only play a remote track that is attached to a media element.
const players = new Map<string, HTMLAudioElement>();

export function attachRemoteAudio(peerId: string, stream: MediaStream): void {
  let el = players.get(peerId);
  if (!el) {
    el = document.createElement('audio');
    el.autoplay = true;
    el.dataset.halaqaPeer = peerId;
    el.style.display = 'none';
    document.body.appendChild(el);
    players.set(peerId, el);
  }
  el.srcObject = stream;
  void el.play().catch(() => {
    /* autoplay blocked until the user interacts; it resumes on the next tap */
  });
}

export function detachRemoteAudio(peerId: string): void {
  const el = players.get(peerId);
  if (!el) return;
  el.srcObject = null;
  el.remove();
  players.delete(peerId);
}
