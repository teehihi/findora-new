import { Timestamp } from 'firebase/firestore';

export interface Post {
  id?: string;
  title: string;
  description: string;
  type: 'lost' | 'found';
  userId: string;
  createdAt?: Timestamp | any;
  imageUrl?: string;
  lat?: number | null;
  lng?: number | null;
  address?: string;
  imageLabel?: string;
  confidence?: number;
  likes?: string[];
  status?: 'active' | 'resolved' | 'closed';
  resolvedBy?: string;
  rating?: number;
  ratingComment?: string;
  resolvedAt?: Timestamp | any;
  category?: string;
  rewardPoints?: number;
  contactPhone?: string;
}

export interface User {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  points?: number;
  reputationScore?: number;
  resolvedCount?: number;
  createdAt?: Timestamp | any;
  pushToken?: string;
  level?: string;
  levelBadge?: string;
}

export interface Comment {
  id?: string;
  postId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  createdAt?: Timestamp | any;
}

export interface ChatMessage {
  id?: string;
  senderId: string;
  receiverId: string;
  postId?: string;
  message: string;
  type?: 'text' | 'image' | 'call';
  callType?: 'voice' | 'video';
  callDuration?: number;
  callStatus?: 'ended' | 'missed' | 'rejected';
  imageUrl?: string;
  replyToId?: string | null;
  replyToText?: string | null;
  replyToSender?: string | null;
  timestamp?: Timestamp | any;
  read?: boolean;
}

export interface Notification {
  id?: string;
  userId: string;
  title: string;
  message: string;
  type: 'match' | 'chat' | 'points' | 'resolve' | 'system';
  postId?: string;
  createdAt?: Timestamp | any;
  read?: boolean;
}

export interface Transaction {
  id?: string;
  userId: string;
  amount: number;
  type: 'reward' | 'voucher' | 'deposit' | 'withdraw';
  description: string;
  timestamp?: Timestamp | any;
}

export interface MatchResult {
  post: Post;
  score: number;
  percentage: number;
  imageScore: number;
  contentScore: number;
  locationScore: number;
  distanceKm?: number;
  reasons?: string[];
}
