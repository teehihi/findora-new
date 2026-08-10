import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  setDoc,
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
import * as Location from 'expo-location';
import { auth, db, storage } from '../config/firebase';
import { Post, User, Comment, Notification, Transaction, ChatMessage } from '../models/types';

// ==================== LOCATION & REVERSE GEOCODING ====================

/**
 * Get Address strictly formatted as: "Số nhà, tên đường(nếu có), xã/phường, tỉnh/thành phố"
 * Automatically deduplicates repeated administrative parts.
 */
export async function getCurrentAddressFromGPS(): Promise<string> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return 'Thành phố Hồ Chí Minh';
    }

    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High
    });

    const lat = loc.coords.latitude;
    const lng = loc.coords.longitude;

    // 1. Try OpenStreetMap Nominatim API first (Provides full Vietnamese Administrative names)
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'Findora-Android-App'
          }
        }
      );

      const json = await response.json();
      const addr = json.address;

      if (addr) {
        const houseNum = addr.house_number || addr.building || '';
        const road = addr.road || addr.street || addr.pedestrian || '';
        const streetCombined = [houseNum, road].filter(Boolean).join(' ');

        const ward = addr.suburb || addr.quarter || addr.neighbourhood || addr.village || addr.commune || '';
        const province = addr.province || addr.state || addr.city || addr.town || addr.county || '';

        const rawParts = [streetCombined, ward, province].filter(Boolean);
        const cleanParts: string[] = [];

        for (const p of rawParts) {
          const trimmed = p.trim();
          if (trimmed && !cleanParts.includes(trimmed)) {
            cleanParts.push(trimmed);
          }
        }

        if (cleanParts.length >= 2) {
          return cleanParts.join(', ');
        }
      }
    } catch (e) {
      console.log('Nominatim geocoding error:', e);
    }

    // 2. Expo Location Native Geocoder Fallback
    try {
      const geoResults = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (geoResults && geoResults.length > 0) {
        const item = geoResults[0];
        const streetNum = item.streetNumber || '';
        const streetName = item.street || '';
        const ward = item.district || item.name || '';
        const city = item.region || item.city || item.subregion || '';

        const streetCombined = [streetNum, streetName].filter(Boolean).join(' ');
        const rawParts = [streetCombined, ward, city].filter(Boolean);
        const cleanParts: string[] = [];

        for (const p of rawParts) {
          const trimmed = p.trim();
          if (trimmed && !cleanParts.includes(trimmed)) {
            cleanParts.push(trimmed);
          }
        }

        if (cleanParts.length > 0) {
          return cleanParts.join(', ');
        }
      }
    } catch (e) {
      console.log('Native geocoding fallback error:', e);
    }

    return 'Thành phố Hồ Chí Minh';
  } catch (error) {
    console.error('GPS reverse geocoding error:', error);
    return 'Thành phố Hồ Chí Minh';
  }
}

// ==================== POSTS ====================

export async function fetchPosts(typeFilter: string = 'all', searchQuery: string = ''): Promise<Post[]> {
  try {
    const postsRef = collection(db, 'posts');
    const querySnapshot = await getDocs(postsRef);
    const posts: Post[] = [];

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const status = data.status || 'active';

      // Hide resolved and closed posts from Home feed
      if (status !== 'resolved' && status !== 'closed') {
        const img = data.imageUrl || data.image_url || data.image || data.photoUrl || data.url || '';
        const post: Post = {
          id: docSnap.id,
          title: data.title || '',
          description: data.description || '',
          type: data.type || 'lost',
          userId: data.userId || '',
          createdAt: data.createdAt,
          imageUrl: img,
          lat: data.lat,
          lng: data.lng,
          address: data.address,
          imageLabel: data.imageLabel,
          confidence: data.confidence,
          likes: data.likes || [],
          status: status,
          resolvedBy: data.resolvedBy,
          rating: data.rating,
          ratingComment: data.ratingComment,
          resolvedAt: data.resolvedAt,
          rewardPoints: data.rewardPoints || 0,
          contactPhone: data.contactPhone
        };

        // Filter by type
        const matchesType = typeFilter === 'all' || post.type === typeFilter;

        // Filter by search query
        let matchesSearch = true;
        if (searchQuery.trim()) {
          const qLower = searchQuery.toLowerCase().trim();
          matchesSearch = 
            post.title.toLowerCase().includes(qLower) ||
            post.description.toLowerCase().includes(qLower) ||
            (post.address || '').toLowerCase().includes(qLower) ||
            (post.imageLabel || '').toLowerCase().includes(qLower);
        }

        if (matchesType && matchesSearch) {
          posts.push(post);
        }
      }
    });

    // Sort by createdAt descending in memory
    posts.sort((a, b) => {
      const tA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
      const tB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
      return tB - tA;
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
      const img = data.imageUrl || data.image_url || data.image || data.photoUrl || data.url || '';
      return {
        id: docSnap.id,
        title: data.title || '',
        description: data.description || '',
        type: data.type || 'lost',
        userId: data.userId || '',
        createdAt: data.createdAt,
        imageUrl: img,
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

// User Cache for Post Poster details exactly matching PostAdapter.java
const userPosterCache = new Map<string, { name: string; avatarUrl: string }>();

export async function getPosterDetails(userId: string): Promise<{ name: string; avatarUrl: string }> {
  if (!userId) return { name: 'Người dùng', avatarUrl: '' };
  if (userPosterCache.has(userId)) {
    return userPosterCache.get(userId)!;
  }

  try {
    const userSnap = await getDoc(doc(db, 'users', userId));
    if (userSnap.exists()) {
      const data = userSnap.data();
      const name = data.fullName || data.name || 'Người dùng';
      const avatarUrl = data.photoUrl || data.avatarUrl || '';
      const result = { name, avatarUrl };
      userPosterCache.set(userId, result);
      return result;
    }
  } catch (e) {
    console.error('Error fetching poster details:', e);
  }

  return { name: 'Người dùng', avatarUrl: '' };
}

// Fetch comment count for post
export async function getPostCommentCount(postId: string): Promise<number> {
  if (!postId) return 0;
  try {
    const commentsRef = collection(db, 'comments');
    const q = query(commentsRef, where('postId', '==', postId));
    const snap = await getDocs(q);
    return snap.size;
  } catch (e) {
    return 0;
  }
}

// ==================== NOTIFICATIONS ====================

/**
 * Realtime unread notification listener matching native MainActivity.java lines 745-758
 */
export function subscribeUnreadNotificationCount(
  userId: string,
  callback: (count: number) => void
) {
  if (!userId) {
    callback(0);
    return () => {};
  }

  try {
    const notifRef = collection(db, 'notifications');
    const q = query(
      notifRef,
      where('userId', '==', userId),
      where('read', '==', false)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        callback(snapshot.size);
      },
      (error) => {
        console.log('Error fetching unread notification count:', error);
        callback(0);
      }
    );
  } catch (e) {
    console.error('Error setting up notification listener:', e);
    callback(0);
    return () => {};
  }
}

export async function fetchNotificationsList(userId: string): Promise<Notification[]> {
  if (!userId) return [];
  try {
    const notifRef = collection(db, 'notifications');
    const q = query(notifRef, where('userId', '==', userId));
    const snapshot = await getDocs(q);
    const list: Notification[] = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      list.push({
        id: docSnap.id,
        userId: data.userId,
        title: data.title || 'Thông báo',
        message: data.message || '',
        type: data.type || 'system',
        postId: data.postId,
        createdAt: data.createdAt,
        read: data.read || false
      });
    });

    list.sort((a, b) => {
      const tA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
      const tB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
      return tB - tA;
    });

    return list;
  } catch (e) {
    console.error('Error fetching notifications list:', e);
    return [];
  }
}

// ==================== TRANSACTIONS ====================

export async function fetchUserTransactions(userId: string): Promise<Transaction[]> {
  if (!userId) return [];
  try {
    const txRef = collection(db, 'transactions');
    const q = query(txRef, where('userId', '==', userId));
    const snapshot = await getDocs(q);
    const list: Transaction[] = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      list.push({
        id: docSnap.id,
        userId: data.userId,
        amount: data.amount || 0,
        type: data.type || 'reward',
        description: data.description || '',
        timestamp: data.timestamp
      });
    });

    list.sort((a, b) => {
      const tA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : (a.timestamp?.seconds ? a.timestamp.seconds * 1000 : 0);
      const tB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : (b.timestamp?.seconds ? b.timestamp.seconds * 1000 : 0);
      return tB - tA;
    });

    return list;
  } catch (e) {
    console.error('Error fetching transactions:', e);
    return [];
  }
}

// ==================== VOUCHERS ====================

export interface VoucherItem {
  id: string;
  title: string;
  brand: string;
  pointsCost: number;
  discount: string;
  icon: string;
  code?: string;
}

export async function fetchVouchers(): Promise<VoucherItem[]> {
  try {
    const vouchersRef = collection(db, 'vouchers');
    const snapshot = await getDocs(vouchersRef);
    if (!snapshot.empty) {
      const list: VoucherItem[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          title: data.title || 'Voucher Ưu Đãi',
          brand: data.brand || 'Findora Partner',
          pointsCost: data.pointsCost || data.points || 50,
          discount: data.discount || 'Ưu đãi đặc biệt',
          icon: data.icon || 'gift',
          code: data.code || 'FINDORA_VIP'
        });
      });
      return list;
    }
  } catch (e) {
    console.log('Fetching Firestore vouchers fallback to catalog:', e);
  }

  // Brand Catalog Fallback matching native VoucherMarketActivity.java lines 143-178
  return [
    {
      id: '1',
      title: 'Voucher giảm giá 25% tối đa 100k',
      brand: 'XANH SM',
      pointsCost: 20,
      discount: 'Giảm 25% chuyến đi',
      icon: 'car',
      code: 'XANHWIN'
    },
    {
      id: '2',
      title: 'Voucher mua 1 tặng 1',
      brand: 'HIGHLANDS COFFEE',
      pointsCost: 30,
      discount: 'Mua 1 tặng 1',
      icon: 'cafe',
      code: 'BUY1GET1'
    },
    {
      id: '3',
      title: 'Voucher đồng giá 39k',
      brand: 'THE COFFEE HOUSE',
      pointsCost: 50,
      discount: 'Đồng giá 39k',
      icon: 'cafe',
      code: 'DONGIA39'
    },
    {
      id: '4',
      title: 'Voucher giảm giá 15% toàn menu',
      brand: 'JOLLIBEE VIỆT NAM',
      pointsCost: 80,
      discount: 'Giảm 15% menu',
      icon: 'restaurant',
      code: 'JOLLI15PER'
    }
  ];
}

// ==================== USERS & PROFILE ====================

export async function getUserProfile(userId: string): Promise<User | null> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    const currentUser = auth.currentUser;

    if (userSnap.exists()) {
      const data = userSnap.data();
      let updatedName = data.name || data.fullName;
      let updatedAvatar = data.avatarUrl || data.photoUrl;
      let needsUpdate = false;

      if ((!updatedName || updatedName === 'User') && currentUser?.displayName) {
        updatedName = currentUser.displayName;
        needsUpdate = true;
      }
      if (!updatedAvatar && currentUser?.photoURL) {
        updatedAvatar = currentUser.photoURL;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await updateDoc(userRef, {
          name: updatedName,
          avatarUrl: updatedAvatar
        }).catch(() => {});
      }

      const storedLevel = data.level || getLevelFromPoints(data.points || 0);
      const returnedCount = data.totalReturned ?? data.resolvedCount ?? 0;

      return {
        uid: userSnap.id,
        name: updatedName || currentUser?.displayName || 'Người dùng Findora',
        email: data.email || currentUser?.email || '',
        phone: data.phone || '',
        avatarUrl: updatedAvatar || currentUser?.photoURL || '',
        points: data.points ?? 100,
        reputationScore: data.reputationScore ?? 100,
        resolvedCount: returnedCount,
        createdAt: data.createdAt,
        level: storedLevel,
        levelBadge: storedLevel
      };
    } else if (currentUser && currentUser.uid === userId) {
      // Auto-initialize profile in Firestore if doc doesn't exist yet
      const initialProfile = {
        uid: currentUser.uid,
        name: currentUser.displayName || currentUser.email?.split('@')[0] || 'Người dùng Findora',
        email: currentUser.email || '',
        phone: '',
        avatarUrl: currentUser.photoURL || '',
        points: 100,
        reputationScore: 100,
        resolvedCount: 0,
        totalReturned: 0,
        level: 'Người mới',
        createdAt: serverTimestamp()
      };
      await setDoc(userRef, initialProfile).catch(() => {});
      return {
        ...initialProfile,
        levelBadge: 'Người mới'
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    const currentUser = auth.currentUser;
    if (currentUser) {
      return {
        uid: currentUser.uid,
        name: currentUser.displayName || 'Người dùng Findora',
        email: currentUser.email || '',
        phone: '',
        avatarUrl: currentUser.photoURL || '',
        points: 100,
        reputationScore: 100,
        resolvedCount: 0,
        level: 'Người mới',
        levelBadge: 'Người mới'
      };
    }
    return null;
  }
}

export function getLevelFromPoints(points: number): string {
  if (points >= 1000) return 'Huyền thoại';
  if (points >= 500) return 'Thiên thần';
  if (points >= 100) return 'Người tốt';
  return 'Người mới';
}

export function getBadgeLevel(points: number): string {
  return getLevelFromPoints(points);
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
    totalReturned: increment(1),
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
      const level = data.level || getLevelFromPoints(data.points || 0);
      const returnedCount = data.totalReturned ?? data.resolvedCount ?? 0;
      leaderboard.push({
        uid: docSnap.id,
        name: data.name || data.fullName || 'User',
        email: data.email || '',
        avatarUrl: data.avatarUrl || data.photoUrl || '',
        points: data.points || 0,
        reputationScore: data.reputationScore || 100,
        resolvedCount: returnedCount,
        level: level,
        levelBadge: level
      });
    });

    return leaderboard;
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return [];
  }
}
