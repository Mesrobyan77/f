import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import type { CallType } from "../types";

interface CallModalProps {
  callType: CallType;
  callerName: string;
  callerSocketId: string;
  isIncoming: boolean;
  onAccept: () => void;
  onEnd: () => void;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const CALL_TIMEOUT_MS = 30000;

export default function CallModal({
  callType,
  callerName,
  callerSocketId,
  isIncoming,
  onAccept,
  onEnd,
}: CallModalProps) {
  const { socket } = useAuth();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const [callActive, setCallActive] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [status, setStatus] = useState<string>(
    isIncoming ? "Connecting..." : "Ringing..."
  );

  const cleanup = useCallback(() => {
    localStream.current?.getTracks().forEach((t) => t.stop());
    peerConnection.current?.close();
    peerConnection.current = null;
    localStream.current = null;
    setCallActive(false);
    setCallDuration(0);
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (callActive) {
      interval = setInterval(() => setCallDuration((d) => d + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [callActive]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const startMedia = async (withVideo: boolean) => {
    const constraints: MediaStreamConstraints = {
      audio: true,
      video: withVideo,
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    localStream.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
    return stream;
  };

  const createPeerConnection = (stream: MediaStream | null) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnection.current = pc;

    if (stream) {
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });
    }

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit("relay_ice", {
          targetSocketId: callerSocketId,
          candidate: event.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setCallActive(true);
        setStatus("Connected");
      }
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        setStatus("Call ended");
        setTimeout(() => {
          cleanup();
          onEnd();
        }, 1500);
      }
    };

    return pc;
  };

  const getMedia = async (withVideo: boolean): Promise<MediaStream | null> => {
    try {
      return await startMedia(withVideo);
    } catch {
      if (withVideo) {
        try {
          return await startMedia(false);
        } catch {
          return null;
        }
      }
      return null;
    }
  };

  useEffect(() => {
    if (!socket) return;

    let cancelled = false;

    if (isIncoming) {
      let pendingOffer: RTCSessionDescriptionInit | null = null;

      const applyOffer = async (offer: RTCSessionDescriptionInit) => {
        const pc = peerConnection.current;
        if (!pc) return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("relay_answer", {
            targetSocketId: callerSocketId,
            answer,
          });
        } catch (err) {
          console.error("Failed to handle offer:", err);
        }
      };

      const handleCallOffer = async (data: { offer: RTCSessionDescriptionInit }) => {
        if (cancelled) return;
        if (peerConnection.current) {
          await applyOffer(data.offer);
        } else {
          pendingOffer = data.offer;
        }
      };

      const handleIceCandidate = (data: { candidate: RTCIceCandidateInit }) => {
        const pc = peerConnection.current;
        if (pc && pc.signalingState !== "closed") {
          pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      };

      const handleCallEnded = () => {
        if (!cancelled) {
          setStatus("Call ended by caller");
          setTimeout(() => {
            cleanup();
            onEnd();
          }, 1500);
        }
      };

      socket.on("call_offer", handleCallOffer);
      socket.on("ice_candidate", handleIceCandidate);
      socket.on("call_ended", handleCallEnded);

      socket.emit("accept_call", { callerSocketId, callType });
      onAccept();

      getMedia(callType === "video").then((stream) => {
        if (cancelled) {
          stream?.getTracks().forEach((t) => t.stop());
          return;
        }
        createPeerConnection(stream);
        if (pendingOffer) {
          applyOffer(pendingOffer);
          pendingOffer = null;
        }
      });

      return () => {
        cancelled = true;
        socket.off("call_offer", handleCallOffer);
        socket.off("ice_candidate", handleIceCandidate);
        socket.off("call_ended", handleCallEnded);
        cleanup();
      };
    } else {
      const handleCallAnswer = async (data: { answer: RTCSessionDescriptionInit }) => {
        if (cancelled) return;
        const pc = peerConnection.current;
        if (!pc) return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        } catch (err) {
          console.error("Failed to handle answer:", err);
        }
      };

      const handleIceCandidate = (data: { candidate: RTCIceCandidateInit }) => {
        const pc = peerConnection.current;
        if (pc && pc.signalingState !== "closed") {
          pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      };

      const handleCallRejected = () => {
        if (!cancelled) {
          setStatus("Call rejected");
          setTimeout(() => {
            cleanup();
            onEnd();
          }, 1500);
        }
      };

      const handleCallEnded = () => {
        if (!cancelled) {
          setStatus("Call ended");
          setTimeout(() => {
            cleanup();
            onEnd();
          }, 1500);
        }
      };

      socket.on("call_answer", handleCallAnswer);
      socket.on("ice_candidate", handleIceCandidate);
      socket.on("call_rejected", handleCallRejected);
      socket.on("call_ended", handleCallEnded);

      getMedia(callType === "video").then(async (stream) => {
        if (cancelled) {
          stream?.getTracks().forEach((t) => t.stop());
          return;
        }
        setStatus("Connecting...");
        const pc = createPeerConnection(stream);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("relay_offer", {
          targetSocketId: callerSocketId,
          offer,
        });
      });

      const timeout = setTimeout(() => {
        if (!cancelled && !callActive) {
          setStatus("Not answered");
          setTimeout(() => {
            cleanup();
            onEnd();
          }, 1500);
        }
      }, CALL_TIMEOUT_MS);

      return () => {
        cancelled = true;
        clearTimeout(timeout);
        socket.off("call_answer", handleCallAnswer);
        socket.off("ice_candidate", handleIceCandidate);
        socket.off("call_rejected", handleCallRejected);
        socket.off("call_ended", handleCallEnded);
        cleanup();
      };
    }
  }, []);

  const handleEnd = () => {
    if (socket) {
      socket.emit("end_call", { targetSocketId: callerSocketId });
    }
    cleanup();
    onEnd();
  };

  const toggleMute = () => {
    if (localStream.current) {
      localStream.current.getAudioTracks().forEach((t) => {
        t.enabled = muted;
      });
      setMuted(!muted);
    }
  };

  const toggleVideo = () => {
    if (localStream.current) {
      localStream.current.getVideoTracks().forEach((t) => {
        t.enabled = videoOff;
      });
      setVideoOff(!videoOff);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-lg border border-gray-700">
        <div className="text-center mb-6">
          {callActive && (
            <p className="text-green-400 text-sm mb-1">
              {formatDuration(callDuration)}
            </p>
          )}
          <h3 className="text-white text-lg font-semibold">
            {isIncoming ? `Incoming ${callType} call` : `Calling ${callerName}...`}
          </h3>
          <p className={`text-sm mt-1 ${
            status === "Connected"
              ? "text-green-400"
              : status.includes("rejected") || status.includes("ended") || status.includes("Not answered")
              ? "text-red-400"
              : "text-gray-400"
          }`}>
            {status}
          </p>
        </div>

        <div className="relative bg-gray-800 rounded-xl overflow-hidden mb-6 aspect-video">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="absolute bottom-2 right-2 w-28 h-20 rounded-lg object-cover border-2 border-gray-600"
          />
        </div>

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={toggleMute}
            className={`p-3 rounded-full transition-colors ${
              muted ? "bg-red-500 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={
                  muted
                    ? "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m-4-8a3 3 0 016 0v3a3 3 0 01-6 0v-3z M1 1l22 22"
                    : "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m-4-8a3 3 0 016 0v3a3 3 0 01-6 0v-3z"
                }
              />
            </svg>
          </button>

          {callType === "video" && (
            <button
              onClick={toggleVideo}
              className={`p-3 rounded-full transition-colors ${
                videoOff
                  ? "bg-red-500 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </button>
          )}

          <button
            onClick={handleEnd}
            className="p-3 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
