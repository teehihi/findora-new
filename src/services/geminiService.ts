import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_API_KEY } from '../config/firebase';

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export interface GeminiAnalysisResult {
  title: string;
  description: string;
  imageLabel: string;
  confidence: number;
}

/**
 * Converts a base64 or URI image to Gemini Vision format and generates title, description, label
 */
export async function analyzeImageWithGemini(
  base64Data: string,
  type: 'lost' | 'found',
  mimeType: string = 'image/jpeg'
): Promise<GeminiAnalysisResult> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `Phân tích ảnh này cho bài đăng tìm đồ (${type === 'lost' ? 'đồ bị mất' : 'đồ tìm thấy'}):
1. Đồ vật chính trong ảnh là gì (nhãn tiếng Anh ngắn gọn 1-2 từ, ví dụ: cat, dog, wallet, phone, keys, watch, backpack, glass, laptop, helmet, ring).
2. Tiêu đề ngắn gọn (tối đa 40 ký tự) mô tả đồ vật.
3. Mô tả chi tiết (100-200 ký tự) về màu sắc, kiểu dáng, đặc điểm nổi bật.

Format YÊU CẦU trả về ĐÚNG DẠNG JSON duy nhất như sau:
{
  "imageLabel": "cat",
  "confidence": 0.92,
  "title": "Mất mèo vàng lông ngắn",
  "description": "Mèo vàng lông ngắn khoảng 2 tuổi, có đeo vòng cổ đỏ ở khu vực Thủ Đức."
}`;

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType
      }
    };

    const result = await model.generateContent([prompt, imagePart]);
    const responseText = result.response.text();

    // Clean JSON code blocks if present
    const cleanedText = responseText
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    const parsed = JSON.parse(cleanedText);

    return {
      title: parsed.title || (type === 'lost' ? 'Đồ bị mất' : 'Đồ nhặt được'),
      description: parsed.description || 'Chưa có mô tả chi tiết.',
      imageLabel: (parsed.imageLabel || 'object').toLowerCase(),
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.85
    };
  } catch (error) {
    console.error('Error analyzing image with Gemini:', error);
    // Fallback default values
    return {
      title: type === 'lost' ? 'Đồ bị mất' : 'Đồ nhặt được',
      description: 'Cần bổ sung mô tả chi tiết cho bài đăng.',
      imageLabel: 'item',
      confidence: 0.70
    };
  }
}
