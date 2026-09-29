import { useCallback, useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import {
  createPeerConnection,
  getLocalAudio,
  toDescription,
  toCandidate,
  attachRemoteAudio,
  detachRemoteAudio,
  type PeerConnection,
  type LocalStream,
} from '../lib/webrtc';

export interface WebRTCState {
  isConnected: boolean;
  isMuted: boolean;
  remoteParticipants: string[];
  error: string | null;
}

interface Peer {
  pc: PeerConnection;
  pendingIce: RTCIceCandidateInit[];
}

type SdpPayload = { roomId: string; fromUserId: string; sdp: RTCSessionDescriptionInit };
type IcePayload = { roomId: string; fromUserId: string; candidate: RTCIceCandidateInit };

const plainDescription = (d: RTCSessionDescriptionInit | null) => (d ? { type: d.type, sdp: d.sdp } : null);

/**
 * Halaqa live audio: a full mesh of audio-only peer connections, one per
 * other participant, signalled over the room's Socket.IO channel (the server
 * relays only between sockets in the same room).
 *
 * Who offers: when someone joins, every member already in the room offers to
 * them, and the newcomer only answers. So two peers never offer to each other
 * at once. ICE trickles both ways, and candidates that arrive before the remote
 * description is set are queued. With no microphone (or permission refused)
 * the user still joins and listens.
 */
export function useWebRTC(socket: Socket | null, roomId: string, userId: string) {
  const [state, setState] = useState<WebRTCState>({
    isConnected: false,
    isMuted: false,
    remoteParticipants: [],
    error: null,
  });

  const joinedRef = useRef(false);
  const localRef = useRef<LocalStream | null>(null);
  const peersRef = useRef(new Map<string, Peer>());

  const setParticipants = () => setState((s) => ({ ...s, remoteParticipants: Array.from(peersRef.current.keys()) }));

  const closePeer = useCallback((peerId: string) => {
    const peer = peersRef.current.get(peerId);
    if (!peer) return;
    peer.pc.close();
    peersRef.current.delete(peerId);
    detachRemoteAudio(peerId);
    setParticipants();
  }, []);

  const getPeer = useCallback(
    (peerId: string): Peer => {
      const existing = peersRef.current.get(peerId);
      if (existing) return existing;

      const pc = createPeerConnection();
      const local = localRef.current;
      if (local) {
        for (const track of local.getAudioTracks()) pc.addTrack(track, local);
      } else {
        pc.addTransceiver('audio', { direction: 'recvonly' }); // listen-only
      }

      pc.addEventListener('icecandidate', (e: RTCPeerConnectionIceEvent) => {
        if (!e.candidate || !socket) return;
        const { candidate, sdpMid, sdpMLineIndex } = e.candidate;
        socket.emit('halaqa:ice-candidate', {
          roomId,
          targetUserId: peerId,
          candidate: { candidate, sdpMid, sdpMLineIndex },
        });
      });
      pc.addEventListener('track', (e: RTCTrackEvent) => {
        const stream = e.streams[0];
        if (stream) attachRemoteAudio(peerId, stream);
      });
      pc.addEventListener('connectionstatechange', () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') closePeer(peerId);
      });

      const peer: Peer = { pc, pendingIce: [] };
      peersRef.current.set(peerId, peer);
      setParticipants();
      return peer;
    },
    [socket, roomId, closePeer]
  );

  const flushIce = async (peer: Peer) => {
    const queued = peer.pendingIce.splice(0);
    for (const c of queued) await peer.pc.addIceCandidate(toCandidate(c)).catch(() => undefined);
  };

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
    for (const id of Array.from(peersRef.current.keys())) closePeer(id);
    setState({ isConnected: false, isMuted: false, remoteParticipants: [], error: null });
  }, [socket, roomId, closePeer]);

  const toggleMute = useCallback(() => {
    setState((s) => {
      const muted = !s.isMuted;
      for (const track of localRef.current?.getAudioTracks() ?? []) track.enabled = !muted;
      return { ...s, isMuted: muted };
    });
  }, []);

  useEffect(() => {
    if (!socket) return;
    let active = true;

    // Someone joined after us: we offer to them.
    const handleParticipantJoined = async (payload: { roomId: string; userId: string }) => {
      if (payload.roomId !== roomId || payload.userId === userId) return;
      const { pc } = getPeer(payload.userId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('halaqa:offer', { roomId, targetUserId: payload.userId, sdp: plainDescription(pc.localDescription) });
    };

    // We joined after them: they offer, we answer.
    const handleOffer = async (payload: SdpPayload) => {
      if (payload.roomId !== roomId || !payload.sdp) return;
      const peer = getPeer(payload.fromUserId);
      await peer.pc.setRemoteDescription(toDescription(payload.sdp));
      await flushIce(peer);
      const answer = await peer.pc.createAnswer();
      await peer.pc.setLocalDescription(answer);
      socket.emit('halaqa:answer', {
        roomId,
        targetUserId: payload.fromUserId,
        sdp: plainDescription(peer.pc.localDescription),
      });
    };

    const handleAnswer = async (payload: SdpPayload) => {
      if (payload.roomId !== roomId || !payload.sdp) return;
      const peer = peersRef.current.get(payload.fromUserId);
      if (!peer) return;
      await peer.pc.setRemoteDescription(toDescription(payload.sdp));
      await flushIce(peer);
    };

    const handleIce = async (payload: IcePayload) => {
      if (payload.roomId !== roomId || !payload.candidate) return;
      const peer = getPeer(payload.fromUserId);
      if (peer.pc.remoteDescription)
        await peer.pc.addIceCandidate(toCandidate(payload.candidate)).catch(() => undefined);
      else peer.pendingIce.push(payload.candidate);
    };

    const handleParticipantLeft = (payload: { roomId: string; userId: string }) => {
      if (payload.roomId === roomId) closePeer(payload.userId);
    };

    const handleError = (payload: { message?: string }) => {
      setState((s) => ({ ...s, error: payload?.message ?? 'halaqa error' }));
    };

    const guard =
      <T>(fn: (p: T) => Promise<void> | void) =>
      (p: T) => {
        Promise.resolve(fn(p)).catch((err) =>
          setState((s) => ({ ...s, error: err instanceof Error ? err.message : String(err) }))
        );
      };
    const onJoined = guard(handleParticipantJoined);
    const onOffer = guard(handleOffer);
    const onAnswer = guard(handleAnswer);
    const onIce = guard(handleIce);

    socket.on('halaqa:participant-joined', onJoined);
    socket.on('halaqa:offer', onOffer);
    socket.on('halaqa:answer', onAnswer);
    socket.on('halaqa:ice-candidate', onIce);
    socket.on('halaqa:participant-left', handleParticipantLeft);
    socket.on('halaqa:error', handleError);

    // Get the mic first, so our first offer or answer already carries audio.
    getLocalAudio()
      .then((stream) => {
        if (!active) return stream.getTracks().forEach((t) => t.stop());
        localRef.current = stream;
      })
      .catch(() => {
        if (active) setState((s) => ({ ...s, error: 'microphone unavailable: listening only' }));
      })
      .finally(() => {
        if (active) joinRoom();
      });

    return () => {
      active = false;
      socket.off('halaqa:participant-joined', onJoined);
      socket.off('halaqa:offer', onOffer);
      socket.off('halaqa:answer', onAnswer);
      socket.off('halaqa:ice-candidate', onIce);
      socket.off('halaqa:participant-left', handleParticipantLeft);
      socket.off('halaqa:error', handleError);
      leaveRoom();
      localRef.current?.getTracks().forEach((t) => t.stop());
      localRef.current = null;
    };
  }, [socket, roomId, userId, getPeer, closePeer, joinRoom, leaveRoom]);

  return { ...state, joinRoom, leaveRoom, toggleMute };
}
