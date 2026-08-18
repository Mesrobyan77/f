export interface User {
  _id: string;
  username: string;
  email: string;
  avatar: string;
  online: boolean;
  lastSeen: string;
  createdAt: string;
  theme?: "dark" | "light";
}

export interface Media {
  type: "image" | "video" | "audio" | "file" | "voice" | "video_message" | "gif" | "sticker";
  url: string;
  name: string;
  size: number;
  duration: number;
  thumbnail: string;
}

export interface Reaction {
  emoji: string;
  user: string;
}

export interface Message {
  _id: string;
  conversation: string;
  sender: User | string;
  text: string;
  type: "message" | "system" | "poll" | "welcome";
  topicId?: string | null;
  read: boolean;
  edited: boolean;
  editedAt?: string;
  deleted: boolean;
  deletedAt?: string;
  replyTo?: Message | string | null;
  reactions: Reaction[];
  mentions: (User | string)[];
  media?: Media;
  pinned: boolean;
  pinnedAt?: string;
  ttl: number;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Member {
  user: User | string;
  role: "owner" | "admin" | "moderator" | "member";
  joinedAt: string;
  muted: boolean;
  mutedUntil?: string | null;
  banned: boolean;
  bannedAt?: string | null;
}

export interface Topic {
  _id: string;
  name: string;
  description: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PollOption {
  _id: string;
  text: string;
  votes: string[];
}

export interface Poll {
  _id: string;
  question: string;
  options: PollOption[];
  createdBy: string;
  closed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Permissions {
  "谁能发消息": "everyone" | "admins" | "owner";
  "谁能发媒体": "everyone" | "admins" | "owner";
  "谁能编辑群信息": "admins" | "owner";
  "谁能邀请成员": "everyone" | "admins" | "owner";
  "谁能置顶消息": "admins" | "owner";
  "谁能创建投票": "everyone" | "admins" | "owner";
}

export interface InviteLink {
  _id: string;
  code: string;
  createdBy: string;
  maxUses: number;
  uses: number;
  expiresAt?: string | null;
  active: boolean;
  createdAt: string;
}

export interface ConversationData {
  _id: string;
  name: string;
  avatar: string;
  description: string;
  online: boolean;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  isGroup: boolean;
  admin?: User | string;
  members?: Member[];
  permissions?: Permissions;
  topics?: Topic[];
  polls?: Poll[];
  welcomeMessage?: string;
  inviteLinks?: InviteLink[];
  pinnedMessages: Message[];
  otherUser: {
    _id: string;
    username: string;
    avatar: string;
    online: boolean;
  } | null;
}

export type CallType = "audio" | "video";

export interface SyncQueueItem {
  _id: string;
  url: string;
  videoId: string;
  title: string;
  addedBy: User | string;
  createdAt: string;
}

export interface SyncChatMessage {
  _id: string;
  sender: User | string;
  text: string;
  createdAt: string;
}

export interface SyncSession {
  _id: string;
  conversation: string;
  videoUrl: string;
  videoId: string;
  title: string;
  isPlaying: boolean;
  currentTime: number;
  startedBy: User | string;
  participants: User[];
  queue: SyncQueueItem[];
  chat: SyncChatMessage[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
