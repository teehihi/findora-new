import { GEMINI_API_KEY } from '../config/firebase';

export interface GeminiAnalysisResult {
  title: string;
  description: string;
  imageLabel: string;
  confidence: number;
}

/**
 * Uses Ultra-Fast Gemini 3.5 Flash Lite to analyze the uploaded image and generate title, description, label & confidence
 */
export async function analyzeImageWithGemini(
  base64Data: string,
  type: 'lost' | 'found',
  mimeType: string = 'image/jpeg'
): Promise<GeminiAnalysisResult> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || GEMINI_API_KEY;

  const prompt = `Bạn là hệ thống AI nhận diện đồ vật và giấy tờ thất lạc cho ứng dụng Findora.
Nhiệm vụ: Phân tích hình ảnh được cung cấp và tạo thông tin bài đăng (${type === 'lost' ? 'Báo mất đồ' : 'Báo nhặt được đồ'}) bằng tiếng Việt.

Hãy phân tích kỹ bức ảnh theo các nguyên tắc:
1. Nhận diện đồ vật, tài sản, giấy tờ hoặc thú cưng chính trong ảnh.
2. NGUYÊN TẮC VỚI GIẤY TỜ / THẺ TÙY THÂN (Thẻ sinh viên, CCCD, CMND, Bằng lái xe, Thẻ ATM/ngân hàng, BHYT, Hộ chiếu...):
   - Đọc chính xác Họ và tên chủ sở hữu, MSSV / Mã số định danh / Số thẻ nếu thấy được trên ảnh.
   - Tiêu đề BẮT BUỘC có dạng: "${type === 'lost' ? 'Mất' : 'Nhặt được'} [Loại giấy tờ] [Họ và tên]" (Ví dụ: "Nhặt được thẻ sinh viên Phạm Văn Hậu", "Mất CCCD Nguyễn Văn An").
   - Trong mô tả: Ghi rõ Họ tên người trên giấy tờ, Mã số/MSSV, Trường học/Đơn vị cấp để hệ thống AI so khớp danh tính.
3. NGUYÊN TẮC VỚI ĐỒ VẬT / THIẾT BỊ / THÚ CƯNG:
   - Nêu rõ loại đồ vật + màu sắc/thương hiệu chính (Ví dụ: "Mất ví da nam màu nâu sẫm", "Nhặt được chùm chìa khóa xe Honda", "Mất mèo Anh lông ngắn màu xám").
   - Mô tả chi tiết (từ 80 đến 200 ký tự) các đặc điểm nhận diện nổi bật (màu sắc, vết xước, phụ kiện đính kèm, tình trạng).
4. imageLabel: 1 từ khóa tiếng Anh danh mục (wallet, phone, keys, pet, card, document, bag, watch, laptop, electronics, jewelry, clothing, other).
5. confidence: Số thực từ 0.0 đến 1.0.

YÊU CẦU ĐỊNH DẠNG: Trả về DUY NHẤT 1 JSON object hợp lệ, không bọc mã markdown:
{
  "imageLabel": "từ_khóa_tiếng_Anh",
  "confidence": 0.95,
  "title": "Tiêu đề chuẩn theo nguyên tắc trên",
  "description": "Mô tả chi tiết đặc điểm và thông tin nhận dạng."
}`;

  // Clean base64 string if it contains data prefix
  const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '').trim();

  // Try ultra-fast Gemini 3.5 Flash Lite first, with fallbacks
  const models = ['gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.1-flash-lite', 'gemini-3.6-flash'];

  for (const model of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: cleanBase64,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 400,
            },
          }),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[Gemini API ${model}] status ${response.status}:`, errText);
        continue;
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (text) {
        const cleaned = text
          .replace(/```json/gi, '')
          .replace(/```/g, '')
          .trim();

        const parsed = JSON.parse(cleaned);

        return {
          title: parsed.title || (type === 'lost' ? 'Đồ bị mất' : 'Đồ nhặt được'),
          description: parsed.description || 'Chưa có mô tả chi tiết.',
          imageLabel: (parsed.imageLabel || 'item').toLowerCase(),
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.95,
        };
      }
    } catch (err) {
      console.warn(`[Gemini API ${model}] error:`, err);
    }
  }

  // Fallback default values
  return {
    title: type === 'lost' ? 'Đồ bị mất' : 'Đồ nhặt được',
    description: 'Cần bổ sung mô tả chi tiết cho bài đăng.',
    imageLabel: 'item',
    confidence: 0.75,
  };
}
