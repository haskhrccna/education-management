/**
 * WebRTC adapter, iOS/Android: react-native-webrtc (a native module, so it
 * needs a dev client or EAS build, not Expo Go). Same surface as webrtc.ts.
 * Remote audio tracks play through the device speaker on their own, so
 * attach/detach are no-ops here.
 */
import {
  RTCPeerConnection as NativePeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
} from 'react-native-webrtc';
import { iceServers } from './webrtcConfig';

// The hook is written against the standard (DOM) WebRTC types, which
// react-native-webrtc implements.
export type PeerConnection = RTCPeerConnection;
export type LocalStream = MediaStream;

export function createPeerConnection(): PeerConnection {
  return new NativePeerConnection({ iceServers: iceServers() }) as unknown as PeerConnection;
}

export async function getLocalAudio(): Promise<LocalStream> {
  return (await mediaDevices.getUserMedia({ audio: true, video: false })) as unknown as LocalStream;
}

export const toDescription = (d: RTCSessionDescriptionInit) =>
  new RTCSessionDescription(d as { type: string; sdp: string }) as unknown as RTCSessionDescriptionInit;
export const toCandidate = (c: RTCIceCandidateInit) => new RTCIceCandidate(c) as unknown as RTCIceCandidateInit;

export function attachRemoteAudio(_peerId: string, _stream: MediaStream): void {}
export function detachRemoteAudio(_peerId: string): void {}
