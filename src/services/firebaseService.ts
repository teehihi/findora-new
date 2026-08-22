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
  limit,
  writeBatch
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system';
import { auth, db, storage } from '../config/firebase';
import { Post, User, Comment, Notification, Transaction, ChatMessage, VoucherItem } from '../models/types';

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
      const img = data.imageUrl || data.image_url || data.image || data.photoUrl || data.url || (data.images && data.images.length > 0 ? data.images[0] : '') || '';
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

export async function deletePost(postId: string): Promise<void> {
  const postRef = doc(db, 'posts', postId);
  await deleteDoc(postRef);
}

export async function updatePost(postId: string, postData: Partial<Post>): Promise<void> {
  const postRef = doc(db, 'posts', postId);
  await updateDoc(postRef, {
    ...postData,
    updatedAt: serverTimestamp()
  });
}

// User Cache for Post Poster details exactly matching PostAdapter.java
const userPosterCache = new Map<string, { name: string; avatarUrl: string; phone?: string }>();

export async function getPosterDetails(userId: string): Promise<{ name: string; avatarUrl: string; phone?: string }> {
  if (!userId) return { name: 'Người dùng', avatarUrl: '', phone: '' };
  if (userPosterCache.has(userId)) {
    return userPosterCache.get(userId)!;
  }

  try {
    const userSnap = await getDoc(doc(db, 'users', userId));
    if (userSnap.exists()) {
      const data = userSnap.data();
      const name = data.fullName || data.name || 'Người dùng';
      const avatarUrl = data.photoUrl || data.avatarUrl || '';
      const phone = data.phoneNumber || data.phone || '';
      const result = { name, avatarUrl, phone };
      userPosterCache.set(userId, result);
      return result;
    }
  } catch (e) {
    console.error('Error fetching poster details:', e);
  }

  return { name: 'Người dùng', avatarUrl: '', phone: '' };
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
        senderId: data.senderId,
        senderName: data.senderName,
        senderAvatar: data.senderAvatar,
        imageUrl: data.imageUrl,
        createdAt: data.createdAt,
        read: data.read || false
      });
    });

    const getMillis = (createdAt: any): number => {
      if (!createdAt) return 0;
      if (typeof createdAt === 'number') return createdAt > 1e11 ? createdAt : createdAt * 1000;
      if (createdAt.toMillis && typeof createdAt.toMillis === 'function') return createdAt.toMillis();
      if (createdAt.toDate && typeof createdAt.toDate === 'function') return createdAt.toDate().getTime();
      if (createdAt.seconds != null) return createdAt.seconds * 1000;
      if (createdAt._seconds != null) return createdAt._seconds * 1000;
      const d = new Date(createdAt).getTime();
      return isNaN(d) ? 0 : d;
    };

    list.sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));

    return list;
  } catch (e) {
    console.error('Error fetching notifications list:', e);
    return [];
  }
}

export async function markNotificationAsRead(notifId: string): Promise<void> {
  if (!notifId) return;
  try {
    const notifRef = doc(db, 'notifications', notifId);
    await updateDoc(notifRef, { read: true });
  } catch (e) {
    console.log('Error marking notification as read:', e);
  }
}

export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  if (!userId) return;
  try {
    const notifRef = collection(db, 'notifications');
    const q = query(notifRef, where('userId', '==', userId), where('read', '==', false));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.forEach((docSnap) => {
      batch.update(docSnap.ref, { read: true });
    });
    await batch.commit();
  } catch (e) {
    console.log('Error marking all notifications as read:', e);
  }
}

// ==================== TRANSACTIONS ====================

export async function fetchUserTransactions(userId: string): Promise<Transaction[]> {
  if (!userId) return [];
  try {
    const list: Transaction[] = [];

    // 1. Fetch from 'transactions' collection
    try {
      const txRef = collection(db, 'transactions');
      const q = query(txRef, where('userId', '==', userId));
      const snapshot = await getDocs(q);

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const typeStr = (data.type || '').toLowerCase();
        const isSpend = typeStr === 'spend' || typeStr === 'voucher' || (data.amount !== undefined && data.amount < 0);

        // Extract positive number of points from whichever field exists in Firestore
        let rawPoints = 0;
        if (data.amount !== undefined && data.amount !== null && data.amount !== 0) {
          rawPoints = Math.abs(data.amount);
        } else if (data.points !== undefined && data.points !== null) {
          rawPoints = Math.abs(data.points);
        } else if (data.pointsSpent !== undefined && data.pointsSpent !== null) {
          rawPoints = Math.abs(data.pointsSpent);
        } else if (data.pointsCost !== undefined && data.pointsCost !== null) {
          rawPoints = Math.abs(data.pointsCost);
        } else if (data.rewardPoints !== undefined && data.rewardPoints !== null) {
          rawPoints = Math.abs(data.rewardPoints);
        }

        // Extract separate Title and Description
        let itemTitle = data.title || '';
        let itemDesc = data.description || '';

        if (!itemTitle && itemDesc) {
          if (itemDesc.includes(' - ')) {
            const parts = itemDesc.split(' - ');
            itemTitle = parts[0];
            itemDesc = parts.slice(1).join(' - ');
          } else {
            itemTitle = isSpend ? 'Đổi voucher ưu đãi' : 'Thưởng điểm Findo';
          }
        } else if (!itemTitle && !itemDesc) {
          itemTitle = isSpend ? 'Đổi voucher ưu đãi' : 'Thưởng điểm Findo';
          itemDesc = isSpend ? 'Đổi quà thành công' : 'Đóng góp cho cộng đồng';
        } else if (itemTitle && !itemDesc) {
          itemDesc = isSpend ? 'Đổi quà thành công' : 'Trả lại đồ thất lạc cho chủ nhân';
        }

        if (itemTitle === itemDesc) {
          itemTitle = isSpend ? 'Đổi voucher ưu đãi' : 'Thưởng trả đồ thất lạc';
        }

        const signedAmount = isSpend ? -rawPoints : rawPoints;

        list.push({
          id: docSnap.id,
          userId: data.userId,
          amount: signedAmount,
          type: isSpend ? 'voucher' : 'reward',
          title: itemTitle,
          description: itemDesc,
          code: data.code || data.voucherCode || (isSpend ? `FINDORA_${docSnap.id.substring(0, 6).toUpperCase()}` : undefined),
          brand: data.brand || data.brandName,
          discount: data.discount,
          expiryDate: data.expiryDate,
          timestamp: data.timestamp || data.createdAt,
        });
      });
    } catch (err) {
      console.log('Error fetching transactions collection:', err);
    }

    // 2. Fetch from 'user_vouchers' collection to guarantee voucher redemptions are captured
    try {
      const uvRef = collection(db, 'user_vouchers');
      const uvQ = query(uvRef, where('userId', '==', userId));
      const uvSnap = await getDocs(uvQ);

      uvSnap.forEach((docSnap) => {
        const data = docSnap.data();
        const voucherName = data.voucherName || data.title || 'Voucher ưu đãi';
        const brandName = data.brandName || data.brand || '';
        const itemTitle = brandName ? `Đổi voucher ${brandName}` : 'Đổi voucher';
        const itemDesc = voucherName;

        const alreadyInList = list.some(
          (t) => t.id === docSnap.id || (t.type === 'voucher' && voucherName && (t.description?.includes(voucherName) || t.title?.includes(voucherName)))
        );
        if (!alreadyInList) {
          const rawCost = data.pointsSpent || data.pointsCost || data.points || 0;
          list.push({
            id: `voucher_${docSnap.id}`,
            userId: data.userId,
            amount: -Math.abs(rawCost),
            type: 'voucher',
            title: itemTitle,
            description: itemDesc,
            code: data.voucherCode || data.code || `FINDORA_${docSnap.id.substring(0, 6).toUpperCase()}`,
            brand: data.brandName || data.brand,
            discount: data.discount || 'Ưu đãi đặc quyền',
            expiryDate: data.expiryDate || '31/12/2026',
            timestamp: data.redeemedAt || data.timestamp || data.createdAt,
          });
        }
      });
    } catch (err) {
      console.log('Error fetching user_vouchers for transactions:', err);
    }

    list.sort((a, b) => {
      const getMs = (t: any) => {
        if (!t) return 0;
        if (t.toDate && typeof t.toDate === 'function') return t.toDate().getTime();
        if (t.seconds) return t.seconds * 1000;
        if (typeof t === 'number') return t;
        if (typeof t === 'string') return new Date(t).getTime();
        return 0;
      };
      return getMs(b.timestamp) - getMs(a.timestamp);
    });

    return list;
  } catch (e) {
    console.error('Error fetching transactions:', e);
    return [];
  }
}

// ==================== VOUCHERS ====================

export const VOUCHER_IMAGES: Record<string, any> = {
  '1': require('../../assets/vouchers/greensm_xanhwin.png'),
  'XANH_SM': require('../../assets/vouchers/greensm_xanhwin.png'),
  '2': require('../../assets/vouchers/highland_1uy1get1.png'),
  'HIGHLANDS': require('../../assets/vouchers/highland_1uy1get1.png'),
  '3': require('../../assets/vouchers/thecfhouse_donggia39.png'),
  'COFFEE_HOUSE': require('../../assets/vouchers/thecfhouse_donggia39.png'),
  '4': require('../../assets/vouchers/jollibee_15per.png'),
  'JOLLIBEE': require('../../assets/vouchers/jollibee_15per.png'),
};

export async function fetchVouchers(): Promise<VoucherItem[]> {
  try {
    const vouchersRef = collection(db, 'vouchers');
    const snapshot = await getDocs(vouchersRef);
    if (!snapshot.empty) {
      const list: VoucherItem[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const brandKey = (data.brand || '').toUpperCase().replace(/\s+/g, '_');
        list.push({
          id: docSnap.id,
          title: data.title || 'Voucher Ưu Đãi',
          brand: data.brand || 'Findora Partner',
          pointsCost: data.pointsCost || data.points || 50,
          discount: data.discount || 'Ưu đãi đặc biệt',
          icon: data.icon || 'gift',
          code: data.code || 'FINDORA_VIP',
          image: VOUCHER_IMAGES[docSnap.id] || VOUCHER_IMAGES[brandKey] || VOUCHER_IMAGES['1'],
          category: (data.category as any) || 'FOOD_BEVERAGE',
          remainingCount: data.remainingCount || 10,
          expiryDate: data.expiryDate || '31/12/2026'
        });
      });
      return list;
    }
  } catch (e) {
    console.log('Fetching Firestore vouchers fallback to catalog:', e);
  }

  // Industry Catalog Fallback (Ăn uống, Đi lại, Mua sắm, ...)
  return [
    {
      id: '1',
      title: 'Voucher giảm giá 25% tối đa 100k',
      brand: 'XANH SM',
      pointsCost: 20,
      discount: 'Giảm 25% chuyến đi',
      icon: 'car',
      code: 'XANHWIN',
      image: VOUCHER_IMAGES['1'],
      category: 'TRANSPORT',
      remainingCount: 15,
      expiryDate: '31/12/2026'
    },
    {
      id: '2',
      title: 'Voucher mua 1 tặng 1',
      brand: 'HIGHLANDS COFFEE',
      pointsCost: 30,
      discount: 'Mua 1 tặng 1',
      icon: 'cafe',
      code: 'BUY1GET1',
      image: VOUCHER_IMAGES['2'],
      category: 'FOOD_BEVERAGE',
      remainingCount: 20,
      expiryDate: '31/12/2026'
    },
    {
      id: '3',
      title: 'Voucher đồng giá 39k',
      brand: 'THE COFFEE HOUSE',
      pointsCost: 50,
      discount: 'Đồng giá 39k',
      icon: 'cafe',
      code: 'DONGIA39',
      image: VOUCHER_IMAGES['3'],
      category: 'FOOD_BEVERAGE',
      remainingCount: 25,
      expiryDate: '31/12/2026'
    },
    {
      id: '4',
      title: 'Voucher giảm giá 15% toàn menu',
      brand: 'JOLLIBEE VIỆT NAM',
      pointsCost: 80,
      discount: 'Giảm 15% menu',
      icon: 'restaurant',
      code: 'JOLLI15PER',
      image: VOUCHER_IMAGES['4'],
      category: 'FOOD_BEVERAGE',
      remainingCount: 30,
      expiryDate: '31/12/2026'
    }
  ];
}

export async function redeemVoucher(userId: string, voucher: VoucherItem): Promise<{ success: boolean; code?: string; message?: string }> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return { success: false, message: 'Không tìm thấy thông tin người dùng.' };

    const currentPoints = userSnap.data()?.points || 0;
    if (currentPoints < voucher.pointsCost) {
      return { success: false, message: 'Bạn không đủ điểm Findo để đổi voucher này.' };
    }

    const voucherCode = voucher.code || `FINDORA_${Math.floor(100000 + Math.random() * 900000)}`;

    // 1. Preserve highest level so user is NEVER demoted when spending points
    const existingLevel = userSnap.data()?.level;
    const currentPointsLevel = getLevelFromPoints(currentPoints);
    const lockedLevel = existingLevel || currentPointsLevel;

    // 2. Deduct points & lock user level
    await updateDoc(userRef, {
      points: increment(-voucher.pointsCost),
      level: lockedLevel,
    });

    // 2. Add to user_vouchers collection
    await addDoc(collection(db, 'user_vouchers'), {
      userId,
      voucherId: voucher.id,
      title: voucher.title,
      brand: voucher.brand,
      code: voucherCode,
      discount: voucher.discount,
      pointsCost: voucher.pointsCost,
      status: 'active',
      redeemedAt: serverTimestamp(),
      expiryDate: voucher.expiryDate || '31/12/2026'
    });

    // 3. Create transaction history record
    await addDoc(collection(db, 'transactions'), {
      userId,
      amount: -voucher.pointsCost,
      type: 'voucher',
      description: `Đổi voucher ${voucher.brand} - ${voucher.title}`,
      timestamp: serverTimestamp()
    }).catch(() => {});

    return { success: true, code: voucherCode };
  } catch (error: any) {
    console.error('Error redeeming voucher:', error);
    return { success: false, message: error.message || 'Lỗi xử lý đổi voucher' };
  }
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
  const q = query(commentsRef, where('postId', '==', postId));

  return onSnapshot(
    q, 
    (snapshot) => {
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

      // Sort client-side chronologically (earliest to latest) - avoids requiring Firestore composite index
      comments.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return timeA - timeB;
      });

      callback(comments);
    },
    (error) => {
      console.log('Comments listener error/permission notice:', error);
      callback([]);
    }
  );
}

export async function addComment(commentData: Omit<Comment, 'id'>): Promise<string> {
  const commentsRef = collection(db, 'comments');
  const docRef = await addDoc(commentsRef, {
    ...commentData,
    createdAt: serverTimestamp()
  });

  // Send notification to post author
  try {
    const postSnap = await getDoc(doc(db, 'posts', commentData.postId));
    if (postSnap.exists()) {
      const postData = postSnap.data();
      if (postData.userId && postData.userId !== commentData.userId) {
        const notifRef = collection(db, 'notifications');
        await addDoc(notifRef, {
          userId: postData.userId,
          title: `${commentData.userName} đã bình luận`,
          message: commentData.content,
          type: 'comment',
          postId: commentData.postId,
          senderId: commentData.userId,
          senderName: commentData.userName,
          senderAvatar: commentData.userAvatar || '',
          imageUrl: postData.imageUrl || '',
          createdAt: serverTimestamp(),
          read: false
        });
      }
    }
  } catch (e) {
    console.log('Error creating comment notification:', e);
  }

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
  const metadata = {
    contentType: 'image/jpeg',
  };
  await uploadBytes(storageRef, blob, metadata);
  return await getDownloadURL(storageRef);
}

export async function uploadAvatarImage(uri: string, userId: string): Promise<string> {
  const candidatePaths = [
    `images/${userId}/${Date.now()}.jpg`,
    `post_images/${userId}_avatar_${Date.now()}.jpg`,
    `avatars/${userId}/${Date.now()}.jpg`,
  ];

  for (const path of candidatePaths) {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const storageRef = ref(storage, path);
      const metadata = { contentType: 'image/jpeg' };
      await uploadBytes(storageRef, blob, metadata);
      return await getDownloadURL(storageRef);
    } catch (err: any) {
      console.log(`Notice: Upload to ${path} failed:`, err?.code || err?.message);
    }
  }

  // Resilient fallback: Convert to Base64 data URI if Firebase Storage security rules reject all write paths
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return `data:image/jpeg;base64,${base64}`;
  } catch (fsErr) {
    console.log('Notice: Base64 fallback notice:', fsErr);
    return uri;
  }
}

// ==================== LEADERBOARD ====================

const LEVEL_WEIGHTS: Record<string, number> = {
  'Huyền thoại': 4,
  'Thiên thần': 3,
  'Người tốt': 2,
  'Người mới': 1,
  'Tập sự': 1,
};

function sortLeaderboardUsers(a: User, b: User): number {
  const ptsA = a.points || 0;
  const ptsB = b.points || 0;
  if (ptsB !== ptsA) {
    return ptsB - ptsA;
  }
  // If points are equal or 0, prioritize users with higher level/rank:
  const weightA = LEVEL_WEIGHTS[a.level || ''] || LEVEL_WEIGHTS[a.levelBadge || ''] || 0;
  const weightB = LEVEL_WEIGHTS[b.level || ''] || LEVEL_WEIGHTS[b.levelBadge || ''] || 0;
  if (weightB !== weightA) {
    return weightB - weightA;
  }
  // Secondary tiebreaker: resolved cases count
  const resA = a.resolvedCount || 0;
  const resB = b.resolvedCount || 0;
  if (resB !== resA) {
    return resB - resA;
  }
  return (a.name || '').localeCompare(b.name || '');
}

export async function fetchLeaderboard(timeframe: 'WEEK' | 'MONTH' | 'ALL' = 'ALL'): Promise<User[]> {
  try {
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    const leaderboard: User[] = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const rawPoints = data.points !== undefined && data.points !== null ? Number(data.points) : 0;
      const level = data.level || getLevelFromPoints(rawPoints);
      const returnedCount = data.totalReturned ?? data.resolvedCount ?? 0;
      leaderboard.push({
        uid: docSnap.id,
        name: data.name || data.fullName || (data.email ? data.email.split('@')[0] : 'Người dùng Findora'),
        email: data.email || '',
        avatarUrl: data.avatarUrl || data.photoUrl || '',
        points: rawPoints,
        reputationScore: data.reputationScore || 100,
        resolvedCount: returnedCount,
        level: level,
        levelBadge: level,
      });
    });

    if (timeframe === 'ALL') {
      return leaderboard.sort(sortLeaderboardUsers);
    }

    // For WEEK or MONTH: calculate exact earned points in that timeframe
    try {
      const days = timeframe === 'WEEK' ? 7 : 30;
      const thresholdTime = Date.now() - days * 24 * 60 * 60 * 1000;
      const userEarnedMap = new Map<string, number>();

      // 1. Check current authenticated user's real transactions (allowed by security rules)
      if (auth.currentUser) {
        try {
          const myTxRef = collection(db, 'transactions');
          const myTxQ = query(myTxRef, where('userId', '==', auth.currentUser.uid));
          const myTxSnap = await getDocs(myTxQ);
          let myPointsInTimeframe = 0;

          myTxSnap.forEach((doc) => {
            const d = doc.data();
            const pts = Math.abs(d.points || d.amount || d.rewardPoints || 0);
            const typeStr = (d.type || '').toLowerCase();
            const isEarn = typeStr === 'reward' || typeStr === 'earn' || (d.amount !== undefined && d.amount > 0);

            if (isEarn && pts > 0) {
              let txMs = 0;
              if (d.timestamp?.toDate) txMs = d.timestamp.toDate().getTime();
              else if (d.timestamp?.seconds) txMs = d.timestamp.seconds * 1000;
              else if (d.createdAt?.toDate) txMs = d.createdAt.toDate().getTime();
              else if (d.createdAt?.seconds) txMs = d.createdAt.seconds * 1000;
              else if (typeof d.timestamp === 'number') txMs = d.timestamp;

              if (txMs >= thresholdTime) {
                myPointsInTimeframe += pts;
              }
            }
          });

          userEarnedMap.set(auth.currentUser.uid, myPointsInTimeframe);
        } catch (txErr) {
          console.log('Notice: My transactions query notice:', txErr);
        }
      }

      // 2. Check public resolved posts in that timeframe
      try {
        const postsRef = collection(db, 'posts');
        const postsSnap = await getDocs(postsRef);

        postsSnap.forEach((doc) => {
          const d = doc.data();
          const helperId = d.resolvedBy || d.helperId;
          const status = (d.status || '').toLowerCase();

          if (helperId && (status === 'resolved' || status === 'returned' || d.resolvedAt)) {
            let resMs = 0;
            if (d.resolvedAt?.toDate) resMs = d.resolvedAt.toDate().getTime();
            else if (d.resolvedAt?.seconds) resMs = d.resolvedAt.seconds * 1000;
            else if (d.updatedAt?.toDate) resMs = d.updatedAt.toDate().getTime();
            else if (d.updatedAt?.seconds) resMs = d.updatedAt.seconds * 1000;

            if (resMs >= thresholdTime) {
              const rPts = Number(d.rewardPoints) || 50;
              userEarnedMap.set(helperId, (userEarnedMap.get(helperId) || 0) + rPts);
            }
          }
        });
      } catch (postsErr) {
        console.log('Notice: Resolved posts query notice:', postsErr);
      }

      return leaderboard
        .map((u) => ({
          ...u,
          points: userEarnedMap.get(u.uid) || 0,
        }))
        .sort(sortLeaderboardUsers);
    } catch (err) {
      console.log('Error calculating timeframe points:', err);
    }

    return leaderboard.sort(sortLeaderboardUsers);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return [];
  }
}
