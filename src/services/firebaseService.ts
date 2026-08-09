import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  increment,
  limit
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { Post, User, Comment, Notification, Transaction, ChatMessage } from '../models/types';

// ==================== POSTS ====================

export async function fetchPosts(typeFilter: string = 'all', searchQuery: string = ''): Promise<Post[]> {
  try {
    const postsRef = collection(db, 'posts');
    let q = query(postsRef, orderBy('createdAt', 'desc'));

    if (typeFilter === 'lost' || typeFilter === 'found') {
      q = query(postsRef, where('type', '==', typeFilter), orderBy('createdAt', 'desc'));
    }

    const querySnapshot = await getDocs(q);
    const posts: Post[] = [];

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const post: Post = {
        id: docSnap.id,
        title: data.title || '',
        description: data.description || '',
        type: data.type || 'lost',
        userId: data.userId || '',
        createdAt: data.createdAt,
        imageUrl: data.imageUrl,
        lat: data.lat,
        lng: data.lng,
        address: data.address,
        imageLabel: data.imageLabel,
        confidence: data.confidence,
        likes: data.likes || [],
        status: data.status || 'active',
        resolvedBy: data.resolvedBy,
        rating: data.rating,
        ratingComment: data.ratingComment,
        resolvedAt: data.resolvedAt,
        rewardPoints: data.rewardPoints || 0,
        contactPhone: data.contactPhone
      };

      // Search filter
      if (searchQuery.trim()) {
        const queryLower = searchQuery.toLowerCase();
        const matchesTitle = post.title.toLowerCase().includes(queryLower);
        const matchesDesc = post.description.toLowerCase().includes(queryLower);
        const matchesAddr = (post.address || '').toLowerCase().includes(queryLower);
        if (matchesTitle || matchesDesc || matchesAddr) {
          posts.push(post);
        }
      } else {
        posts.push(post);
      }
    });

    return posts;
  } catch (error) {
    console.error('Error fetching posts:', error);
    return [];
  }
}

export async function fetchPostById(postId: string): Promise<Post | null> {
  try {
    const docRef = doc(db, 'posts', postId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        title: data.title || '',
        description: data.description || '',
        type: data.type || 'lost',
        userId: data.userId || '',
        createdAt: data.createdAt,
        imageUrl: data.imageUrl,
        lat: data.lat,
        lng: data.lng,
        address: data.address,
        imageLabel: data.imageLabel,
        confidence: data.confidence,
        likes: data.likes || [],
        status: data.status || 'active',
        resolvedBy: data.resolvedBy,
        rating: data.rating,
        ratingComment: data.ratingComment,
        resolvedAt: data.resolvedAt,
        rewardPoints: data.rewardPoints || 0,
        contactPhone: data.contactPhone
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching post by ID:', error);
    return null;
  }
}

export async function createPost(postData: Omit<Post, 'id'>): Promise<string> {
  const postsRef = collection(db, 'posts');
  const docRef = await addDoc(postsRef, {
    ...postData,
    createdAt: serverTimestamp(),
    likes: [],
    status: 'active'
  });
  return docRef.id;
}

export async function toggleLikePost(postId: string, userId: string, isLiked: boolean): Promise<void> {
  const postRef = doc(db, 'posts', postId);
  await updateDoc(postRef, {
    likes: isLiked ? arrayRemove(userId) : arrayUnion(userId)
  });
}

// ==================== USERS & PROFILE ====================

export async function getUserProfile(userId: string): Promise<User | null> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const data = userSnap.data();
      return {
        uid: userSnap.id,
        name: data.name || 'User',
        email: data.email || '',
        phone: data.phone || '',
        avatarUrl: data.avatarUrl || '',
        points: data.points || 0,
        reputationScore: data.reputationScore || 100,
        resolvedCount: data.resolvedCount || 0,
        createdAt: data.createdAt,
        levelBadge: getBadgeLevel(data.points || 0)
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

export function getBadgeLevel(points: number): string {
  if (points >= 1000) return 'Diamond Helper 💎';
  if (points >= 500) return 'Gold Helper 🥇';
  if (points >= 200) return 'Silver Helper 🥈';
  return 'Bronze Helper 🥉';
}

export async function updateUserProfile(userId: string, data: Partial<User>): Promise<void> {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, data);
}

// ==================== COMMENTS ====================

export function subscribeComments(postId: string, callback: (comments: Comment[]) => void) {
  const commentsRef = collection(db, 'comments');
  const q = query(commentsRef, where('postId', '==', postId), orderBy('createdAt', 'asc'));

  return onSnapshot(q, (snapshot) => {
    const comments: Comment[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      comments.push({
        id: docSnap.id,
        postId: data.postId,
        userId: data.userId,
        userName: data.userName || 'Anonymous',
        userAvatar: data.userAvatar || '',
        content: data.content || '',
        createdAt: data.createdAt
      });
    });
    callback(comments);
  });
}

export async function addComment(commentData: Omit<Comment, 'id'>): Promise<string> {
  const commentsRef = collection(db, 'comments');
  const docRef = await addDoc(commentsRef, {
    ...commentData,
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

// ==================== RESOLVE FLOW & GAMIFICATION ====================

export async function completePostResolve(
  postId: string,
  helperUserId: string,
  rating: number,
  ratingComment: string,
  rewardPoints: number = 50
): Promise<void> {
  // 1. Update post status
  const postRef = doc(db, 'posts', postId);
  await updateDoc(postRef, {
    status: 'resolved',
    resolvedBy: helperUserId,
    rating,
    ratingComment,
    resolvedAt: serverTimestamp()
  });

  // 2. Award points and increment resolved count for helper
  const helperRef = doc(db, 'users', helperUserId);
  await updateDoc(helperRef, {
    points: increment(rewardPoints),
    resolvedCount: increment(1),
    reputationScore: increment(rating * 2)
  });

  // 3. Add transaction record
  const txRef = collection(db, 'transactions');
  await addDoc(txRef, {
    userId: helperUserId,
    amount: rewardPoints,
    type: 'reward',
    description: `Thưởng ${rewardPoints} điểm từ việc hỗ trợ trả đồ thành công`,
    timestamp: serverTimestamp()
  });

  // 4. Send notification to helper
  const notifRef = collection(db, 'notifications');
  await addDoc(notifRef, {
    userId: helperUserId,
    title: '🎉 Nhận điểm thưởng thành công!',
    message: `Bạn nhận được ${rewardPoints} điểm Findora từ việc trả lại đồ thành công. Cảm ơn tấm lòng của bạn!`,
    type: 'points',
    postId,
    createdAt: serverTimestamp(),
    read: false
  });
}

// ==================== IMAGE UPLOAD ====================

export async function uploadImageToStorage(uri: string, path: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob);
  return await getDownloadURL(storageRef);
}

// ==================== LEADERBOARD ====================

export async function fetchLeaderboard(): Promise<User[]> {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, orderBy('points', 'desc'), limit(20));
    const snapshot = await getDocs(q);
    const leaderboard: User[] = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      leaderboard.push({
        uid: docSnap.id,
        name: data.name || 'User',
        email: data.email || '',
        avatarUrl: data.avatarUrl || '',
        points: data.points || 0,
        reputationScore: data.reputationScore || 100,
        resolvedCount: data.resolvedCount || 0,
        levelBadge: getBadgeLevel(data.points || 0)
      });
    });

    return leaderboard;
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return [];
  }
}
