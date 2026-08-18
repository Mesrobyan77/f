import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import type { SyncChatMessage } from "../types";

interface SyncPlayChatProps {
  messages: SyncChatMessage[];
  onSend: (text: string) => void;
}

export default function SyncPlayChat({ messages, onSend }: SyncPlayChatProps) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map((msg) => {
          const isOwn = typeof msg.sender === "object" && msg.sender._id === user?._id;
          const senderName = typeof msg.sender === "object" ? msg.sender.username : "";
          return (
            <div key={msg._id} className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
              {!isOwn && <span className="text-[10px] text-gray-500 mb-0.5">{senderName}</span>}
              <div className={`px-3 py-1.5 rounded-xl text-sm max-w-[85%] ${
                isOwn ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-200"
              }`}>
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-2 border-t border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Chat during playback..."
            className="flex-1 bg-gray-800 text-gray-200 text-sm rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim()}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
