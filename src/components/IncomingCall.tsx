import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import type { CallType } from "../types";

interface IncomingCallProps {
  onAccept: (callType: CallType, callerSocketId: string) => void;
  onReject: () => void;
}

export default function IncomingCall({ onAccept, onReject }: IncomingCallProps) {
  const { socket } = useAuth();
  const [call, setCall] = useState<{
    callerName: string;
    callerSocketId: string;
    callType: CallType;
  } | null>(null);

  useEffect(() => {
    if (!socket) return;

    socket.on(
      "incoming_call",
      (data: {
        callerId: string;
        callerName: string;
        callType: CallType;
        socketId: string;
      }) => {
        setCall({
          callerName: data.callerName,
          callerSocketId: data.socketId,
          callType: data.callType,
        });
      }
    );

    socket.on("call_accepted", () => setCall(null));
    socket.on("call_rejected", () => setCall(null));
    socket.on("call_ended", () => setCall(null));

    return () => {
      socket.off("incoming_call");
      socket.off("call_accepted");
      socket.off("call_rejected");
      socket.off("call_ended");
    };
  }, [socket]);

  if (!call) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-2xl p-8 w-full max-w-sm border border-gray-700 text-center">
        <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-white animate-pulse"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {call.callType === "video" ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              />
            )}
          </svg>
        </div>
        <h3 className="text-white text-lg font-semibold">{call.callerName}</h3>
        <p className="text-gray-400 text-sm mb-6">
          Incoming {call.callType} call...
        </p>
        <div className="flex gap-4">
          <button
            onClick={() => {
              socket?.emit("reject_call", { callerSocketId: call.callerSocketId });
              onReject();
              setCall(null);
            }}
            className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors"
          >
            Reject
          </button>
          <button
            onClick={() => {
              onAccept(call.callType, call.callerSocketId);
              setCall(null);
            }}
            className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-colors"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
