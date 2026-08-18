import { useState, type ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { conversationAPI } from "../services/api";
import Avatar from "./Avatar";
import type { ConversationData, Member, Topic, Permissions } from "../types";

interface GroupSettingsPanelProps {
  conversation: ConversationData;
  onClose: () => void;
  onUpdate: (conv: ConversationData) => void;
}

type Tab = "members" | "permissions" | "topics" | "welcome" | "invite";

export default function GroupSettingsPanel({ conversation, onClose, onUpdate }: GroupSettingsPanelProps) {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("members");
  const [members, setMembers] = useState<Member[]>(conversation.members || []);
  const [topics, setTopics] = useState<Topic[]>(conversation.topics || []);
  const [permissions, setPermissions] = useState<Permissions>(conversation.permissions || {
    "谁能发消息": "everyone",
    "谁能发媒体": "everyone",
    "谁能编辑群信息": "admins",
    "谁能邀请成员": "admins",
    "谁能置顶消息": "admins",
    "谁能创建投票": "everyone",
  });
  const [welcomeMessage, setWelcomeMessage] = useState(conversation.welcomeMessage || "");
  const [newTopicName, setNewTopicName] = useState("");
  const [newTopicDesc, setNewTopicDesc] = useState("");
  const [inviteMaxUses, setInviteMaxUses] = useState(0);
  const [inviteExpires, setInviteExpires] = useState(0);
  const [inviteLinks, setInviteLinks] = useState(conversation.inviteLinks || []);
  const [editingName, setEditingName] = useState(false);
  const [groupName, setGroupName] = useState(conversation.name);

  const myMember = members.find((m) => {
    if (typeof m.user === "object") return m.user._id === user?._id;
    return m.user === user?._id;
  });
  const isOwner = myMember?.role === "owner";
  const isAdmin = ["owner", "admin"].includes(myMember?.role || "");

  const getMemberId = (m: Member) => {
    if (typeof m.user === "object") return m.user._id;
    return m.user;
  };

  const getMemberName = (m: Member) => {
    if (typeof m.user === "object") return m.user.username;
    return "Unknown";
  };

  const getMemberOnline = (m: Member) => {
    if (typeof m.user === "object") return m.user.online;
    return false;
  };

  const handleRename = async () => {
    if (!groupName.trim()) return;
    try {
      await conversationAPI.renameGroup(conversation._id, groupName.trim());
      onUpdate({ ...conversation, name: groupName.trim() });
      setEditingName(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRoleChange = async (memberId: string, role: string) => {
    try {
      const res = await conversationAPI.updateMemberRole(conversation._id, memberId, role);
      setMembers(res.data.conversation.members);
    } catch (err) {
      console.error(err);
    }
  };

  const handleMute = async (memberId: string, muted: boolean, duration?: number) => {
    try {
      const res = await conversationAPI.muteMember(conversation._id, memberId, muted, duration);
      setMembers(res.data.conversation.members);
    } catch (err) {
      console.error(err);
    }
  };

  const handleBan = async (memberId: string, banned: boolean) => {
    try {
      const res = await conversationAPI.banMember(conversation._id, memberId, banned);
      setMembers(res.data.conversation.members);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const res = await conversationAPI.removeMember(conversation._id, memberId);
      setMembers(res.data.conversation.members);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePermissionChange = async (key: string, value: string) => {
    const updated = { ...permissions, [key]: value } as Permissions;
    setPermissions(updated);
    try {
      await conversationAPI.updatePermissions(conversation._id, { [key]: value });
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddTopic = async () => {
    if (!newTopicName.trim()) return;
    try {
      const res = await conversationAPI.addTopic(conversation._id, newTopicName.trim(), newTopicDesc.trim());
      setTopics(res.data.topics);
      setNewTopicName("");
      setNewTopicDesc("");
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTopic = async (topicId: string) => {
    try {
      const res = await conversationAPI.deleteTopic(conversation._id, topicId);
      setTopics(res.data.topics);
    } catch (err) {
      console.error(err);
    }
  };

  const handleWelcomeMessage = async () => {
    try {
      await conversationAPI.updateWelcomeMessage(conversation._id, welcomeMessage);
      onUpdate({ ...conversation, welcomeMessage });
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateInvite = async () => {
    try {
      const res = await conversationAPI.createInviteLink(
        conversation._id,
        inviteMaxUses || undefined,
        inviteExpires ? inviteExpires * 3600 : undefined
      );
      setInviteLinks([...inviteLinks, res.data.inviteLink]);
    } catch (err) {
      console.error(err);
    }
  };

  const roleBadge = (role: string) => {
    const colors: Record<string, string> = {
      owner: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
      admin: "bg-blue-500/20 text-blue-400 border-blue-500/50",
      moderator: "bg-purple-500/20 text-purple-400 border-purple-500/50",
      member: "bg-gray-700/50 text-gray-400 border-gray-600",
    };
    return (
      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${colors[role] || colors.member}`}>
        {role}
      </span>
    );
  };

  const permLabels: Record<string, string> = {
    "谁能发消息": "Who can send messages",
    "谁能发媒体": "Who can send media",
    "谁能编辑群信息": "Who can edit group info",
    "谁能邀请成员": "Who can invite members",
    "谁能置顶消息": "Who can pin messages",
    "谁能创建投票": "Who can create polls",
  };

  const tabs: { key: Tab; label: string; icon: ReactNode }[] = [
    { key: "members", label: "Members", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg> },
    { key: "permissions", label: "Perms", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg> },
    { key: "topics", label: "Topics", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg> },
    { key: "welcome", label: "Welcome", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg> },
    { key: "invite", label: "Invite", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg> },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-gray-900 rounded-2xl w-full max-w-lg max-h-[85vh] border border-gray-700 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-3">
            {editingName ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRename()}
                  className="flex-1 bg-gray-800 text-white text-sm rounded-lg px-3 py-1.5 border border-gray-600 focus:outline-none focus:border-blue-500"
                  autoFocus
                />
                <button onClick={handleRename} className="text-green-400 hover:text-green-300 text-xs">Save</button>
                <button onClick={() => { setEditingName(false); setGroupName(conversation.name); }} className="text-gray-500 hover:text-white text-xs">Cancel</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">{conversation.name}</h3>
                {isAdmin && (
                  <button onClick={() => setEditingName(true)} className="text-gray-500 hover:text-white">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                )}
              </div>
            )}
            <button onClick={onClose} className="text-gray-500 hover:text-white p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  tab === t.key ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === "members" && (
            <div className="space-y-2">
              {members.map((m) => {
                const memberId = getMemberId(m);
                const isMe = memberId === user?._id;
                return (
                  <div key={memberId} className={`flex items-center gap-3 p-2 rounded-lg ${m.banned ? "opacity-50" : ""} ${m.muted ? "bg-yellow-500/5" : ""}`}>
                    <Avatar initials={getMemberName(m).charAt(0).toUpperCase()} online={getMemberOnline(m)} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-white truncate">{getMemberName(m)}</span>
                        {roleBadge(m.role)}
                        {m.muted && <span className="text-[10px] text-yellow-400">Muted</span>}
                        {m.banned && <span className="text-[10px] text-red-400">Banned</span>}
                      </div>
                    </div>
                    {!isMe && (isOwner || (isAdmin && m.role !== "owner")) && (
                      <div className="flex items-center gap-1">
                        {isOwner && m.role !== "owner" && (
                          <select
                            value={m.role}
                            onChange={(e) => handleRoleChange(memberId, e.target.value)}
                            className="bg-gray-800 text-xs text-gray-300 rounded px-1.5 py-1 border border-gray-700"
                          >
                            <option value="member">Member</option>
                            <option value="moderator">Moder</option>
                            <option value="admin">Admin</option>
                          </select>
                        )}
                        <button
                          onClick={() => handleMute(memberId, !m.muted, 3600)}
                          className={`p-1 rounded text-xs ${m.muted ? "text-yellow-400 hover:text-yellow-300" : "text-gray-500 hover:text-yellow-400"}`}
                          title={m.muted ? "Unmute" : "Mute 1h"}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {m.muted ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                            ) : (
                              <>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                              </>
                            )}
                          </svg>
                        </button>
                        <button
                          onClick={() => handleBan(memberId, !m.banned)}
                          className={`p-1 rounded text-xs ${m.banned ? "text-red-400 hover:text-red-300" : "text-gray-500 hover:text-red-400"}`}
                          title={m.banned ? "Unban" : "Ban"}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleRemoveMember(memberId)}
                          className="p-1 rounded text-gray-500 hover:text-red-400 text-xs"
                          title="Remove"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {tab === "permissions" && isOwner && (
            <div className="space-y-3">
              {Object.entries(permLabels).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                  <span className="text-sm text-gray-300">{label}</span>
                  <select
                    value={permissions[key as keyof Permissions] || "everyone"}
                    onChange={(e) => handlePermissionChange(key, e.target.value)}
                    className="bg-gray-700 text-xs text-white rounded px-2 py-1.5 border border-gray-600 focus:outline-none"
                  >
                    <option value="everyone">Everyone</option>
                    <option value="admins">Admins</option>
                    <option value="owner">Owner only</option>
                  </select>
                </div>
              ))}
            </div>
          )}

          {tab === "permissions" && !isOwner && (
            <p className="text-gray-500 text-sm text-center py-8">Only the owner can edit permissions</p>
          )}

          {tab === "topics" && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTopicName}
                  onChange={(e) => setNewTopicName(e.target.value)}
                  placeholder="Topic name..."
                  className="flex-1 bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:border-blue-500"
                />
                {isAdmin && (
                  <button
                    onClick={handleAddTopic}
                    disabled={!newTopicName.trim()}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
                  >
                    Add
                  </button>
                )}
              </div>
              {isAdmin && newTopicName.trim() && (
                <input
                  type="text"
                  value={newTopicDesc}
                  onChange={(e) => setNewTopicDesc(e.target.value)}
                  placeholder="Description (optional)..."
                  className="w-full bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:border-blue-500"
                />
              )}
              {topics.map((topic) => (
                <div key={topic._id} className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
                  <span className="text-blue-400 text-lg">#</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium">{topic.name}</p>
                    {topic.description && <p className="text-xs text-gray-500 truncate">{topic.description}</p>}
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => handleDeleteTopic(topic._id)}
                      className="text-gray-500 hover:text-red-400 p-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === "welcome" && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">
                Set an automatic welcome message for new members. Use <code className="bg-gray-800 px-1 rounded">{"{user}"}</code> to mention the new member's name.
              </p>
              <textarea
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                placeholder="Welcome {user} to the group! Please read the rules..."
                rows={4}
                className="w-full bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:border-blue-500 resize-none"
              />
              {isAdmin && (
                <button
                  onClick={handleWelcomeMessage}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                >
                  Save Welcome Message
                </button>
              )}
            </div>
          )}

          {tab === "invite" && (
            <div className="space-y-4">
              {isAdmin && (
                <div className="p-3 bg-gray-800 rounded-lg space-y-3">
                  <h4 className="text-sm font-medium text-white">Create Invite Link</h4>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] text-gray-500 block mb-1">Max uses (0 = unlimited)</label>
                      <input
                        type="number"
                        value={inviteMaxUses}
                        onChange={(e) => setInviteMaxUses(Number(e.target.value))}
                        className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-1.5 border border-gray-600 focus:outline-none"
                        min={0}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-gray-500 block mb-1">Expires in hours (0 = never)</label>
                      <input
                        type="number"
                        value={inviteExpires}
                        onChange={(e) => setInviteExpires(Number(e.target.value))}
                        className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-1.5 border border-gray-600 focus:outline-none"
                        min={0}
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleCreateInvite}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                  >
                    Generate Link
                  </button>
                </div>
              )}

              {inviteLinks.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs text-gray-500 font-medium">Active Links</h4>
                  {inviteLinks.filter((l) => l.active).map((link) => (
                    <div key={link._id} className="flex items-center gap-2 p-2 bg-gray-800 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-blue-400 font-mono truncate">
                          {window.location.origin}/join/{link.code}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {link.uses}/{link.maxUses || "∞"} uses
                          {link.expiresAt && ` · expires ${new Date(link.expiresAt).toLocaleDateString()}`}
                        </p>
                      </div>
                      <button
                        onClick={() => navigator.clipboard.writeText(`${window.location.origin}/join/${link.code}`)}
                        className="text-gray-500 hover:text-white p-1"
                        title="Copy link"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
