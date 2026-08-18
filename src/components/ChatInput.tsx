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
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

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

  const startRecording = async () => {
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

  const filteredMembers = members?.filter((m) => {
    if (typeof m.user !== "object") return false;
    return m.user.username.toLowerCase().includes(mentionFilter.toLowerCase());
  });

  return (
    <div className="p-4 border-t border-gray-700 bg-gray-900">
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
          {filteredMembers.map((m) => (
            typeof m.user === "object" ? (
              <button
                key={m.user._id}
                onClick={() => { if (typeof m.user === "object") handleMentionSelect(m.user.username); }}
                className="w-full text-left px-3 py-2 hover:bg-gray-700 text-sm text-white"
              >
                @{m.user.username}
              </button>
            ) : null
          ))}
        </div>
      )}

      {showEmoji && (
        <div ref={emojiRef} className="mb-2 bg-gray-800 rounded-lg border border-gray-600 p-2 grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
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

      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
          onChange={handleFileUpload}
          className="hidden"
        />

        <div className="flex gap-1">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
            title="Attach file"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>

          <button
            onClick={() => setShowEmoji(!showEmoji)}
            className={`p-2 rounded-lg transition-colors ${showEmoji ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}
            title="Emoji"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          {recording ? (
            <button
              onClick={stopRecording}
              className="p-2 bg-red-500 text-white rounded-lg animate-pulse"
              title="Stop recording"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="1" />
              </svg>
            </button>
          ) : (
            <button
              onClick={startRecording}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
              title="Voice message"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m-4-8a3 3 0 016 0v3a3 3 0 01-6 0v-3z" />
              </svg>
            </button>
          )}

          <div className="relative group">
            <button
              onClick={() => setTtl(ttl === 0 ? 30 : ttl === 30 ? 60 : ttl === 60 ? 300 : 0)}
              className={`p-2 rounded-lg transition-colors ${ttl > 0 ? "bg-yellow-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}
              title={ttl > 0 ? `Self-destruct: ${ttl}s` : "Self-destruct off"}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            {ttl > 0 && (
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] bg-gray-800 text-gray-300 px-1 rounded whitespace-nowrap">
                {ttl}s
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (use @ to mention)"
            rows={1}
            className="w-full bg-gray-800 text-gray-200 text-sm rounded-xl px-4 py-3 border border-gray-700 focus:outline-none focus:border-blue-500 transition-colors resize-none"
          />
        </div>

        <button
          onClick={() => handleSend()}
          disabled={!text.trim()}
          className="p-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
          title="Send message"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  );
}
