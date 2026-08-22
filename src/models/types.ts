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
  fullName?: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  photoUrl?: string;
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
  postTitle?: string;
  postImage?: string;
  postType?: 'lost' | 'found' | string;
  postCategory?: string;
  message: string;
  type?: 'text' | 'image' | 'call' | 'post_card';
  callType?: 'voice' | 'video';
  callDuration?: number;
  callStatus?: 'ended' | 'missed' | 'rejected';
  imageUrl?: string;
  replyToId?: string | null;
  replyToText?: string | null;
  replyToSender?: string | null;
  timestamp?: Timestamp | any;
  read?: boolean;
  deletedBy?: string[];
  chatDocId?: string;
}

export interface Notification {
  id?: string;
  userId: string;
  title: string;
  message: string;
  type: 'match' | 'chat' | 'points' | 'resolve' | 'system' | 'comment' | 'like';
  postId?: string;
  senderId?: string;
  senderName?: string;
  senderAvatar?: string;
  imageUrl?: string;
  createdAt?: Timestamp | any;
  read?: boolean;
}

export interface Transaction {
  id?: string;
  userId: string;
  amount: number;
  type: 'reward' | 'voucher' | 'deposit' | 'withdraw';
  title?: string;
  description: string;
  code?: string;
  brand?: string;
  discount?: string;
  expiryDate?: string;
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

export type VoucherCategory = 'ALL' | 'FOOD_BEVERAGE' | 'TRANSPORT' | 'SHOPPING' | 'ENTERTAINMENT' | 'SERVICES';

export interface VoucherItem {
  id: string;
  title: string;
  brand: string;
  pointsCost: number;
  discount: string;
  icon?: string;
  code: string;
  image?: any;
  category?: VoucherCategory;
  remainingCount?: number;
  expiryDate?: string;
}

export interface UserVoucher {
  id: string;
  voucherId: string;
  title: string;
  brand: string;
  code: string;
  discount: string;
  pointsCost: number;
  redeemedAt: any;
  expiryDate: string;
  status: 'active' | 'used' | 'expired';
}
