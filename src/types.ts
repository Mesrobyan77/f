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
  role: "admin" | "moderator" | "member";
  joinedAt: string;
}

export interface ConversationData {
  _id: string;
  name: string;
  avatar: string;
  online: boolean;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  isGroup: boolean;
  admin?: User | string;
  members?: Member[];
  pinnedMessages: Message[];
  otherUser: {
    _id: string;
    username: string;
    avatar: string;
    online: boolean;
  } | null;
}

export type CallType = "audio" | "video";
