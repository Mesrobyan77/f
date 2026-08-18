import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import SyncPlayChat from "./SyncPlayChat";
import SyncPlayQueue from "./SyncPlayQueue";
import type { SyncSession, SyncQueueItem, SyncChatMessage } from "../types";

interface SyncPlayPanelProps {
  session: SyncSession;
  onClose: () => void;
  onStart: (url: string) => void;
}

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

export default function SyncPlayPanel({ session, onClose, onStart }: SyncPlayPanelProps) {
  const { socket, user } = useAuth();
  const [showQueue, setShowQueue] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [isPlaying, setIsPlaying] = useState(session.isPlaying);
  const [currentTime, setCurrentTime] = useState(session.currentTime);
  const [volume, setVolume] = useState(80);
  const [queue, setQueue] = useState<SyncQueueItem[]>(session.queue);
  const [chatMessages, setChatMessages] = useState<SyncChatMessage[]>(session.chat);
  const [newUrl, setNewUrl] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const playerRef = useRef<HTMLIFrameElement>(null);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const postMessage = useCallback((command: string, args?: any[]) => {
    const iframe = playerRef.current;
    if (!iframe) return;
    iframe.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func: command, args: args || [] }),
      "*"
    );
  }, []);

  useEffect(() => {
    setIsPlaying(session.isPlaying);
    setCurrentTime(session.currentTime);
    setQueue(session.queue);
    setChatMessages(session.chat);
  }, [session]);

  useEffect(() => {
    if (!socket) return;

    const handleAction = (data: { action: string; currentTime: number; userId: string }) => {
      if (data.userId === user?._id) return;
      setCurrentTime(data.currentTime);
      if (data.action === "play") {
        setIsPlaying(true);
        postMessage("seekTo", [data.currentTime, true]);
        setTimeout(() => postMessage("playVideo"), 200);
      } else if (data.action === "pause") {
        setIsPlaying(false);
        postMessage("pauseVideo");
      } else if (data.action === "seek") {
        postMessage("seekTo", [data.currentTime, true]);
      }
    };

    const handleState = (data: { session: SyncSession }) => {
      setIsPlaying(data.session.isPlaying);
      setCurrentTime(data.session.currentTime);
      setQueue(data.session.queue);
      setChatMessages(data.session.chat);
    };

    const handleQueue = (data: { queue: SyncQueueItem[] }) => {
      setQueue(data.queue);
    };

    const handleChat = (data: { message: SyncChatMessage }) => {
      setChatMessages((prev) => [...prev, data.message]);
    };

    const handleEnded = () => {
      onClose();
    };

    socket.on("syncplay:action", handleAction);
    socket.on("syncplay:state", handleState);
    socket.on("syncplay:queue", handleQueue);
    socket.on("syncplay:chat", handleChat);
    socket.on("syncplay:ended", handleEnded);

    return () => {
      socket.off("syncplay:action", handleAction);
      socket.off("syncplay:state", handleState);
      socket.off("syncplay:queue", handleQueue);
      socket.off("syncplay:chat", handleChat);
      socket.off("syncplay:ended", handleEnded);
    };
  }, [socket, user?._id, onClose, postMessage]);

  useEffect(() => {
    if (isPlaying) {
      syncIntervalRef.current = setInterval(() => {
        setCurrentTime((prev) => prev + 1);
      }, 1000);
    } else if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
    }
    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [isPlaying]);

  useEffect(() => {
    return () => {
      if (socket) {
        socket.emit("syncplay:leave", { conversationId: session.conversation });
      }
    };
  }, [socket, session.conversation]);

  const handlePlay = () => {
    setIsPlaying(true);
    postMessage("playVideo");
    socket?.emit("syncplay:play", { conversationId: session.conversation, currentTime });
  };

  const handlePause = () => {
    setIsPlaying(false);
    postMessage("pauseVideo");
    socket?.emit("syncplay:pause", { conversationId: session.conversation, currentTime });
  };

  const handleSeek = (time: number) => {
    setCurrentTime(time);
    postMessage("seekTo", [time, true]);
    socket?.emit("syncplay:seek", { conversationId: session.conversation, currentTime: time });
  };

  const handleVolumeChange = (v: number) => {
    setVolume(v);
    postMessage("setVolume", [v]);
  };

  const handleAddToQueue = (url: string) => {
    const videoId = extractYouTubeId(url);
    if (!videoId) return;
    socket?.emit("syncplay:add", { conversationId: session.conversation, url, title: "" });
  };

  const handleRemoveFromQueue = (queueId: string) => {
    socket?.emit("syncplay:remove", { conversationId: session.conversation, queueId });
  };

  const handleNext = () => {
    socket?.emit("syncplay:next", { conversationId: session.conversation });
  };

  const handleSendChat = (text: string) => {
    socket?.emit("syncplay:chat", { conversationId: session.conversation, text });
  };

  const handleStartNew = () => {
    if (!newUrl.trim() || !extractYouTubeId(newUrl.trim())) return;
    onStart(newUrl.trim());
    setNewUrl("");
    setShowUrlInput(false);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 bg-black/95 flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-white font-semibold text-sm">Watch Together</span>
          <span className="text-gray-400 text-xs">{session.participants.length} watching</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowUrlInput(!showUrlInput)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors"
          >
            Change Video
          </button>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* URL input (collapsible) */}
      {showUrlInput && (
        <div className="px-4 py-3 bg-gray-900 border-b border-gray-800">
          <div className="flex gap-2">
            <input
              type="text"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleStartNew()}
              placeholder="Paste YouTube URL..."
              className="flex-1 bg-gray-800 text-gray-200 text-sm rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleStartNew}
              disabled={!newUrl.trim() || !extractYouTubeId(newUrl.trim())}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
            >
              Play
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Player area */}
        <div className="flex-1 flex flex-col">
          {/* YouTube iframe */}
          <div className="flex-1 flex items-center justify-center bg-black">
            <iframe
              ref={playerRef}
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${session.videoId}?enablejsapi=1&origin=${window.location.origin}&controls=0&modestbranding=1&rel=0`}
              allow="autoplay; encrypted-media"
              allowFullScreen
              className="w-full h-full max-h-[70vh]"
              title="SyncPlay Player"
            />
          </div>

          {/* Controls */}
          <div className="bg-gray-900 px-4 py-3">
            {/* Progress bar */}
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs text-gray-400 w-10 text-right">{formatTime(currentTime)}</span>
              <input
                type="range"
                min={0}
                max={300}
                value={currentTime}
                onChange={(e) => handleSeek(Number(e.target.value))}
                className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <span className="text-xs text-gray-400 w-10">{formatTime(currentTime)}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Play/Pause */}
                <button
                  onClick={isPlaying ? handlePause : handlePlay}
                  className="p-2 text-white hover:bg-gray-800 rounded-full transition-colors"
                >
                  {isPlaying ? (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>

                {/* Volume */}
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={volume}
                    onChange={(e) => handleVolumeChange(Number(e.target.value))}
                    className="w-20 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Queue toggle */}
                <button
                  onClick={() => { setShowQueue(!showQueue); setShowChat(false); }}
                  className={`p-2 rounded-lg transition-colors ${showQueue ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}
                  title="Queue"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </button>

                {/* Chat toggle */}
                <button
                  onClick={() => { setShowChat(!showChat); setShowQueue(false); }}
                  className={`p-2 rounded-lg transition-colors ${showChat ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}
                  title="Chat"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebars */}
        {showQueue && (
          <div className="w-72 border-l border-gray-800 bg-gray-900">
            <SyncPlayQueue
              queue={queue}
              onAdd={handleAddToQueue}
              onRemove={handleRemoveFromQueue}
              onNext={handleNext}
            />
          </div>
        )}

        {showChat && (
          <div className="w-72 border-l border-gray-800 bg-gray-900">
            <SyncPlayChat messages={chatMessages} onSend={handleSendChat} />
          </div>
        )}
      </div>
    </div>
  );
}
