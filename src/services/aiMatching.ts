import { Post, MatchResult } from '../models/types';

const MIN_MATCH_SCORE = 0.2;
const ABSOLUTE_MAX_DISTANCE_KM = 500.0;
const MAX_DISTANCE_KM = 50.0;
const MAX_TIME_DIFF_DAYS = 30;

/**
 * Removes Vietnamese diacritics / accents for robust matching
 */
function removeVietnameseDiacritics(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

/**
 * Checks if a post represents a personal identity document / card
 */
function isIdentityDocument(post: Post): boolean {
  const label = (post.imageLabel || '').toLowerCase();
  if (label === 'card' || label === 'document') return true;

  const text = removeVietnameseDiacritics(`${post.title} ${post.description}`);
  const docKeywords = [
    'the sinh vien', 'the sv', 'cccd', 'cmnd', 'can cuoc', 'bang lai',
    'gplx', 'the ngan hang', 'the atm', 'giay to', 'bao hiem', 'bhyt',
    'ho chieu', 'passport', 'student id', 'id card', 'the xe'
  ];
  return docKeywords.some(kw => text.includes(kw));
}

/**
 * Extracts proper person names and identification / student numbers from a post
 */
function extractIdentifiers(post: Post): { names: string[]; idNumbers: string[] } {
  const textRaw = `${post.title} ${post.description}`;
  const textClean = removeVietnameseDiacritics(textRaw);

  // 1. Extract ID Numbers (sequences of 6 to 12 digits)
  const idNumbers: string[] = [];
  const idRegex = /(?:mssv|ma so|so|id|cccd|cmnd)?[:\s]*([0-9]{6,12})/gi;
  let match;
  while ((match = idRegex.exec(textClean)) !== null) {
    if (match[1]) idNumbers.push(match[1]);
  }

  // 2. Extract Candidate Person Names (2 to 4 capitalized Vietnamese words)
  const names: string[] = [];
  const nameRegex = /\b([A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹ]+){1,3})\b/g;
  while ((match = nameRegex.exec(textRaw)) !== null) {
    const candidate = match[1].trim();
    const candidateNorm = removeVietnameseDiacritics(candidate);
    // Ignore institution names, locations, brands & generic phrases
    const ignoredKeywords = [
      'dai hoc', 'truong dai hoc', 'khoa hoc', 'tu nhien', 'su pham', 'ky thuat',
      'bach khoa', 'kinh te', 'luat', 'y duoc', 'nong lam', 'ngan hang',
      'findora', 'vietcombank', 'vietinbank', 'bidv', 'agribank', 'tp hcm', 'ho chi minh',
      'viet nam', 'thanh pho', 'quan thu duc', 'linh chieu', 'sinh vien', 'the sinh vien',
      'can cuoc', 'cong dan', 'giay phep', 'lai xe', 'nhat duoc', 'bao mat', 'that lac'
    ];
    if (!ignoredKeywords.some(ign => candidateNorm.includes(ign) || ign.includes(candidateNorm))) {
      names.push(candidateNorm);
    }
  }

  return { names, idNumbers };
}

/**
 * Checks if two identity document posts belong to completely different individuals
 */
function checkDocumentMismatch(post1: Post, post2: Post): { isMismatch: boolean; isExactMatch: boolean } {
  if (!isIdentityDocument(post1) || !isIdentityDocument(post2)) {
    return { isMismatch: false, isExactMatch: false };
  }

  const id1 = extractIdentifiers(post1);
  const id2 = extractIdentifiers(post2);

  // Case 1: Both posts have explicit ID/MSSV numbers
  if (id1.idNumbers.length > 0 && id2.idNumbers.length > 0) {
    const hasCommonId = id1.idNumbers.some(num1 => id2.idNumbers.includes(num1));
    if (hasCommonId) {
      return { isMismatch: false, isExactMatch: true };
    } else {
      return { isMismatch: true, isExactMatch: false };
    }
  }

  // Case 2: Both posts have extracted person names
  if (id1.names.length > 0 && id2.names.length > 0) {
    let nameMatchFound = false;
    for (const n1 of id1.names) {
      for (const n2 of id2.names) {
        if (n1 === n2 || n1.includes(n2) || n2.includes(n1)) {
          nameMatchFound = true;
          break;
        }
      }
      if (nameMatchFound) break;
    }

    if (nameMatchFound) {
      return { isMismatch: false, isExactMatch: true };
    } else {
      // Names are clearly different (e.g., 'Phạm Văn Hậu' vs 'Nguyễn Thị Thuỳ Trang')
      return { isMismatch: true, isExactMatch: false };
    }
  }

  return { isMismatch: false, isExactMatch: false };
}

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
    'ví tiền', 'đồng hồ', 'nhẫn', 'vòng', 'dây chuyền', 'bông tai', 'lắc tay',
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
 * Image Similarity (Label Matching)
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
 * Infers rich, human-friendly matching reasons based on multi-dimensional signal analysis
 */
export function inferMatchReasons(
  post1: Post,
  post2: Post,
  imageScore: number,
  contentScore: number,
  distanceKm?: number,
  isExactMatch?: boolean
): string[] {
  const reasons: string[] = [];

  const text1 = removeVietnameseDiacritics(`${post1.title} ${post1.description}`);
  const text2 = removeVietnameseDiacritics(`${post2.title} ${post2.description}`);

  // 1. Identity & Card Exact Match (Highest Priority)
  if (isExactMatch) {
    reasons.push('Trùng tên / mã số');
  }

  // 2. High Visual Similarity (AI Image Match)
  if (imageScore >= 0.4) {
    reasons.push('Hình ảnh giống nhau');
  }

  // 3. Specific Item / Category Type Matching
  const typeChecks = [
    { keywords: ['the sinh vien', 'the sv', 'student id'], label: 'Cùng loại Thẻ sinh viên' },
    { keywords: ['cccd', 'cmnd', 'can cuoc'], label: 'Cùng loại Căn cước' },
    { keywords: ['bang lai', 'gplx', 'giay phep lai xe'], label: 'Cùng loại Bằng lái' },
    { keywords: ['the ngan hang', 'the atm'], label: 'Cùng loại Thẻ ngân hàng' },
    { keywords: ['vi', 'bop', 'vi tien', 'wallet'], label: 'Cùng loại Ví / Bóp tiền' },
    { keywords: ['iphone', 'dien thoai', 'samsung', 'oppo', 'xiaomi', 'redmi', 'phone'], label: 'Cùng dòng Điện thoại' },
    { keywords: ['laptop', 'macbook', 'may tinh'], label: 'Cùng loại Laptop' },
    { keywords: ['chia khoa', 'chia khoa xe', 'key'], label: 'Cùng loại Chìa khóa' },
    { keywords: ['tai nghe', 'airpod', 'headphone'], label: 'Cùng loại Tai nghe' },
    { keywords: ['bia', 'beer', 'saigon', 'tiger', 'heineken', 'larue', 'lager', 'lon bia', 'thung bia', 'nuoc ngot', 'do uong'], label: 'Cùng loại Bia / Đồ uống' },
    { keywords: ['nhan', 'nhan vang', 'day chuyen', 'vong tay', 'lac tay', 'trang suc'], label: 'Cùng loại Trang sức' },
    { keywords: ['non', 'mu', 'non bao hiem', 'helmet'], label: 'Cùng loại Nón bảo hiểm' },
    { keywords: ['meo', 'cho', 'thu cung', 'pet'], label: 'Cùng loại Thú cưng' },
    { keywords: ['balo', 'tui xach', 'cap sach'], label: 'Cùng loại Balo / Túi' },
    { keywords: ['dong ho', 'watch'], label: 'Cùng loại Đồng hồ' },
    { keywords: ['kinh', 'mat kinh', 'kinh mat'], label: 'Cùng loại Mắt kính' },
    { keywords: ['sach', 'vo', 'tai lieu', 'giao trinh'], label: 'Cùng loại Sách / Giáo trình' },
  ];

  for (const tc of typeChecks) {
    const m1 = tc.keywords.some(kw => text1.includes(kw));
    const m2 = tc.keywords.some(kw => text2.includes(kw));
    if (m1 && m2) {
      if (!reasons.includes(tc.label)) {
        reasons.push(tc.label);
      }
      break;
    }
  }

  // 4. Organization / School / Specific Brand Matching
  const brands = [
    { keywords: ['saigon', 'bia saigon', 'sabeco', 'lager'], label: 'Cùng nhãn hiệu Bia Saigon' },
    { keywords: ['tiger', 'tiger bạc', 'tiger crystal'], label: 'Cùng nhãn hiệu Bia Tiger' },
    { keywords: ['heineken', 'ken'], label: 'Cùng nhãn hiệu Heineken' },
    { keywords: ['su pham ky thuat', 'spkt', 'ute', 'hcmute'], label: 'Cùng trường SPKT' },
    { keywords: ['khoa hoc tu nhien', 'khtn', 'hcmus'], label: 'Cùng trường KHTN' },
    { keywords: ['bach khoa', 'bku', 'hcmut'], label: 'Cùng trường Bách Khoa' },
    { keywords: ['kinh te', 'ueh'], label: 'Cùng trường ĐH Kinh Tế' },
    { keywords: ['quoc gia', 'dhqg', 'vnuhcm'], label: 'Cùng khu vực ĐHQG' },
    { keywords: ['hutech'], label: 'Cùng trường HUTECH' },
    { keywords: ['vietcombank', 'vcb'], label: 'Cùng Vietcombank' },
    { keywords: ['mbbank', 'mb bank'], label: 'Cùng MB Bank' },
    { keywords: ['techcombank', 'tcb'], label: 'Cùng Techcombank' },
    { keywords: ['apple', 'iphone', 'ipad'], label: 'Cùng hãng Apple' },
    { keywords: ['samsung', 'galaxy'], label: 'Cùng hãng Samsung' },
    { keywords: ['honda', 'vision', 'wave', 'airblade', 'lead'], label: 'Cùng dòng xe Honda' },
    { keywords: ['yamaha', 'exciter', 'grande', 'janus'], label: 'Cùng dòng xe Yamaha' },
  ];

  for (const b of brands) {
    const m1 = b.keywords.some(kw => text1.includes(kw));
    const m2 = b.keywords.some(kw => text2.includes(kw));
    if (m1 && m2) {
      if (!reasons.includes(b.label)) {
        reasons.push(b.label);
      }
      break;
    }
  }

  // 5. Content / Keyword Similarity
  if (contentScore >= 0.35 && !reasons.includes('Thông tin phù hợp')) {
    reasons.push('Thông tin phù hợp');
  }

  // 6. Location Proximity
  if (distanceKm != null && distanceKm <= 1.5) {
    reasons.push('Khu vực rất gần (< 1.5km)');
  } else if (distanceKm != null && distanceKm <= 5) {
    reasons.push('Khu vực lân cận');
  }

  // 7. Time Proximity
  if (post1.createdAt && post2.createdAt) {
    try {
      const t1 = post1.createdAt.toDate ? post1.createdAt.toDate().getTime() : new Date(post1.createdAt).getTime();
      const t2 = post2.createdAt.toDate ? post2.createdAt.toDate().getTime() : new Date(post2.createdAt).getTime();
      if (!isNaN(t1) && !isNaN(t2)) {
        const diffHours = Math.abs(t1 - t2) / (1000 * 3600);
        if (diffHours <= 24) {
          reasons.push('Thất lạc trong ngày');
        } else if (diffHours <= 72) {
          reasons.push('Thời gian gần nhau');
        }
      }
    } catch {}
  }

  // 8. General fallbacks if needed
  if (reasons.length < 2) {
    if (contentScore >= 0.2 && !reasons.includes('Thông tin phù hợp')) {
      reasons.push('Thông tin phù hợp');
    }
    if (imageScore > 0.2 && !reasons.includes('Hình ảnh tương đồng') && !reasons.includes('Hình ảnh giống nhau')) {
      reasons.push('Hình ảnh tương đồng');
    }
    if (reasons.length === 0) {
      reasons.push('Đặc điểm tương đồng');
      reasons.push('Thông tin phù hợp');
    } else if (reasons.length === 1) {
      reasons.push('Thông tin phù hợp');
    }
  }

  return reasons;
}

/**
 * Calculates Match Score between 2 posts with intelligent document identity verification
 */
export function calculateMatchScore(post1: Post, post2: Post): MatchResult {
  // 1. Check Identity Document Mismatch
  const { isMismatch, isExactMatch } = checkDocumentMismatch(post1, post2);
  if (isMismatch) {
    // Different owner names / ID numbers -> Completely distinct items (0% match)
    return {
      post: post2,
      score: 0,
      percentage: 0,
      imageScore: 0,
      contentScore: 0,
      locationScore: 0,
      distanceKm: undefined,
      reasons: []
    };
  }

  const imageScore = calculateImageSimilarity(post1, post2);
  const hasImageMatch = Boolean(post1.imageLabel && post2.imageLabel);

  const contentScore = calculateContentSimilarity(post1, post2);
  const { score: locationScore, distanceKm } = calculateLocationScore(post1, post2);

  let totalScore = 0;
  if (isExactMatch) {
    // Both documents share the exact owner name / student ID -> High confidence match (95%)
    totalScore = 0.95;
  } else if (hasImageMatch) {
    totalScore = imageScore * 0.5 + contentScore * 0.4 + locationScore * 0.1;
  } else {
    totalScore = contentScore * 0.8 + locationScore * 0.2;
  }

  const finalImageScore = isExactMatch ? 1.0 : imageScore;
  const finalContentScore = isExactMatch ? 1.0 : contentScore;

  const reasons = inferMatchReasons(post1, post2, finalImageScore, finalContentScore, distanceKm, isExactMatch);

  return {
    post: post2,
    score: totalScore,
    percentage: Math.round(totalScore * 100),
    imageScore: finalImageScore,
    contentScore: finalContentScore,
    locationScore,
    distanceKm,
    reasons
  };
}

/**
 * Finds all matching posts for a given post
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
