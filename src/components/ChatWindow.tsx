import { useRef, useEffect, useState, useCallback } from "react";
import Avatar from "./Avatar";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import { useAuth } from "../context/AuthContext";
import { conversationAPI } from "../services/api";
import type { Message, ConversationData } from "../types";

interface ChatWindowProps {
  conversationId: string;
  onCall: (targetUserId: string, targetName: string, callType: "audio" | "video") => void;
  replyTo: Message | null;
  setReplyTo: (msg: Message | null) => void;
  onBack?: () => void;
}

export default function ChatWindow({ conversationId, onCall, replyTo, setReplyTo, onBack }: ChatWindowProps) {
  const { user, socket } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<ConversationData | null>(null);
  const [typing, setTyping] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showPinned, setShowPinned] = useState(false);
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async (search?: string) => {
    try {
      const res = await conversationAPI.getMessages(conversationId, search);
      setMessages(res.data.messages);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchConversation = async () => {
    try {
      const res = await conversationAPI.getAll();
      const conv = res.data.conversations.find(
        (c: ConversationData) => c._id === conversationId
      );
      setConversation(conv || null);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMessages();
    fetchConversation();
  }, [conversationId]);

  useEffect(() => {
    if (!socket) return;

    socket.emit("mark_read", { conversationId });

    const handleReceiveMessage = (data: { message: Message; conversationId: string }) => {
      if (data.conversationId === conversationId) {
        setMessages((prev) => [...prev, data.message]);
        socket.emit("mark_read", { conversationId });
      }
    };

    const handleTyping = (data: { conversationId: string; username: string }) => {
      if (data.conversationId === conversationId) setTyping(data.username);
    };

    const handleStopTyping = (data: { conversationId: string }) => {
      if (data.conversationId === conversationId) setTyping(null);
    };

    const handleMessagesRead = (data: { conversationId: string }) => {
      if (data.conversationId === conversationId) {
        setMessages((prev) =>
          prev.map((m) =>
            (m.sender as any)?._id === user?._id ? { ...m, read: true } : m
          )
        );
      }
    };

    const handleMessageEdited = (data: { message: Message; conversationId: string }) => {
      if (data.conversationId === conversationId) {
        setMessages((prev) =>
          prev.map((m) => (m._id === data.message._id ? data.message : m))
        );
      }
    };

    const handleMessageDeleted = (data: { messageId: string; conversationId: string }) => {
      if (data.conversationId === conversationId) {
        setMessages((prev) =>
          prev.map((m) =>
            m._id === data.messageId
              ? { ...m, deleted: true, text: "", media: undefined }
              : m
          )
        );
      }
    };

    const handleReactionUpdated = (data: { messageId: string; reactions: any[]; conversationId: string }) => {
      if (data.conversationId === conversationId) {
        setMessages((prev) =>
          prev.map((m) =>
            m._id === data.messageId ? { ...m, reactions: data.reactions } : m
          )
        );
      }
    };

    const handleMessagePinned = (data: { message: Message; conversationId: string; pinned: boolean }) => {
      if (data.conversationId === conversationId) {
        setMessages((prev) =>
          prev.map((m) =>
            m._id === data.message._id ? data.message : m
          )
        );
        fetchConversation();
      }
    };

    socket.on("receive_message", handleReceiveMessage);
    socket.on("user_typing", handleTyping);
    socket.on("user_stop_typing", handleStopTyping);
    socket.on("messages_read", handleMessagesRead);
    socket.on("message_edited", handleMessageEdited);
    socket.on("message_deleted", handleMessageDeleted);
    socket.on("reaction_updated", handleReactionUpdated);
    socket.on("message_pinned", handleMessagePinned);

    return () => {
      socket.off("receive_message", handleReceiveMessage);
      socket.off("user_typing", handleTyping);
      socket.off("user_stop_typing", handleStopTyping);
      socket.off("messages_read", handleMessagesRead);
      socket.off("message_edited", handleMessageEdited);
      socket.off("message_deleted", handleMessageDeleted);
      socket.off("reaction_updated", handleReactionUpdated);
      socket.off("message_pinned", handleMessagePinned);
    };
  }, [socket, conversationId, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      fetchMessages();
      return;
    }
    try {
      const res = await conversationAPI.getMessages(conversationId, searchQuery);
      setSearchResults(res.data.messages);
    } catch (err) {
      console.error(err);
    }
  }, [searchQuery, conversationId]);

  useEffect(() => {
    if (!searchQuery) {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const handleReact = useCallback((messageId: string, emoji: string) => {
    if (socket) socket.emit("add_reaction", { messageId, emoji });
  }, [socket]);

  const handlePin = useCallback((messageId: string) => {
    if (socket) socket.emit("pin_message", { messageId });
  }, [socket]);

  const handleEdit = useCallback((messageId: string, text: string) => {
    if (socket) socket.emit("edit_message", { messageId, text });
  }, [socket]);

  const handleDelete = useCallback((messageId: string) => {
    if (socket) socket.emit("delete_message", { messageId });
  }, [socket]);

  const lastSeen = conversation?.otherUser
    ? new Date((conversation.otherUser as any).lastSeen || Date.now()).toLocaleString()
    : "";

  const displayMessages = searchResults.length > 0 ? searchResults : messages;

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-950">
      {conversation && (
        <>
          <div className="flex items-center gap-2 md:gap-3 px-3 md:px-6 py-3 border-b border-gray-700 bg-gray-900">
            {onBack && (
              <button
                onClick={onBack}
                className="md:hidden p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors -ml-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <Avatar
              initials={conversation.name.charAt(0).toUpperCase()}
              online={conversation.online}
            />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white text-sm truncate">{conversation.name}</h3>
              <p className="text-xs text-gray-400">
                {typing
                  ? `${typing} գրում է...`
                  : conversation.isGroup
                  ? `${conversation.members?.length || 0} members`
                  : conversation.online
                  ? "Online"
                  : `Last seen ${lastSeen}`}
              </p>
            </div>

            {conversation.pinnedMessages && conversation.pinnedMessages.length > 0 && (
              <button
                onClick={() => setShowPinned(!showPinned)}
                className={`hidden sm:block p-2 rounded-lg transition-colors ${showPinned ? "bg-yellow-600 text-white" : "text-yellow-400 hover:bg-gray-800"}`}
                title="Pinned messages"
              >
                <svg className="w-5 h-5" fill={showPinned ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </button>
            )}

            <div className="relative hidden sm:block">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search messages..."
                className="bg-gray-800 text-gray-300 text-xs rounded-lg px-3 py-1.5 border border-gray-700 focus:outline-none focus:border-blue-500 w-40 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(""); setSearchResults([]); fetchMessages(); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {!conversation.isGroup && conversation.otherUser && (
              <div className="flex items-center gap-1 md:gap-2">
                <button
                  onClick={() =>
                    onCall(conversation.otherUser!._id, conversation.name, "audio")
                  }
                  className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800"
                  title="Voice call"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </button>
                <button
                  onClick={() =>
                    onCall(conversation.otherUser!._id, conversation.name, "video")
                  }
                  className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800"
                  title="Video call"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {showPinned && conversation.pinnedMessages && conversation.pinnedMessages.length > 0 && (
            <div className="px-3 md:px-6 py-2 bg-yellow-900/20 border-b border-yellow-700/50">
              <p className="text-xs text-yellow-400 font-semibold mb-1">📌 Pinned Messages</p>
              {conversation.pinnedMessages.map((pm) => (
                <div key={pm._id} className="text-xs text-gray-300 truncate py-0.5">
                  <span className="text-yellow-300">
                    {typeof pm.sender === "object" ? pm.sender.username : ""}:
                  </span>{" "}
                  {pm.text}
                </div>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-3 md:px-6 py-4">
            {displayMessages.map((msg) => (
              <MessageBubble
                key={msg._id}
                message={msg}
                isOwn={
                  typeof msg.sender === "string"
                    ? msg.sender === user?._id
                    : msg.sender._id === user?._id
                }
                onReply={setReplyTo}
                onPin={handlePin}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onReact={handleReact}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>

          <ChatInput
            conversationId={conversationId}
            replyTo={replyTo}
            onClearReply={() => setReplyTo(null)}
            members={conversation.members}
          />
        </>
      )}
    </div>
  );
}
