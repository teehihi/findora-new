import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * Root HTML layout for web platform with rich SEO metadata and social graph tags
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="vi">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, maximum-scale=1, user-scalable=no" />
        
        {/* Primary SEO Meta Tags */}
        <title>Findora - Nền tảng Tìm kiếm &amp; Trao trả Đồ Thất lạc AI</title>
        <meta name="title" content="Findora - Nền tảng Tìm kiếm &amp; Trao trả Đồ Thất lạc AI" />
        <meta name="description" content="Findora ứng dụng Google Gemini Multimodal AI giúp tự động nhận diện đồ vật, gợi ý ghép đôi thông minh và hỗ trợ trao trả đồ thất lạc an toàn, nhanh chóng." />
        <meta name="keywords" content="Findora, tìm đồ thất lạc, lost and found, Google AI Studio, Gemini AI, HCMUTE, trao trả đồ" />
        <meta name="author" content="Findora Team" />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Findora" />
        <meta property="og:title" content="Findora - Nền tảng Tìm kiếm &amp; Trao trả Đồ Thất lạc AI" />
        <meta property="og:description" content="Tự động nhận diện đồ vật, gợi ý ghép đôi thông minh và trao trả an toàn với Google Gemini AI." />
        <meta property="og:image" content="/assets/images/Logo_noBG.png" />
        <meta property="og:locale" content="vi_VN" />

        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:title" content="Findora - Nền tảng Tìm kiếm &amp; Trao trả Đồ Thất lạc AI" />
        <meta property="twitter:description" content="Tự động nhận diện đồ vật, gợi ý ghép đôi thông minh và trao trả an toàn với Google Gemini AI." />
        <meta property="twitter:image" content="/assets/images/Logo_noBG.png" />

        {/* Mobile App & PWA Theme Meta */}
        <meta name="theme-color" content="#00A896" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Findora" />

        {/* CSS Reset for smooth Expo Web rendering */}
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{
          __html: `
            html, body, #root {
              height: 100%;
              width: 100%;
              margin: 0;
              padding: 0;
              background-color: #f8fafc;
              -webkit-font-smoothing: antialiased;
            }
          `
        }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
