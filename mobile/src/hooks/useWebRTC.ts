import { useCallback, useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';

export interface WebRTCState {
  isConnected: boolean;
  isMuted: boolean;
  remoteParticipants: string[];
  error: string | null;
}

/**
 * WebRTC hook scaffold for the halaqa audio room.
 *
 * react-native-webrtc is not imported here to avoid breaking TypeScript builds
 * when the optional dependency is not yet installed. The hook wires socket
 * signaling events and exposes the surface API that the room screen consumes.
 * When the dependency is present, replace the stub methods with real
 * RTCPeerConnection logic.
 */
export function useWebRTC(socket: Socket | null, roomId: string, userId: string) {
  const [state, setState] = useState<WebRTCState>({
    isConnected: false,
    isMuted: false,
    remoteParticipants: [],
    error: null,
  });

  const joinedRef = useRef(false);

  const joinRoom = useCallback(() => {
    if (!socket || joinedRef.current) return;
    socket.emit('halaqa:join', { roomId });
    joinedRef.current = true;
    setState((s) => ({ ...s, isConnected: true }));
  }, [socket, roomId]);

  const leaveRoom = useCallback(() => {
    if (!socket || !joinedRef.current) return;
    socket.emit('halaqa:leave', { roomId });
    joinedRef.current = false;
    setState({ isConnected: false, isMuted: false, remoteParticipants: [], error: null });
  }, [socket, roomId]);

  const toggleMute = useCallback(() => {
    setState((s) => ({ ...s, isMuted: !s.isMuted }));
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleOffer = (payload: { roomId: string; offer: unknown; fromUserId: string }) => {
      if (payload.roomId !== roomId) return;
      setState((s) => ({
        ...s,
        remoteParticipants: Array.from(new Set([...s.remoteParticipants, payload.fromUserId])),
      }));
      // TODO: apply remote RTCSessionDescription and emit answer when WebRTC lib added
      socket.emit('halaqa:answer', { roomId, targetUserId: payload.fromUserId, answer: null });
    };

    const handleAnswer = (payload: { roomId: string; answer: unknown; fromUserId: string }) => {
      if (payload.roomId !== roomId) return;
      // TODO: apply remote answer when WebRTC lib added
    };

    const handleIce = (payload: { roomId: string; candidate: unknown; fromUserId: string }) => {
      if (payload.roomId !== roomId) return;
      // TODO: add ICE candidate when WebRTC lib added
    };

    const handleParticipantJoined = (payload: { roomId: string; userId: string; user?: { firstName?: string; lastName?: string } }) => {
      if (payload.roomId !== roomId) return;
      setState((s) => ({
        ...s,
        remoteParticipants: Array.from(new Set([...s.remoteParticipants, payload.userId])),
      }));
    };

    const handleParticipantLeft = (payload: { roomId: string; userId: string }) => {
      if (payload.roomId !== roomId) return;
      setState((s) => ({
        ...s,
        remoteParticipants: s.remoteParticipants.filter((id) => id !== payload.userId),
      }));
    };

    socket.on('halaqa:offer', handleOffer);
    socket.on('halaqa:answer', handleAnswer);
    socket.on('halaqa:ice-candidate', handleIce);
    socket.on('halaqa:participant-joined', handleParticipantJoined);
    socket.on('halaqa:participant-left', handleParticipantLeft);

    joinRoom();

    return () => {
      socket.off('halaqa:offer', handleOffer);
      socket.off('halaqa:answer', handleAnswer);
      socket.off('halaqa:ice-candidate', handleIce);
      socket.off('halaqa:participant-joined', handleParticipantJoined);
      socket.off('halaqa:participant-left', handleParticipantLeft);
      leaveRoom();
    };
  }, [socket, roomId, userId, joinRoom, leaveRoom]);

  return { ...state, joinRoom, leaveRoom, toggleMute };
}
