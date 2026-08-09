import { Post, MatchResult } from '../models/types';

const MIN_MATCH_SCORE = 0.2;
const ABSOLUTE_MAX_DISTANCE_KM = 500.0;
const MAX_DISTANCE_KM = 50.0;
const MAX_TIME_DIFF_DAYS = 30;

/**
 * Calculates distance in kilometers between two lat/lng pairs using Haversine formula
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates keyword bonus (+10% for each matching key word)
 */
function calculateKeywordBonus(text1: string, text2: string): number {
  const keywords = [
    'mèo', 'chó', 'thú cưng', 'pet', 'con mèo', 'con chó',
    'ví', 'điện thoại', 'iphone', 'samsung', 'oppo', 'xiaomi', 'vivo',
    'laptop', 'máy tính', 'macbook', 'ipad', 'tablet', 'tai nghe', 'airpod',
    'chìa khóa', 'chìa khoá', 'xe', 'xe máy', 'ô tô', 'túi xách', 'ba lô', 'cặp',
    'ví tiền', 'thẻ', 'cmnd', 'cccd', 'bằng lái', 'giấy tờ',
    'đồng hồ', 'nhẫn', 'vòng', 'dây chuyền', 'bông tai', 'lắc tay',
    'áo', 'quần', 'giày', 'dép', 'mũ', 'kính', 'kính mắt',
    'sách', 'vở', 'bút', 'cặp sách', 'balo', 'key', 'cat', 'dog', 'wallet', 'phone'
  ];

  let matchCount = 0;
  const t1 = text1.toLowerCase();
  const t2 = text2.toLowerCase();

  for (const keyword of keywords) {
    if (t1.includes(keyword) && t2.includes(keyword)) {
      matchCount++;
    }
  }

  return matchCount * 0.1;
}

/**
 * Title Similarity (Jaccard + Keyword Bonus)
 */
function calculateTitleSimilarity(post1: Post, post2: Post): number {
  const title1 = post1.title.toLowerCase();
  const title2 = post2.title.toLowerCase();

  const words1 = title1.split(/\s+/).filter(w => w.length > 1);
  const words2 = title2.split(/\s+/).filter(w => w.length > 1);

  const set1 = new Set(words1);
  const set2 = new Set(words2);

  const intersection = new Set([...set1].filter(w => set2.has(w)));
  const union = new Set([...set1, ...set2]);

  if (union.size === 0) return 0.0;

  const jaccard = intersection.size / union.size;
  const keywordBonus = calculateKeywordBonus(title1, title2) * 3.0;

  return Math.min(1.0, jaccard + keywordBonus);
}

/**
 * Description Similarity (Jaccard + Keyword Bonus)
 */
function calculateTextSimilarity(post1: Post, post2: Post): number {
  const text1 = `${post1.title} ${post1.description}`.toLowerCase();
  const text2 = `${post2.title} ${post2.description}`.toLowerCase();

  const words1 = text1.split(/\s+/).filter(w => w.length > 2);
  const words2 = text2.split(/\s+/).filter(w => w.length > 2);

  const set1 = new Set(words1);
  const set2 = new Set(words2);

  const intersection = new Set([...set1].filter(w => set2.has(w)));
  const union = new Set([...set1, ...set2]);

  if (union.size === 0) return 0.0;

  const jaccard = intersection.size / union.size;
  const keywordBonus = calculateKeywordBonus(text1, text2);

  return Math.min(1.0, jaccard + keywordBonus);
}

/**
 * Content Similarity (70% Title + 30% Description)
 */
function calculateContentSimilarity(post1: Post, post2: Post): number {
  const titleScore = calculateTitleSimilarity(post1, post2);
  const descScore = calculateTextSimilarity(post1, post2);
  return titleScore * 0.7 + descScore * 0.3;
}

/**
 * Image Similarity (TensorFlow Lite Label Matching)
 */
function calculateImageSimilarity(post1: Post, post2: Post): number {
  const label1 = post1.imageLabel;
  const label2 = post2.imageLabel;

  if (!label1 || !label2) return 0.0;

  if (label1.toLowerCase() === label2.toLowerCase()) {
    const conf1 = post1.confidence !== undefined ? post1.confidence : 0.5;
    const conf2 = post2.confidence !== undefined ? post2.confidence : 0.5;
    return (conf1 + conf2) / 2.0;
  }

  return 0.0;
}

/**
 * Location Score (Distance based)
 */
function calculateLocationScore(post1: Post, post2: Post): { score: number; distanceKm?: number } {
  if (
    post1.lat == null ||
    post1.lng == null ||
    post2.lat == null ||
    post2.lng == null
  ) {
    return { score: 0.5 };
  }

  const distance = calculateDistance(post1.lat, post1.lng, post2.lat, post2.lng);

  if (distance <= 1.0) return { score: 1.0, distanceKm: distance };
  if (distance >= MAX_DISTANCE_KM) return { score: 0.0, distanceKm: distance };

  return { score: 1.0 - distance / MAX_DISTANCE_KM, distanceKm: distance };
}

/**
 * Calculates Match Score between 2 posts
 */
export function calculateMatchScore(post1: Post, post2: Post): MatchResult {
  const imageScore = calculateImageSimilarity(post1, post2);
  const hasImageMatch = Boolean(post1.imageLabel && post2.imageLabel);

  const contentScore = calculateContentSimilarity(post1, post2);
  const { score: locationScore, distanceKm } = calculateLocationScore(post1, post2);

  let totalScore = 0;
  if (hasImageMatch) {
    totalScore = imageScore * 0.5 + contentScore * 0.4 + locationScore * 0.1;
  } else {
    totalScore = contentScore * 0.8 + locationScore * 0.2;
  }

  return {
    post: post2,
    score: totalScore,
    percentage: Math.round(totalScore * 100),
    imageScore,
    contentScore,
    locationScore,
    distanceKm
  };
}

/**
 * Finds all matching posts for a given post (1:1 port of AIMatchingHelper.findMatches)
 */
export function findMatches(currentPost: Post, allPosts: Post[]): MatchResult[] {
  const matches: MatchResult[] = [];
  const targetType = currentPost.type === 'lost' ? 'found' : 'lost';

  for (const post of allPosts) {
    // Skip if not opposite type
    if (post.type !== targetType) continue;

    // Skip if same user
    if (post.userId === currentPost.userId) continue;

    // Skip if resolved or closed
    if (post.status === 'resolved' || post.status === 'closed') continue;

    // Absolute distance check (> 500km)
    if (
      currentPost.lat != null &&
      currentPost.lng != null &&
      post.lat != null &&
      post.lng != null
    ) {
      const distance = calculateDistance(
        currentPost.lat,
        currentPost.lng,
        post.lat,
        post.lng
      );
      if (distance > ABSOLUTE_MAX_DISTANCE_KM) continue;
    }

    const matchResult = calculateMatchScore(currentPost, post);

    if (matchResult.score >= MIN_MATCH_SCORE) {
      matches.push(matchResult);
    }
  }

  // Sort descending by score
  matches.sort((a, b) => b.score - a.score);

  return matches;
}
