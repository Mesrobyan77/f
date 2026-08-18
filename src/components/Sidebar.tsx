import { useEffect, useState } from "react";
import Avatar from "./Avatar";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { conversationAPI, authAPI } from "../services/api";
import type { ConversationData } from "../types";

interface SidebarProps {
  activeId: string | null;
  onSelect: (id: string) => void;
}

export default function Sidebar({ activeId, onSelect }: SidebarProps) {
  const { user, logout, socket } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const [search, setSearch] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const fetchConversations = async () => {
    try {
      const res = await conversationAPI.getAll();
      setConversations(res.data.conversations);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (data: { message: any; conversationId: string }) => {
      setConversations((prev) =>
        prev.map((c) =>
          c._id === data.conversationId
            ? {
                ...c,
                lastMessage: data.message.text || "[media]",
                lastMessageAt: data.message.createdAt,
                unreadCount:
                  data.message.sender._id !== user?._id
                    ? c.unreadCount + 1
                    : c.unreadCount,
              }
            : c
        )
      );
    };

    const handleUserOnline = (data: { userId: string; online: boolean }) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.otherUser?._id === data.userId
            ? { ...c, online: data.online, otherUser: { ...c.otherUser!, online: data.online } }
            : c
        )
      );
    };

    socket.on("receive_message", handleNewMessage);
    socket.on("user_online", handleUserOnline);

    return () => {
      socket.off("receive_message", handleNewMessage);
      socket.off("user_online", handleUserOnline);
    };
  }, [socket, user]);

  const handleNewChat = async () => {
    try {
      const res = await authAPI.getUsers();
      setUsers(res.data.users);
      setShowNewChat(true);
      setShowNewGroup(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleNewGroup = async () => {
    try {
      const res = await authAPI.getUsers();
      setUsers(res.data.users);
      setShowNewGroup(true);
      setShowNewChat(false);
    } catch (err) {
      console.error(err);
    }
  };

  const startConversation = async (userId: string) => {
    try {
      const res = await conversationAPI.create(userId);
      setShowNewChat(false);
      fetchConversations();
      onSelect(res.data.conversation._id);
    } catch (err) {
      console.error(err);
    }
  };

  const createGroup = async () => {
    if (!groupName.trim() || selectedMembers.length === 0) return;
    try {
      const res = await conversationAPI.createGroup(groupName.trim(), selectedMembers);
      setShowNewGroup(false);
      setGroupName("");
      setSelectedMembers([]);
      fetchConversations();
      onSelect(res.data.conversation._id);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleMember = (userId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const filtered = conversations.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <aside className="w-full md:w-80 bg-gray-900 border-r border-gray-700 flex flex-col h-full">
      <div className="p-3 md:p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold text-white">Messages</h2>
          <div className="flex gap-1">
            <button
              onClick={toggleTheme}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
              title={theme === "dark" ? "Light mode" : "Dark mode"}
            >
              {theme === "dark" ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            <button
              onClick={handleNewChat}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
              title="New chat"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button
              onClick={handleNewGroup}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
              title="New group"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button
              onClick={logout}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
              title="Logout"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-800 text-gray-300 text-sm rounded-lg px-4 py-2.5 pl-10 border border-gray-700 focus:outline-none focus:border-blue-500 transition-colors"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {showNewGroup ? (
          <div className="p-2">
            <div className="flex items-center justify-between px-2 py-1 mb-2">
              <span className="text-sm font-medium text-gray-300">Create Group</span>
              <button onClick={() => setShowNewGroup(false)} className="text-gray-500 hover:text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <input
              type="text"
              placeholder="Group name..."
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full bg-gray-800 text-gray-300 text-sm rounded-lg px-3 py-2 mb-2 border border-gray-700 focus:outline-none focus:border-blue-500"
            />
            {users.map((u) => (
              <button
                key={u._id}
                onClick={() => toggleMember(u._id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-800 rounded-lg transition-colors ${
                  selectedMembers.includes(u._id) ? "bg-blue-500/20 border border-blue-500/50" : ""
                }`}
              >
                <Avatar initials={u.username.charAt(0).toUpperCase()} online={u.online} />
                <span className="text-sm text-white flex-1">{u.username}</span>
                {selectedMembers.includes(u._id) && (
                  <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                  </svg>
                )}
              </button>
            ))}
            <button
              onClick={createGroup}
              disabled={!groupName.trim() || selectedMembers.length === 0}
              className="w-full mt-2 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Create Group ({selectedMembers.length} selected)
            </button>
          </div>
        ) : showNewChat ? (
          <div className="p-2">
            <div className="flex items-center justify-between px-2 py-1 mb-2">
              <span className="text-sm font-medium text-gray-300">Start a new chat</span>
              <button onClick={() => setShowNewChat(false)} className="text-gray-500 hover:text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {users.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">No other users yet.</p>
            ) : (
              users.map((u) => (
                <button
                  key={u._id}
                  onClick={() => startConversation(u._id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <Avatar initials={u.username.charAt(0).toUpperCase()} online={u.online} />
                  <span className="text-sm text-white">{u.username}</span>
                </button>
              ))
            )}
          </div>
        ) : (
          filtered.map((conv) => (
            <button
              key={conv._id}
              onClick={() => {
                onSelect(conv._id);
                setConversations((prev) =>
                  prev.map((c) =>
                    c._id === conv._id ? { ...c, unreadCount: 0 } : c
                  )
                );
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-800 ${
                activeId === conv._id ? "bg-gray-800 border-r-2 border-blue-500" : ""
              }`}
            >
              <Avatar initials={conv.name.charAt(0).toUpperCase()} online={conv.online} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white text-sm truncate flex items-center gap-1">
                    {conv.isGroup && (
                      <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                    {conv.name}
                  </span>
                  <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                    {new Date(conv.lastMessageAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="text-sm text-gray-400 truncate">{conv.lastMessage || "No messages yet"}</p>
                  {conv.unreadCount > 0 && (
                    <span className="ml-2 bg-blue-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                      {conv.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {user && (
        <div className="p-3 border-t border-gray-700">
          <div className="flex items-center gap-3">
            <Avatar initials={user.username.charAt(0).toUpperCase()} online={true} />
            <span className="text-sm text-white font-medium truncate">{user.username}</span>
          </div>
        </div>
      )}
    </aside>
  );
}
