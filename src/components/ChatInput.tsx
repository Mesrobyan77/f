import { useState, useRef, useCallback, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import type { Message } from "../types";

interface ChatInputProps {
  conversationId: string;
  replyTo: Message | null;
  onClearReply: () => void;
  members?: { user: { _id: string; username: string } | string }[];
}

const EMOJI_LIST = [
  "😀", "😂", "😍", "🥰", "😊", "🤗", "😎", "🤔",
  "👍", "👎", "❤️", "🔥", "💯", "✅", "🎉", "😢",
  "😡", "🤝", "👋", "🙏", "💪", "👏", "🥺", "😘",
  "🤩", "😴", "🤯", "💀", "👻", "🤖", "👽", "🎃",
];

export default function ChatInput({ conversationId, replyTo, onClearReply, members }: ChatInputProps) {
  const { socket } = useAuth();
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [ttl, setTtl] = useState(0);
  const [recording, setRecording] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [videoRecording, setVideoRecording] = useState(false);
  const [videoCountdown, setVideoCountdown] = useState(0);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const videoCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(`draft_${conversationId}`);
    if (saved) setText(saved);
    else setText("");
  }, [conversationId]);

  useEffect(() => {
    if (!socket) return;
    const timeout = setTimeout(() => {
      socket.emit("save_draft", { conversationId, text });
    }, 1000);
    return () => clearTimeout(timeout);
  }, [text, conversationId, socket]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmoji(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSend = (media?: { type: string; url: string; name: string; size: number }) => {
    const trimmed = text.trim();
    if (!trimmed && !media || !socket) return;

    const data: Record<string, any> = {
      conversationId,
      text: trimmed,
    };

    if (replyTo) {
      data.replyTo = replyTo._id;
    }

    if (ttl > 0) {
      data.ttl = ttl;
    }

    const mentionRegex = /@(\w+)/g;
    const mentionMatches = trimmed.match(mentionRegex);
    if (mentionMatches && members) {
      const mentionedIds: string[] = [];
      mentionMatches.forEach((match) => {
        const username = match.slice(1);
        const member = members.find(
          (m) =>
            typeof m.user === "object" &&
            m.user.username.toLowerCase() === username.toLowerCase()
        );
        if (member && typeof member.user === "object") {
          mentionedIds.push(member.user._id);
        }
      });
      if (mentionedIds.length > 0) {
        data.mentions = mentionedIds;
      }
    }

    if (media) {
      data.media = media;
    }

    socket.emit("send_message", data);
    setText("");
    setTtl(0);
    onClearReply();
    localStorage.removeItem(`draft_${conversationId}`);
    socket.emit("stop_typing", { conversationId });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape") {
      onClearReply();
      setShowEmoji(false);
      setShowMentions(false);
      setShowMoreMenu(false);
    }
  };

  const handleTyping = useCallback(() => {
    if (!socket) return;
    socket.emit("typing", { conversationId });

    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit("stop_typing", { conversationId });
    }, 2000);
  }, [socket, conversationId]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    handleTyping();

    const lastAt = val.lastIndexOf("@");
    if (lastAt !== -1 && lastAt === val.length - 1) {
      setShowMentions(true);
      setMentionFilter("");
    } else if (lastAt !== -1) {
      const afterAt = val.slice(lastAt + 1);
      if (!afterAt.includes(" ")) {
        setShowMentions(true);
        setMentionFilter(afterAt);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  };

  const handleMentionSelect = (username: string) => {
    const lastAt = text.lastIndexOf("@");
    const newText = text.slice(0, lastAt) + "@" + username + " ";
    setText(newText);
    setShowMentions(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      let type: "image" | "video" | "audio" | "file" = "file";
      if (file.type.startsWith("image/")) type = "image";
      else if (file.type.startsWith("video/")) type = "video";
      else if (file.type.startsWith("audio/")) type = "audio";

      handleSend({
        type,
        url: base64,
        name: file.name,
        size: file.size,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Voice recording
  const startRecording = async () => {
    setShowMoreMenu(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onload = () => {
          handleSend({
            type: "voice",
            url: reader.result as string,
            name: "voice-message",
            size: blob.size,
          });
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      console.error("Microphone access denied:", err);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  // Round video recording (Telegram-style video note)
  const startVideoRecording = async () => {
    setShowMoreMenu(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 360, height: 360, facingMode: "user" },
        audio: true,
      });
      videoStreamRef.current = stream;

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      videoRecorderRef.current = mediaRecorder;
      videoChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) videoChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(videoChunksRef.current, { type: "video/webm" });
        const reader = new FileReader();
        reader.onload = () => {
          handleSend({
            type: "video_message",
            url: reader.result as string,
            name: "video-message",
            size: blob.size,
          });
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
        setVideoRecording(false);
        setVideoCountdown(0);
      };

      mediaRecorder.start();
      setVideoRecording(true);
      setVideoCountdown(0);

      videoCountdownRef.current = setInterval(() => {
        setVideoCountdown((prev) => {
          if (prev >= 60) {
            stopVideoRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error("Camera access denied:", err);
    }
  };

  const stopVideoRecording = () => {
    if (videoCountdownRef.current) {
      clearInterval(videoCountdownRef.current);
      videoCountdownRef.current = null;
    }
    videoRecorderRef.current?.stop();
  };

  const cancelVideoRecording = () => {
    if (videoCountdownRef.current) {
      clearInterval(videoCountdownRef.current);
      videoCountdownRef.current = null;
    }
    videoStreamRef.current?.getTracks().forEach((t) => t.stop());
    videoRecorderRef.current?.stop();
    setVideoRecording(false);
    setVideoCountdown(0);
    videoChunksRef.current = [];
  };

  const formatVideoTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const filteredMembers = members?.filter((m) => {
    if (typeof m.user !== "object") return false;
    return m.user.username.toLowerCase().includes(mentionFilter.toLowerCase());
  });

  const ttlOptions = [
    { value: 0, label: "Off" },
    { value: 30, label: "30s" },
    { value: 60, label: "1m" },
    { value: 300, label: "5m" },
  ];

  const nextTtl = () => {
    const idx = ttlOptions.findIndex((t) => t.value === ttl);
    const next = ttlOptions[(idx + 1) % ttlOptions.length];
    setTtl(next.value);
    setShowMoreMenu(false);
  };

  return (
    <div className="p-2 md:p-4 border-t border-gray-700 bg-gray-900">
      {replyTo && (
        <div className="mb-2 px-3 py-2 bg-gray-800 rounded-lg flex items-center justify-between border-l-2 border-blue-500">
          <div className="min-w-0">
            <p className="text-xs text-blue-400 font-semibold">
              Reply to {typeof replyTo.sender === "object" ? replyTo.sender.username : ""}
            </p>
            <p className="text-xs text-gray-400 truncate">{replyTo.text}</p>
          </div>
          <button onClick={onClearReply} className="text-gray-500 hover:text-white ml-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {showMentions && filteredMembers && filteredMembers.length > 0 && (
        <div className="mb-2 bg-gray-800 rounded-lg border border-gray-600 max-h-40 overflow-y-auto">
          {filteredMembers.map((m) =>
            typeof m.user === "object" ? (
              <button
                key={m.user._id}
                onClick={() => {
                  if (typeof m.user === "object") handleMentionSelect(m.user.username);
                }}
                className="w-full text-left px-3 py-2 hover:bg-gray-700 text-sm text-white"
              >
                @{m.user.username}
              </button>
            ) : null
          )}
        </div>
      )}

      {showEmoji && (
        <div
          ref={emojiRef}
          className="mb-2 bg-gray-800 rounded-lg border border-gray-600 p-2 grid grid-cols-6 sm:grid-cols-8 gap-1 max-h-48 overflow-y-auto"
        >
          {EMOJI_LIST.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                setText((prev) => prev + emoji);
                setShowEmoji(false);
              }}
              className="p-1.5 hover:bg-gray-700 rounded text-lg hover:scale-110 transition-transform"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Main input row */}
      <div className="flex items-end gap-1.5 md:gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* 3-dot more menu */}
        <div className="relative" ref={moreMenuRef}>
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className={`p-2 rounded-lg transition-colors ${showMoreMenu ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}
            title="More options"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>

          {showMoreMenu && (
            <div className="absolute bottom-full mb-2 left-0 bg-gray-800 border border-gray-600 rounded-xl shadow-2xl py-1.5 w-52 z-50">
              <button
                onClick={() => {
                  if (recording) {
                    stopRecording();
                  } else {
                    startRecording();
                  }
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
              >
                {recording ? (
                  <>
                    <div className="w-5 h-5 flex items-center justify-center">
                      <div className="w-3 h-3 bg-red-500 rounded-sm animate-pulse" />
                    </div>
                    <span className="text-red-400">Stop voice message</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m-4-8a3 3 0 016 0v3a3 3 0 01-6 0v-3z" />
                    </svg>
                    <span>Voice message</span>
                  </>
                )}
              </button>

              <button
                onClick={startVideoRecording}
                disabled={videoRecording}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" strokeWidth={2} />
                  <circle cx="12" cy="12" r="4" fill="currentColor" />
                </svg>
                <span>Video message</span>
              </button>

              <button
                onClick={() => {
                  fileInputRef.current?.click();
                  setShowMoreMenu(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
              >
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <span>Attach file</span>
              </button>

              <div className="border-t border-gray-700 my-1" />

              <button
                onClick={nextTtl}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
              >
                <svg className={`w-5 h-5 ${ttl > 0 ? "text-yellow-400" : "text-gray-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Self-destruct: {ttl === 0 ? "Off" : `${ttl}s`}</span>
              </button>
            </div>
          )}
        </div>

        {/* Emoji button */}
        <button
          onClick={() => setShowEmoji(!showEmoji)}
          className={`p-2 rounded-lg transition-colors ${showEmoji ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}
          title="Emoji"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>

        {/* Textarea */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={recording ? "Recording voice..." : videoRecording ? "Recording video..." : "Type a message..."}
            rows={1}
            disabled={recording || videoRecording}
            className="w-full bg-gray-800 text-gray-200 text-sm rounded-xl px-4 py-3 border border-gray-700 focus:outline-none focus:border-blue-500 transition-colors resize-none disabled:opacity-50"
          />
        </div>

        {/* Send button */}
        <button
          onClick={() => handleSend()}
          disabled={!text.trim() && !recording && !videoRecording}
          className="p-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
          title="Send message"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>

      {/* Voice recording indicator bar */}
      {recording && (
        <div className="mt-2 flex items-center gap-3 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
          <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
          <span className="text-red-400 text-xs font-medium">Recording voice message...</span>
          <div className="flex-1" />
          <button
            onClick={stopRecording}
            className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded-lg transition-colors"
          >
            Stop & Send
          </button>
        </div>
      )}

      {/* Round video recorder overlay */}
      {videoRecording && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="flex flex-col items-center gap-6">
            {/* Timer */}
            <div className="text-white text-2xl font-mono font-bold">
              {formatVideoTime(videoCountdown)}
            </div>

            {/* Circular video preview */}
            <div className="relative">
              <div className="w-56 h-56 md:w-72 md:h-72 rounded-full overflow-hidden border-4 border-gray-600 shadow-2xl">
                <video
                  ref={videoPreviewRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
              </div>
              {/* Pulsing ring while recording */}
              <div className="absolute inset-0 rounded-full border-4 border-red-500 animate-ping opacity-30 pointer-events-none" />
            </div>

            {/* Controls */}
            <div className="flex items-center gap-6">
              <button
                onClick={cancelVideoRecording}
                className="w-14 h-14 bg-gray-700 hover:bg-gray-600 text-white rounded-full flex items-center justify-center transition-colors"
                title="Cancel"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <button
                onClick={stopVideoRecording}
                className="w-20 h-20 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors shadow-lg shadow-red-500/30"
                title="Stop & Send"
              >
                <div className="w-6 h-6 bg-white rounded-sm" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
