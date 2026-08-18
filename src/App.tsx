import { useState, useEffect, useCallback } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import CallModal from "./components/CallModal";
import IncomingCall from "./components/IncomingCall";
import type { CallType } from "./types";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }
  return user ? <>{children}</> : <Navigate to="/login" />;
}

function ChatApp() {
  const { socket, user } = useAuth();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [activeCall, setActiveCall] = useState<{
    type: CallType;
    targetUserId: string;
    targetName: string;
    callerSocketId: string;
    isIncoming: boolean;
  } | null>(null);

  const [outgoingCall, setOutgoingCall] = useState<{
    type: CallType;
    targetName: string;
    targetUserId: string;
  } | null>(null);

  const [outgoingCallStatus, setOutgoingCallStatus] = useState<string>("");

  const [replyTo, setReplyTo] = useState<any>(null);

  const handleCall = useCallback((targetUserId: string, targetName: string, callType: CallType) => {
    if (!socket || !user) return;
    setOutgoingCall({ type: callType, targetName, targetUserId });
    setOutgoingCallStatus("Ringing...");
    socket.emit("call_user", {
      targetUserId,
      callerName: user.username,
      callType,
    });
  }, [socket, user]);

  const cancelOutgoingCall = useCallback(() => {
    setOutgoingCall(null);
    setOutgoingCallStatus("");
  }, []);

  const handleIncomingAccept = useCallback((callType: CallType, callerSocketId: string) => {
    setActiveCall({
      type: callType,
      targetUserId: "",
      targetName: "",
      callerSocketId,
      isIncoming: true,
    });
  }, []);

  useEffect(() => {
    if (!socket || !outgoingCall) return;

    const handleCallAccepted = (data: { callType: CallType; socketId: string }) => {
      setActiveCall({
        type: outgoingCall.type,
        targetUserId: outgoingCall.targetUserId,
        targetName: outgoingCall.targetName,
        callerSocketId: data.socketId,
        isIncoming: false,
      });
      setOutgoingCall(null);
      setOutgoingCallStatus("");
    };

    const handleCallRejected = () => {
      setOutgoingCallStatus("Call rejected");
      setTimeout(() => {
        setOutgoingCall(null);
        setOutgoingCallStatus("");
      }, 1500);
    };

    const handleCallEnded = () => {
      setOutgoingCallStatus("Call ended");
      setTimeout(() => {
        setOutgoingCall(null);
        setOutgoingCallStatus("");
      }, 1500);
    };

    socket.on("call_accepted", handleCallAccepted);
    socket.on("call_rejected", handleCallRejected);
    socket.on("call_ended", handleCallEnded);

    const timeout = setTimeout(() => {
      setOutgoingCallStatus("Not answered");
      setTimeout(() => {
        setOutgoingCall(null);
        setOutgoingCallStatus("");
      }, 1500);
    }, 30000);

    return () => {
      clearTimeout(timeout);
      socket.off("call_accepted", handleCallAccepted);
      socket.off("call_rejected", handleCallRejected);
      socket.off("call_ended", handleCallEnded);
    };
  }, [socket, outgoingCall]);

  return (
    <div className="flex h-screen bg-gray-950 text-white dark:bg-gray-950 light:bg-white light:text-gray-900">
      <IncomingCall
        onAccept={handleIncomingAccept}
        onReject={() => {}}
      />

      {outgoingCall && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 md:p-8 w-full max-w-sm border border-gray-700 text-center">
            <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {outgoingCall.type === "video" ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                )}
              </svg>
            </div>
            <h3 className="text-white text-lg font-semibold">Calling {outgoingCall.targetName}...</h3>
            <p className={`text-sm mt-1 ${
              outgoingCallStatus.includes("rejected") || outgoingCallStatus.includes("Not answered") || outgoingCallStatus.includes("ended")
                ? "text-red-400"
                : "text-gray-400"
            }`}>
              {outgoingCallStatus}
            </p>
            <button
              onClick={cancelOutgoingCall}
              className="mt-6 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {activeCall && (
        <CallModal
          callType={activeCall.type}
          callerName={activeCall.targetName}
          callerSocketId={activeCall.callerSocketId}
          isIncoming={activeCall.isIncoming}
          onAccept={() => {}}
          onEnd={() => setActiveCall(null)}
        />
      )}

      <div className={`${showChat ? "hidden" : "flex"} md:flex w-full md:w-80 flex-shrink-0`}>
        <Sidebar
          activeId={activeId}
          onSelect={(id) => {
            setActiveId(id);
            setShowChat(true);
          }}
        />
      </div>

      <div className={`${showChat ? "flex" : "hidden"} md:flex flex-1 flex-col h-full min-w-0`}>
        {activeId ? (
          <ChatWindow
            conversationId={activeId}
            onCall={handleCall}
            replyTo={replyTo}
            setReplyTo={setReplyTo}
            onBack={() => setShowChat(false)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-950">
            <div className="text-center text-gray-500">
              <svg
                className="w-16 h-16 mx-auto mb-4 opacity-50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <p className="text-lg">Select a conversation to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <ChatApp />
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
