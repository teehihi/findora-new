<p align="center">
  <img src="assets/readme/findora-ai-riser.png" alt="Findora — Intelligent Lost & Found" width="100%" />
</p>

<h1 align="center">Findora</h1>

<p align="center">
  <strong>Đồ thất lạc có thể tìm lại. Kết nối người mất và người nhặt bằng AI, bản đồ và cộng đồng.</strong><br />
  An AI-assisted lost-and-found app built to help belongings find their way home.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/AI%20Riser%20Vietnam%202026-Top%2050-4285F4?style=for-the-badge&logo=google" alt="Top 50 — AI Riser Vietnam 2026" />
  <img src="https://img.shields.io/badge/Expo-SDK%2057-111827?style=for-the-badge&logo=expo" alt="Expo SDK 57" />
  <img src="https://img.shields.io/badge/AI-Google%20Gemini-8E75B2?style=for-the-badge&logo=googlegemini" alt="Google Gemini" />
  <img src="https://img.shields.io/badge/React%20Native-TypeScript-3178C6?style=for-the-badge&logo=typescript" alt="React Native and TypeScript" />
</p>

<p align="center">
  <a href="#demo">▶ Xem demo</a> ·
  <a href="#tính-năng">Tính năng</a> ·
  <a href="#bắt-đầu">Cài đặt</a> ·
  <a href="https://gdg.community.dev/events/details/google-gdg-live-vietnam-presents-su-kien-kick-off-ai-riser-vietnam-2026-bien-y-tuong-thanh-san-pham/">AI Riser Vietnam</a>
</p>

---

## 🏆 Top 50 — AI Riser Vietnam 2026

Findora là dự án của **Nguyễn Nhật Thiên**, builder được chứng nhận **Top 50** tại AI Riser Vietnam 2026 — chương trình xây dựng sản phẩm với Google AI, cùng cộng đồng Google Developer Groups tại Việt Nam.

AI Riser Vietnam 2026 thu hút hơn **10.000 lượt tham gia** và ghi nhận **750 dự án** phát triển trên Google AI Studio; 10 dự án được chọn trình bày tại Demo Day. [Sở Khoa học và Công nghệ TP.HCM](https://dost.hochiminhcity.gov.vn/chuyen-doi-so/cong-bo-ket-qua-ai-riser-viet-nam-2026-ton-vinh-cac-giai-phap-ai-thuc-tien/)

<p align="center">
  <a href="assets/readme/ai-riser-top50-certificate.png">
    <img src="assets/readme/ai-riser-top50-certificate.png" alt="Chứng nhận Top 50 AI Riser Vietnam 2026 của Nguyễn Nhật Thiên" width="760" />
  </a>
</p>

---

## Findora là gì?

> Bài đăng đồ thất lạc thường nằm rải rác ở nhiều nhóm và khó tìm theo vị trí. Findora gom việc **báo mất, báo nhặt, tìm kiếm và trao trả** vào một ứng dụng di động — để người cần tìm có thể sớm gặp người đã nhặt được.

Gemini hỗ trợ phân tích ảnh và soạn thông tin bài đăng. Bản đồ giúp tìm quanh khu vực, còn hệ thống ghép đôi xếp hạng các bài có khả năng liên quan dựa trên mô tả, loại đồ, thời gian và khoảng cách.

## Demo

<table>
  <tr>
    <td width="38%" align="center">
      <a href="assets/readme/findora-post-demo.mp4">
        <img src="assets/readme/findora-post-demo.gif" alt="Demo Findora: tạo bài báo nhặt được và xác nhận đăng thành công" width="280" />
      </a>
    </td>
    <td>
      <h3>Đăng một món đồ nhặt được</h3>
      <p>Video ngắn cho thấy luồng tạo bài đăng trên Findora. Bấm vào ảnh động để mở video MP4.</p>
      <p><a href="assets/readme/findora-post-demo.mp4">▶ Xem video demo (MP4)</a></p>
    </td>
  </tr>
</table>

## Tính năng

| | Findora giúp bạn |
|:--|:--|
| 📸 **Đăng tin có AI hỗ trợ** | Phân tích ảnh bằng Google Gemini để gợi ý tiêu đề, mô tả và danh mục; người đăng xem lại trước khi gửi. |
| 📍 **Tìm quanh bạn** | Xem bài báo mất và báo nhặt trên bản đồ, lọc theo vị trí và khoảng cách. |
| 🧩 **Gợi ý bài trùng khớp** | Xếp hạng dựa trên thông tin đồ vật, từ khóa, thời gian và vị trí; hiển thị tín hiệu giải thích vì sao hai bài có thể liên quan. |
| 🤝 **Trao trả có kết nối** | Nhắn tin, hẹn thời gian gặp, gọi thoại/video và xác minh ảnh bàn giao. |
| 🌱 **Cộng đồng cùng đóng góp** | Tích điểm khi hỗ trợ trao trả, đổi voucher và xem bảng xếp hạng người dùng tích cực. |

## Công nghệ

| Lớp | Công nghệ |
|:--|:--|
| Ứng dụng | React Native 0.86 · Expo SDK 57 · Expo Router · TypeScript |
| AI | Google Gemini API — phân tích ảnh, hỗ trợ hẹn gặp và xác minh bàn giao |
| Dữ liệu & tài khoản | Firebase Authentication · Cloud Firestore · Realtime Database · Storage |
| Vị trí | `react-native-maps` · `expo-location` |
| Gọi thời gian thực | `react-native-webrtc` · Firebase Realtime Database signaling |

## Bắt đầu

### Yêu cầu

- Node.js và npm
- Android Studio hoặc Xcode nếu muốn chạy native trên thiết bị / simulator

### Cài đặt và chạy

```bash
git clone https://github.com/teehihi/findora-new.git
cd findora-new
npm install
```

Tạo file `.env` ở thư mục gốc và điền các khóa client của dự án:

```env
EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
EXPO_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
```

Các giá trị Firebase còn lại được khai báo trong `src/config/firebase.ts`. `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` được dùng cho một số thao tác bản đồ. Khóa SDK Google Maps Android nằm tại `expo.android.config.googleMaps.apiKey` trong `app.json`; hãy thay bằng khóa của bạn và giới hạn theo ứng dụng trước khi phát hành.

```bash
npx expo start
```

`react-native-webrtc` cần native module, vì vậy hãy dùng development build để thử tính năng gọi thoại/video; Expo Go không bao gồm module này.

## Bảo mật cấu hình

- File `.env` đã được Git ignore. Không commit Gemini key, mật khẩu, service-account key hoặc thông tin đăng nhập máy chủ.
- Expo thay thế `EXPO_PUBLIC_*` bằng giá trị thật trong JavaScript bundle; người dùng có thể đọc các giá trị này từ bản build. Không xem chúng là bí mật. Hãy giới hạn API key và dùng backend làm proxy nếu cần giữ Gemini key riêng tư. [Expo SDK 57: biến môi trường](https://docs.expo.dev/versions/v57.0.0/guides/environment-variables/)
- Firebase client API key là cấu hình nhận diện ứng dụng; quyền truy cập dữ liệu cần được bảo vệ bằng Firebase Authentication và Security Rules. Không đưa service-account key hoặc quyền quản trị vào ứng dụng di động.

## Cấu trúc dự án

```text
src/
├── app/          # Các màn hình Expo Router: auth, tabs, bài đăng, chat, ví
├── components/   # Thành phần giao diện dùng lại
├── config/       # Firebase
├── models/       # Kiểu dữ liệu TypeScript
├── services/     # Gemini, ghép đôi, Firebase, chat và WebRTC
└── utils/        # Hàm tiện ích
assets/readme/    # Banner, chứng nhận Top 50 và demo README
```

## Tác giả

**Nguyễn Nhật Thiên (TEE)** · [GitHub](https://github.com/teehihi) · [Portfolio](https://nteelab.vercel.app/) · [Linktree](https://linktr.ee/nkqt.tee)

<p align="center"><strong>Made with care in Vietnam 🇻🇳 — giúp những món đồ thất lạc tìm lại đúng người.</strong></p>
