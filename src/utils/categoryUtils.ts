import { Ionicons } from '@expo/vector-icons';

export interface CategoryInfo {
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
}

/**
 * Intelligent categorization for lost & found items based on image label, category, title, and description.
 */
export function getDisplayCategory(post: {
  category?: string;
  imageLabel?: string;
  title?: string;
  description?: string;
}): CategoryInfo {
  const label = (post.imageLabel || '').toLowerCase().trim();
  const rawCat = (post.category || '').toLowerCase().trim();
  const text = `${post.title || ''} ${post.description || ''}`.toLowerCase();

  // 1. Identity cards & student documents
  if (
    label === 'card' ||
    label === 'id_card' ||
    label === 'student_id' ||
    label === 'document' ||
    /thẻ sinh viên|the sinh vien|thẻ sv|cccd|cmnd|căn cước|bằng lái|giấy phép lái xe|gplx|thẻ atm|thẻ ngân hàng|bhyt|bảo hiểm y tế|hộ chiếu|passport|cà vẹt|giấy tờ/i.test(text)
  ) {
    if (/thẻ sinh viên|the sinh vien|thẻ sv/i.test(text)) {
      return { name: 'Thẻ sinh viên', icon: 'card-outline' };
    }
    if (/cccd|cmnd|căn cước công dân|căn cước/i.test(text)) {
      return { name: 'Căn cước công dân', icon: 'card-outline' };
    }
    if (/bằng lái|giấy phép lái xe|gplx/i.test(text)) {
      return { name: 'Bằng lái xe', icon: 'card-outline' };
    }
    if (/thẻ atm|thẻ ngân hàng|visa|mastercard|napas/i.test(text)) {
      return { name: 'Thẻ ngân hàng', icon: 'card-outline' };
    }
    if (/hộ chiếu|passport/i.test(text)) {
      return { name: 'Hộ chiếu', icon: 'book-outline' };
    }
    if (/bhyt|bảo hiểm y tế/i.test(text)) {
      return { name: 'Bảo hiểm y tế', icon: 'document-text-outline' };
    }
    return { name: 'Giấy tờ tùy thân', icon: 'card-outline' };
  }

  // 2. Wallets & Purses
  if (label === 'wallet' || /ví|bóp|wallet|ví tiền|bóp tiền|ví da/i.test(text)) {
    return { name: 'Ví / Bóp tiền', icon: 'wallet-outline' };
  }

  // 3. Phones & Smartphones
  if (label === 'phone' || label === 'smartphone' || /điện thoại|smartphone|iphone|samsung|oppo|xiaomi|redmi|vivo|realme/i.test(text)) {
    return { name: 'Điện thoại', icon: 'phone-portrait-outline' };
  }

  // 4. Keys & Smartkeys
  if (label === 'keys' || label === 'key' || /chìa khóa|chùm khóa|smartkey|khóa xe|chìa khoá/i.test(text)) {
    return { name: 'Chìa khóa', icon: 'key-outline' };
  }

  // 5. Laptops & Computers
  if (label === 'laptop' || label === 'computer' || /laptop|macbook|máy tính|ipad|tablet|máy tính bảng/i.test(text)) {
    return { name: 'Laptop / Máy tính', icon: 'laptop-outline' };
  }

  // 6. Audio & Accessories
  if (label === 'earphones' || label === 'headphones' || /tai nghe|airpod|headphone|sạc|cáp sạc|cục sạc|dây sạc|chuột máy tính/i.test(text)) {
    return { name: 'Tai nghe / Phụ kiện', icon: 'headset-outline' };
  }

  // 7. Watches
  if (label === 'watch' || label === 'smartwatch' || /đồng hồ|apple watch|smartwatch|đồng hồ đeo tay/i.test(text)) {
    return { name: 'Đồng hồ', icon: 'watch-outline' };
  }

  // 8. Pets & Animals
  if (label === 'pet' || label === 'dog' || label === 'cat' || /chó|mèo|cún|mèo con|chó con|thú cưng|pet/i.test(text)) {
    return { name: 'Thú cưng', icon: 'paw-outline' };
  }

  // 9. Bags & Backpacks
  if (label === 'bag' || label === 'backpack' || label === 'handbag' || /balo|ba lô|cặp sách|túi xách|túi đeo chéo|vali/i.test(text)) {
    return { name: 'Balo / Túi xách', icon: 'briefcase-outline' };
  }

  // 10. Glasses
  if (label === 'glasses' || /kính|mắt kính|kính cận|kính râm/i.test(text)) {
    return { name: 'Mắt kính', icon: 'glasses-outline' };
  }

  // 11. Helmets
  if (label === 'helmet' || /mũ bảo hiểm|nón bảo hiểm/i.test(text)) {
    return { name: 'Mũ bảo hiểm', icon: 'shield-outline' };
  }

  // 12. Jewelry
  if (label === 'jewelry' || label === 'ring' || label === 'necklace' || /nhẫn|dây chuyền|vòng tay|bông tai|hoa tai|lắc tay|trang sức/i.test(text)) {
    return { name: 'Trang sức', icon: 'diamond-outline' };
  }

  // 13. Clothing & Apparel
  if (label === 'clothing' || /quần áo|áo khoác|áo len|váy|giày|dép|nón|mũ/i.test(text)) {
    return { name: 'Trang phục / Quần áo', icon: 'shirt-outline' };
  }

  // 14. Electronics general
  if (label === 'electronics' || /thiết bị điện tử|loa|máy ảnh|camera/i.test(text)) {
    return { name: 'Thiết bị điện tử', icon: 'hardware-chip-outline' };
  }

  // 15. Explicit existing Vietnamese category
  if (rawCat && rawCat !== 'other' && rawCat !== 'đồ cá nhân' && rawCat !== 'item') {
    return { name: post.category!, icon: 'grid-outline' };
  }

  return { name: 'Đồ dùng cá nhân', icon: 'grid-outline' };
}
