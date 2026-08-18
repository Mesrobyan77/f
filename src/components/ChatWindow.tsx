import { useRef, useEffect, useState, useCallback } from "react";
import Avatar from "./Avatar";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import PollCard from "./PollCard";
import GroupSettingsPanel from "./GroupSettingsPanel";
import SyncPlayPanel from "./SyncPlayPanel";
import { useAuth } from "../context/AuthContext";
import { conversationAPI } from "../services/api";
import type { Message, ConversationData, SyncSession } from "../types";

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
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [showTopics, setShowTopics] = useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [syncPlaySession, setSyncPlaySession] = useState<SyncSession | null>(null);
  const headerMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async (search?: string, topicId?: string) => {
    try {
      const res = await conversationAPI.getMessages(conversationId, search, topicId);
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
    setActiveTopic(null);
  }, [conversationId]);

  useEffect(() => {
    fetchMessages(undefined, activeTopic === null ? undefined : activeTopic || undefined);
  }, [activeTopic]);

  useEffect(() => {
    if (!socket) return;

    socket.emit("mark_read", { conversationId });

    const handleReceiveMessage = (data: { message: Message; conversationId: string }) => {
      if (data.conversationId === conversationId) {
        if (!activeTopic || data.message.topicId === activeTopic || (activeTopic === "general" && !data.message.topicId)) {
          setMessages((prev) => [...prev, data.message]);
        }
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

    const handlePollUpdated = (data: { poll: any; conversationId: string }) => {
      if (data.conversationId === conversationId) {
        fetchMessages();
      }
    };

    const handleSyncPlayState = (data: { session: SyncSession }) => {
      if (data.session.conversation === conversationId) {
        setSyncPlaySession(data.session);
      }
    };

    const handleSyncPlayEnded = (data: { conversationId: string }) => {
      if (data.conversationId === conversationId) {
        setSyncPlaySession(null);
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
    socket.on("poll_updated", handlePollUpdated);
    socket.on("syncplay:state", handleSyncPlayState);
    socket.on("syncplay:ended", handleSyncPlayEnded);

    return () => {
      socket.off("receive_message", handleReceiveMessage);
      socket.off("user_typing", handleTyping);
      socket.off("user_stop_typing", handleStopTyping);
      socket.off("messages_read", handleMessagesRead);
      socket.off("message_edited", handleMessageEdited);
      socket.off("message_deleted", handleMessageDeleted);
      socket.off("reaction_updated", handleReactionUpdated);
      socket.off("message_pinned", handleMessagePinned);
      socket.off("poll_updated", handlePollUpdated);
      socket.off("syncplay:state", handleSyncPlayState);
      socket.off("syncplay:ended", handleSyncPlayEnded);
    };
  }, [socket, conversationId, user, activeTopic]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        setShowHeaderMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const myMember = conversation?.members?.find((m) => {
    if (typeof m.user === "object") return m.user._id === user?._id;
    return m.user === user?._id;
  });

  const isMuted = myMember?.muted && (!myMember.mutedUntil || new Date(myMember.mutedUntil) > new Date());

  const roleBadge = (role?: string) => {
    if (!role || role === "member") return null;
    const colors: Record<string, string> = {
      owner: "text-yellow-400",
      admin: "text-blue-400",
      moderator: "text-purple-400",
    };
    return (
      <span className={`text-[10px] font-medium ${colors[role] || ""}`}>
        {role === "owner" ? "👑" : role === "admin" ? "🛡️" : "⚡"}
      </span>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-950">
      {conversation && (
        <>
          {/* Header */}
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
              <div className="flex items-center gap-1.5">
                <h3 className="font-semibold text-white text-sm truncate">{conversation.name}</h3>
                {myMember && roleBadge(myMember.role)}
              </div>
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

            {/* Topics toggle for groups */}
            {conversation.isGroup && conversation.topics && conversation.topics.length > 0 && (
              <button
                onClick={() => setShowTopics(!showTopics)}
                className={`hidden sm:block p-2 rounded-lg transition-colors ${showTopics ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-gray-800"}`}
                title="Topics"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              </button>
            )}

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
                ref={searchInputRef}
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

            {/* 3-dot menu for groups */}
            {conversation.isGroup && (
              <div className="relative" ref={headerMenuRef}>
                <button
                  onClick={() => setShowHeaderMenu(!showHeaderMenu)}
                  className={`p-2 rounded-lg transition-colors ${showHeaderMenu ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}
                  title="Group options"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>

                {showHeaderMenu && (
                  <div className="absolute top-full mt-1 right-0 bg-gray-800 border border-gray-600 rounded-xl shadow-2xl py-1.5 w-56 z-50">
                    <button
                      onClick={() => { setShowGroupSettings(true); setShowHeaderMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
                    >
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>Group Settings</span>
                    </button>

                    <button
                      onClick={() => { setShowGroupSettings(true); setShowHeaderMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
                    >
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      <span>Members & Roles</span>
                    </button>

                    <button
                      onClick={() => { setShowGroupSettings(true); setShowHeaderMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
                    >
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <span>Permissions</span>
                    </button>

                    <button
                      onClick={() => { setShowGroupSettings(true); setShowHeaderMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
                    >
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                      </svg>
                      <span>Topics</span>
                    </button>

                    <button
                      onClick={() => { setShowGroupSettings(true); setShowHeaderMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
                    >
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      <span>Invite Links</span>
                    </button>

                    <div className="border-t border-gray-700 my-1" />

                    <button
                      onClick={() => {
                        setShowHeaderMenu(false);
                        const url = prompt("Paste YouTube URL:");
                        if (url) socket?.emit("syncplay:start", { conversationId, url });
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
                    >
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Watch Together</span>
                    </button>

                    <button
                      onClick={() => { setShowHeaderMenu(false); searchInputRef.current?.focus(); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
                    >
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <span>Search Messages</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {!conversation.isGroup && conversation.otherUser && (
              <div className="flex items-center gap-1 md:gap-2">
                <button
                  onClick={() => onCall(conversation.otherUser!._id, conversation.name, "audio")}
                  className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800"
                  title="Voice call"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </button>
                <button
                  onClick={() => onCall(conversation.otherUser!._id, conversation.name, "video")}
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

          {/* Topics sidebar */}
          {showTopics && conversation.topics && (
            <div className="border-b border-gray-700 bg-gray-900/50 px-3 md:px-6 py-2 flex gap-2 overflow-x-auto">
              <button
                onClick={() => setActiveTopic(null)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  activeTopic === null ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setActiveTopic("general")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  activeTopic === "general" ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                # General
              </button>
              {conversation.topics.map((topic) => (
                <button
                  key={topic._id}
                  onClick={() => setActiveTopic(topic._id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    activeTopic === topic._id ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"
                  }`}
                >
                  # {topic.name}
                </button>
              ))}
            </div>
          )}

          {/* Pinned messages */}
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

          {/* Muted warning */}
          {isMuted && (
            <div className="px-3 md:px-6 py-2 bg-yellow-500/10 border-b border-yellow-500/30">
              <p className="text-xs text-yellow-400 text-center">You are muted in this group</p>
            </div>
          )}

          {/* SyncPlay active banner */}
          {syncPlaySession && !syncPlaySession.active && (
            <div className="px-3 md:px-6 py-2 bg-blue-500/10 border-b border-blue-500/30">
              <p className="text-xs text-blue-400 text-center">Session ended</p>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 md:px-6 py-4">
            {displayMessages.map((msg) => {
              if (msg.type === "poll" && msg.media) {
                try {
                  const pollData = JSON.parse(msg.media.url);
                  return (
                    <div key={msg._id} className="mb-3">
                      <p className="text-xs text-gray-500 mb-1">
                        {typeof msg.sender === "object" ? msg.sender.username : ""} created a poll
                      </p>
                      <PollCard
                        poll={{
                          _id: pollData.pollId,
                          question: msg.text.replace("📊 Poll: ", ""),
                          options: [],
                          createdBy: typeof msg.sender === "object" ? msg.sender._id : "",
                          closed: false,
                          createdAt: msg.createdAt,
                          updatedAt: msg.createdAt,
                        }}
                        conversationId={conversationId}
                      />
                    </div>
                  );
                } catch {
                  return null;
                }
              }

              if (msg.type === "welcome") {
                return (
                  <div key={msg._id} className="flex justify-center mb-3">
                    <div className="px-4 py-2 bg-gray-800/50 rounded-full">
                      <p className="text-xs text-gray-400 text-center">{msg.text}</p>
                    </div>
                  </div>
                );
              }

              return (
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
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <ChatInput
            conversationId={conversationId}
            replyTo={replyTo}
            onClearReply={() => setReplyTo(null)}
            members={conversation.members}
            topicId={activeTopic}
            isMuted={isMuted}
            onWatchTogether={() => {
              const url = prompt("Paste YouTube URL:");
              if (url) socket?.emit("syncplay:start", { conversationId, url });
            }}
          />

          {/* Group settings modal */}
          {showGroupSettings && (
            <GroupSettingsPanel
              conversation={conversation}
              onClose={() => setShowGroupSettings(false)}
              onUpdate={(updated) => {
                setConversation(updated);
                setShowGroupSettings(false);
              }}
            />
          )}

          {/* SyncPlay panel */}
          {syncPlaySession && syncPlaySession.active && (
            <SyncPlayPanel
              session={syncPlaySession}
              onClose={() => setSyncPlaySession(null)}
              onStart={(url) => socket?.emit("syncplay:start", { conversationId, url })}
            />
          )}
        </>
      )}
    </div>
  );
}
