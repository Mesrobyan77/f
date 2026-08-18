import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import type { Message } from "../types";

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  onReply?: (message: Message) => void;
  onPin?: (messageId: string) => void;
  onEdit?: (messageId: string, text: string) => void;
  onDelete?: (messageId: string) => void;
  onReact?: (messageId: string, emoji: string) => void;
}

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

export default function MessageBubble({
  message,
  isOwn,
  onReply,
  onPin,
  onEdit,
  onDelete,
  onReact,
}: MessageBubbleProps) {
  const { user, socket } = useAuth();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.text);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const senderName =
    typeof message.sender === "object" ? message.sender.username : "";
  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  useEffect(() => {
    if (!message.expiresAt) return;
    const update = () => {
      const diff = Math.max(
        0,
        Math.floor((new Date(message.expiresAt!).getTime() - Date.now()) / 1000)
      );
      setTimeLeft(diff);
      if (diff <= 0) {
        if (socket) {
          socket.emit("delete_message", { messageId: message._id });
        }
      }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [message.expiresAt, message._id, socket]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSaveEdit = () => {
    if (editText.trim() && onEdit) {
      onEdit(message._id, editText.trim());
      setEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setEditText(message.text);
    setEditing(false);
  };

  if (message.deleted) {
    return (
      <div className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-3`}>
        <div className={`px-4 py-2 rounded-2xl ${isOwn ? "bg-gray-800" : "bg-gray-700/50"}`}>
          <p className="text-sm text-gray-500 italic">Հաղորդագրությունը ջնջված է</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-3 group relative`}
      onClick={() => setShowMenu((v) => !v)}
    >
      <div className="max-w-[85vw] md:max-w-md relative">
        {message.replyTo && typeof message.replyTo === "object" && (
          <div className={`mb-1 px-3 py-1.5 rounded-t-xl text-xs border-l-2 ${
            isOwn
              ? "bg-blue-700/30 border-blue-300 text-blue-200"
              : "bg-gray-600/30 border-gray-400 text-gray-300"
          }`}>
            <span className="font-semibold">
              {typeof message.replyTo.sender === "object"
                ? message.replyTo.sender.username
                : ""}
            </span>
            <p className="truncate opacity-75">{message.replyTo.text}</p>
          </div>
        )}

        <div
          className={`px-4 py-2.5 rounded-2xl ${
            isOwn
              ? "bg-blue-600 text-white rounded-br-md"
              : "bg-gray-700 text-gray-100 rounded-bl-md"
          } ${message.replyTo ? "rounded-t-none" : ""}`}
        >
          {!isOwn && senderName && (
            <p className="text-xs font-semibold text-blue-300 mb-0.5">
              {senderName}
            </p>
          )}

          {message.media && (
            <div className="mb-2">
              {message.media.type === "image" && (
                <img
                  src={message.media.url}
                  alt={message.media.name}
                  className="rounded-lg max-w-full max-h-64 object-cover"
                />
              )}
              {message.media.type === "video" && (
                <video
                  src={message.media.url}
                  controls
                  className="rounded-lg max-w-full max-h-64"
                />
              )}
              {message.media.type === "audio" && (
                <audio src={message.media.url} controls className="w-full" />
              )}
              {message.media.type === "voice" && (
                <audio src={message.media.url} controls className="w-full min-w-[200px]" />
              )}
              {message.media.type === "video_message" && (
                <div className="flex justify-center py-1">
                  <div className="w-48 h-48 rounded-full overflow-hidden border-2 border-gray-500 shadow-lg">
                    <video
                      src={message.media.url}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}
              {message.media.type === "file" && (
                <a
                  href={message.media.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-blue-300 hover:underline"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-sm">{message.media.name || "File"}</span>
                </a>
              )}
              {message.media.type === "gif" && (
                <img
                  src={message.media.url}
                  alt="GIF"
                  className="rounded-lg max-w-full max-h-64 object-cover"
                />
              )}
              {message.media.type === "sticker" && (
                <img
                  src={message.media.url}
                  alt="Sticker"
                  className="w-24 h-24 object-contain"
                />
              )}
            </div>
          )}

          {editing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveEdit();
                  if (e.key === "Escape") handleCancelEdit();
                }}
                className="flex-1 bg-transparent border-b border-white/50 text-white text-sm outline-none"
                autoFocus
              />
              <button onClick={handleSaveEdit} className="text-xs text-green-300 hover:text-green-200">
                Save
              </button>
              <button onClick={handleCancelEdit} className="text-xs text-red-300 hover:text-red-200">
                Cancel
              </button>
            </div>
          ) : (
            <p className="text-sm leading-relaxed">{message.text}</p>
          )}

          <div className="flex items-center gap-1 mt-1">
            <p className={`text-xs ${isOwn ? "text-blue-200" : "text-gray-400"}`}>
              {time}
            </p>
            {message.edited && (
              <p className={`text-xs ${isOwn ? "text-blue-200" : "text-gray-400"}`}>
                (խմբագրված)
              </p>
            )}
            {isOwn && (
              <svg className="w-3.5 h-3.5 text-blue-200" fill="currentColor" viewBox="0 0 24 24">
                {message.read ? (
                  <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z" />
                ) : (
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                )}
              </svg>
            )}
            {timeLeft !== null && timeLeft > 0 && (
              <span className="text-xs text-gray-500 ml-1">
                🕐 {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
              </span>
            )}
          </div>

          {message.reactions && message.reactions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {Object.entries(
                message.reactions.reduce<Record<string, string[]>>((acc, r) => {
                  if (!acc[r.emoji]) acc[r.emoji] = [];
                  acc[r.emoji].push(r.user);
                  return acc;
                }, {})
              ).map(([emoji, users]) => (
                <button
                  key={emoji}
                  onClick={() => onReact?.(message._id, emoji)}
                  className={`px-1.5 py-0.5 rounded-full text-xs border ${
                    users.includes(user?._id || "")
                      ? "bg-blue-500/30 border-blue-400"
                      : "bg-gray-600/30 border-gray-500"
                  } hover:scale-110 transition-transform`}
                >
                  {emoji} {users.length}
                </button>
              ))}
            </div>
          )}
        </div>

        <div
          ref={menuRef}
          className={`absolute top-0 ${isOwn ? "left-0 -translate-x-full -ml-1" : "right-0 translate-x-full mr-1"} opacity-0 group-hover:opacity-100 ${showMenu ? "opacity-100" : ""} transition-opacity z-10`}
        >
          <div className="bg-gray-800 border border-gray-600 rounded-lg shadow-xl flex flex-col p-0.5">
            <button
              onClick={() => onReply?.(message)}
              className="p-1.5 hover:bg-gray-700 rounded text-gray-300 hover:text-white text-xs flex items-center gap-1"
              title="Reply"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </button>
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-1.5 hover:bg-gray-700 rounded text-gray-300 hover:text-white text-xs flex items-center gap-1"
              title="React"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <button
              onClick={() => onPin?.(message._id)}
              className="p-1.5 hover:bg-gray-700 rounded text-gray-300 hover:text-white text-xs flex items-center gap-1"
              title={message.pinned ? "Unpin" : "Pin"}
            >
              <svg className="w-3.5 h-3.5" fill={message.pinned ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </button>
            {isOwn && (
              <>
                <button
                  onClick={() => { setEditing(true); }}
                  className="p-1.5 hover:bg-gray-700 rounded text-gray-300 hover:text-white text-xs flex items-center gap-1"
                  title="Edit"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => { onDelete?.(message._id); }}
                  className="p-1.5 hover:bg-red-600 rounded text-gray-300 hover:text-white text-xs flex items-center gap-1"
                  title="Delete"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </>
            )}
          </div>

          {showEmojiPicker && (
            <div className="bg-gray-800 border border-gray-600 rounded-lg shadow-xl p-1.5 flex gap-0.5 mt-1">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    onReact?.(message._id, emoji);
                    setShowEmojiPicker(false);
                  }}
                  className="p-1 hover:bg-gray-700 rounded text-sm hover:scale-125 transition-transform"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
