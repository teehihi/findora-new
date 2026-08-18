# 🔍 Findora — AI-Powered Lost & Found Platform

<p align="center">
  <img src="assets/images/Logo_noBG.png" alt="Findora Logo" width="140" />
</p>

<p align="center">
  <b>Nền tảng tìm kiếm đồ thất lạc & kết nối cộng đồng thông minh ứng dụng Google Gemini AI và định vị GPS thời gian thực.</b>
</p>

<p align="center">
  <a href="#-tính-năng-nổi-bật"><img src="https://img.shields.io/badge/Platform-React%20Native%20%7C%20Expo-000000.svg?style=for-the-badge&logo=expo" alt="Expo" /></a>
  <a href="#-công-nghệ-sử-dụng"><img src="https://img.shields.io/badge/AI-Google%20Gemini%20Flash-4285F4.svg?style=for-the-badge&logo=google" alt="Gemini AI" /></a>
  <a href="#-công-nghệ-sử-dụng"><img src="https://img.shields.io/badge/Backend-Firebase%20%7C%20Firestore-FFCA28.svg?style=for-the-badge&logo=firebase" alt="Firebase" /></a>
  <a href="#-công-nghệ-sử-dụng"><img src="https://img.shields.io/badge/Language-TypeScript-3178C6.svg?style=for-the-badge&logo=typescript" alt="TypeScript" /></a>
  <a href="#-giấy-phép"><img src="https://img.shields.io/badge/License-MIT-10B981.svg?style=for-the-badge" alt="License" /></a>
</p>

---

## 📖 Giới thiệu (Overview)

**Findora** là ứng dụng di động hỗ trợ người dùng đăng tin và tìm kiếm đồ đạc, thú cưng, giấy tờ tùy thân bị thất lạc hoặc nhặt được trong cộng đồng. Bằng việc kết hợp sức mạnh của **Google Gemini Vision AI**, hệ thống **định vị bản đồ tương tác** và công nghệ **WebRTC P2P Realtime**, Findora giúp rút ngắn tối đa thời gian kết nối giữa người mất đồ và người nhặt được đồ.

---

## ✨ Tính năng nổi bật (Key Features)

### 🤖 1. Trí tuệ nhân tạo nhận diện đồ vật (Gemini Vision AI)
- **Tự động nhận diện & Gợi ý:** Phân tích ảnh chụp qua Gemini 3.6 Flash để tự động điền tiêu đề, mô tả chi tiết, danh mục và từ khóa nhận diện.
- **Trích xuất thông tin thông minh (OCR):** Tự động nhận dạng họ tên, MSSV, số CCCD/GPLX từ thẻ sinh viên hoặc giấy tờ tùy thân.
- **Animation tải AI độc quyền:** Hiệu ứng 4 chấm màu Google xoay tụ hợp & gợn sóng sinh động trong lúc AI xử lý ảnh.

### 🎯 2. Thuật toán gợi ý ghép đôi đa chiều (AI Multi-Factor Matching)
- **So khớp thông minh:** Tự động tính toán điểm tương đồng dựa trên hình ảnh thị giác, từ khóa mô tả, khoảng cách địa lý (Haversine) và mốc thời gian thất lạc.
- **Nhận diện chính xác giấy tờ tùy thân:** Khử dấu tiếng Việt, phân tích MSSV/họ tên để tránh ghép nhầm người.
- **Lý do trùng khớp trực quan (Dynamic Signals):** Tự động hiển thị huy hiệu giải thích lý do ghép đôi trên 1 hàng ngang (vd: *✓ Trùng tên / mã số*, *✓ Cùng loại Thẻ sinh viên*, *✓ Cùng thương hiệu*, *✓ Khu vực lân cận*).

### 🗺️ 3. Bản đồ thất lạc tương tác (Interactive Maps & GPS)
- **Định vị & Dẫn đường chuẩn xác:** Hiển thị trực quan các vị trí rơi/nhặt đồ trên nền Google Maps với marker đại diện chân thực.
- **Bộ lọc bán kính & Danh mục:** Dễ dàng tìm kiếm đồ thất lạc xung quanh vị trí hiện tại của người dùng.
- **Xác nhận tọa độ kéo thả:** Hỗ trợ ghim vị trí chính xác kèm tự động chuyển đổi sang địa chỉ đường phố (Reverse Geocoding).

### 💬 4. Trò chuyện & Gọi thoại / Video thời gian thực (Messenger & WebRTC)
- **Nhắn tin tức thì (Optimistic UI):** Trò chuyện mượt mà với trạng thái gửi tin nhắn, bong bóng chat, đính kèm ảnh và trả lời tin nhắn.
- **Cuộc gọi P2P chất lượng cao:** Hỗ trợ gọi thoại (Voice Call) và gọi video (Video Call) độ trễ cực thấp sử dụng WebRTC kết hợp Firebase Realtime Signaling.
- **Global Incoming Call Modal:** Hiển thị popup nhận cuộc gọi toàn cục khi có người gọi đến ngay cả khi đang duyệt màn hình khác.

### 🏆 5. Hệ thống tích điểm & Đổi thưởng (Gamification & Rewards)
- **Điểm thưởng & Điểm uy tín:** Tặng điểm thưởng cho người dùng tích cực hỗ trợ tìm đồ và trả lại đồ nhặt được.
- **Chợ đổi Voucher:** Đổi điểm thưởng tích lũy lấy các voucher ưu đãi hấp dẫn.
- **Bảng xếp hạng cộng đồng:** Vinh danh những "Hiệp sĩ Findora" có nhiều đóng góp nhất.

### 🎨 6. Trải nghiệm người dùng cao cấp (Premium UI/UX)
- **Hiệu ứng Staggered Fade Modal:** Các popup xác nhận xóa bài, xem chi tiết thời gian xuất hiện theo tầng bậc mượt mà.
- **Thanh điều hướng nổi (Floating Liquid Bar):** Bottom Bar và nút thao tác nổi bóng đổ tinh tế, tương thích 100% cả iOS và Android.
- **Skeleton Shimmer Loading:** Khung xương tải trang mượt mà trong khi chờ dữ liệu Firestore.

---

## 📱 Giao diện ứng dụng (App Screenshots)

> *Hình ảnh giao diện thực tế sẽ được cập nhật.*

| Trang chủ (Home) | Bản đồ (Map) | AI Nhận diện (AI Vision) |
| :---: | :---: | :---: |
| *[Ảnh chụp màn hình]* | *[Ảnh chụp màn hình]* | *[Ảnh chụp màn hình]* |

| Chi tiết bài đăng (Detail) | Trò chuyện (Chat) | Cuộc gọi Video (WebRTC) |
| :---: | :---: | :---: |
| *[Ảnh chụp màn hình]* | *[Ảnh chụp màn hình]* | *[Ảnh chụp màn hình]* |

---

## 🛠️ Công nghệ sử dụng (Tech Stack)

| Thành phần | Công nghệ / Thư viện |
| :--- | :--- |
| **Frontend Framework** | [React Native](https://reactnative.dev/) (Expo SDK 52/53, Expo Router v4) |
| **Ngôn ngữ** | [TypeScript](https://www.typescriptlang.org/) (Strict Mode) |
| **Trí tuệ nhân tạo (AI)** | [Google Gemini 3.6 Flash](https://ai.google.dev/) (@google/generative-ai) |
| **Backend & Cơ sở dữ liệu** | [Firebase](https://firebase.google.com/) (Authentication, Cloud Firestore, Firebase Storage, Realtime DB) |
| **Bản đồ & GPS** | [react-native-maps](https://github.com/react-native-maps/react-native-maps), [expo-location](https://docs.expo.dev/versions/latest/sdk/location/) |
| **Realtime Video/Voice Call** | [react-native-webrtc](https://github.com/react-native-webrtc/react-native-webrtc) |
| **Giao diện & Chuyển động** | React Native Animated, Expo Vector Icons (Feather, Ionicons), SVG |
| **Bảo mật** | Environment Variables (.env), Google OAuth 2.0, Firestore Security Rules |

---

## 📂 Cấu trúc thư mục (Project Structure)

```text
GoogleAIRaiser/
├── assets/                    # Hình ảnh, biểu tượng logo & icons
├── src/
│   ├── app/                   # Expo Router (File-based Routing)
│   │   ├── (auth)/            # Màn hình Đăng nhập, Đăng ký, Quên mật khẩu
│   │   ├── (tabs)/            # 5 Tab chính: Home, Map, Matches, Chat, Profile
│   │   ├── chat/              # Màn hình Chat chi tiết & Video/Voice Call
│   │   ├── post/              # Chi tiết bài đăng, Đăng bài AI, Chỉnh sửa, Chọn vị trí
│   │   ├── profile/           # Chỉnh sửa hồ sơ cá nhân
│   │   └── wallet/            # Ví điểm thưởng, Bảng xếp hạng & Đổi Voucher
│   ├── components/            # Reusable UI Components
│   │   ├── MatchCard.tsx      # Thẻ gợi ý trùng khớp thông minh
│   │   ├── GoogleAILoader.tsx # Animation xoay chấm màu Google AI
│   │   ├── CustomTabBar.tsx   # Thanh điều hướng nổi đáy màn hình
│   │   ├── GlobalCallListener.tsx # Trình lắng nghe cuộc gọi WebRTC
│   │   └── ...                # Skeleton loaders, modals & buttons
│   ├── config/                # Cấu hình Firebase & dịch vụ bên ngoài
│   ├── constants/             # Bảng màu (Theme), khoảng cách (Spacing), kiểu chữ
│   ├── models/                # TypeScript Interfaces & Data Types
│   ├── services/              # Business Logic & Backend APIs
│   │   ├── aiMatching.ts      # Thuật toán so khớp đa chiều & gợi ý bài viết
│   │   ├── geminiService.ts   # Tích hợp Google Gemini Vision API
│   │   ├── firebaseService.ts # Thao tác CRUD Firestore & Storage
│   │   ├── signalingService.ts# Quản lý WebRTC Signaling
│   │   └── callManager.ts     # Quản lý trạng thái cuộc gọi thoại/video
│   └── utils/                 # Hàm tiện ích (Xử lý chuỗi, định dạng ngày, khoảng cách)
├── app.json                   # Cấu hình Expo App Manifest
├── package.json               # Quản lý dependencies & scripts
└── tsconfig.json              # Cấu hình TypeScript
```

---

## 🚀 Cài đặt & Khởi chạy (Getting Started)

### Yêu cầu môi trường (Prerequisites)
- [Node.js](https://nodejs.org/) (phiên bản 18.x trở lên)
- [npm](https://www.npmjs.com/) hoặc [yarn](https://yarnpkg.com/)
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- Điện thoại thật cài đặt **Expo Go** hoặc Máy ảo Android Emulator / iOS Simulator.

### 1. Clone repository
```bash
git clone https://github.com/teehihi/findora-new.git
cd findora-new
```

### 2. Cài đặt các gói phụ thuộc
```bash
npm install
```

### 3. Cấu hình biến môi trường
Tạo file `.env` tại thư mục gốc của dự án:
```env
EXPO_PUBLIC_GEMINI_API_KEY=your_google_gemini_api_key_here
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

### 4. Khởi chạy ứng dụng
```bash
npx expo start
```
- Nhấn `a` để mở trên máy ảo **Android Emulator**.
- Nhấn `i` để mở trên máy ảo **iOS Simulator**.
- Quét mã QR bằng ứng dụng **Expo Go** trên điện thoại thật.

---

## 🔒 Quy tắc bảo mật (Security & Safety)
- Toàn bộ thông tin cá nhân nhạy cảm trên giấy tờ (mã số, số điện thoại) được phân quyền hiển thị bảo mật.
- Kết nối gọi thoại & video WebRTC được mã hóa đầu-cuối Peer-to-Peer.
- API Key được bảo vệ an toàn thông qua biến môi trường và không commit lên repository công khai.

---

## 📄 Giấy phép (License)
Dự án được phân phối dưới giấy phép mã nguồn mở **MIT License**. Xem chi tiết tại file [LICENSE](LICENSE).

---

<p align="center">
  Được phát triển với ❤️ bởi <b>Nhóm phát triển Findora</b> — Mang lại hy vọng cho những món đồ thất lạc.
</p>
