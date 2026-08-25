/**
 * Email Service for Findora
 * Generates email templates & manages appointment email notifications
 */

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

// Relay endpoint: Uses deployed Vercel Cloud endpoint, with fallback
const RELAY_ENDPOINT =
  process.env.EXPO_PUBLIC_EMAIL_RELAY_URL ||
  'https://findora-new-api.vercel.app/api/send-appointment-email';

/**
 * Send an email via the zero-dependency Gmail SMTP Relay Server
 */
export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const toList = Array.isArray(params.to) ? params.to : [params.to];
    const validEmails = toList.filter((email) => email && email.includes('@') && !email.includes('example.com'));

    if (validEmails.length === 0) {
      return { success: false, error: 'No valid recipient email' };
    }

    const response = await fetch(RELAY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: validEmails,
        subject: params.subject,
        html: params.html,
      }),
    });

    const resJson = await response.json().catch(() => ({}));
    return { success: response.ok, data: resJson };
  } catch (error: any) {
    // Non-blocking background notice
    console.log('Notice: Email relay notice (optional background):', error?.message);
    return { success: false, error: error?.message };
  }
}

/**
 * Generate a luxury Findora-branded HTML email template for Appointments
 */
export function generateAppointmentHtmlEmail(params: {
  title: string;
  dateText: string;
  timeText: string;
  locationText: string;
  noteText?: string;
  creatorName: string;
  partnerName: string;
  googleCalendarUrl: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lịch Hẹn Gặp Mặt - Findora</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc; padding: 24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" max-width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #00A896 0%, #028090 100%); padding: 32px 28px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">FINDORA</h1>
              <p style="margin: 6px 0 0 0; color: #ccfbf1; font-size: 14px; font-weight: 500;">Thông Báo Xác Nhận Lịch Hẹn Gặp Mặt</p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 28px;">
              <div style="background-color: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 14px; padding: 16px; margin-bottom: 24px; text-align: center;">
                <span style="font-size: 12px; font-weight: 800; color: #0f766e; text-transform: uppercase; letter-spacing: 0.5px;">Cuộc hẹn mới được thiết lập</span>
                <h2 style="margin: 6px 0 0 0; color: #0f172a; font-size: 18px; font-weight: 800;">${params.title}</h2>
              </div>

              <!-- Details Table -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 14px; width: 35%;">👥 <strong>Người tham gia:</strong></td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-size: 14px; font-weight: 600;">${params.creatorName} & ${params.partnerName}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 14px;">📅 <strong>Ngày hẹn:</strong></td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-size: 14px; font-weight: 600;">${params.dateText}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 14px;">⏰ <strong>Giờ hẹn:</strong></td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #00A896; font-size: 14px; font-weight: 700;">${params.timeText}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 14px;">📍 <strong>Địa điểm:</strong></td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-size: 14px; font-weight: 600;">${params.locationText}</td>
                </tr>
                ${params.noteText ? `
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 14px;">📝 <strong>Ghi chú:</strong></td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #475569; font-size: 14px;">${params.noteText}</td>
                </tr>
                ` : ''}
              </table>

              <!-- Google Calendar Action Button -->
              <div style="text-align: center; margin: 28px 0 16px 0;">
                <a href="${params.googleCalendarUrl}" target="_blank" style="background-color: #00A896; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 12px rgba(0, 168, 150, 0.3);">
                  📅 Thêm Vào Google Calendar & Nhắc Nhở
                </a>
              </div>

              <p style="text-align: center; color: #94a3b8; font-size: 12.5px; margin-top: 16px;">
                Vui lòng đến đúng giờ và chuẩn bị đầy đủ thông tin để quá trình trao nhận đồ diễn ra thuận lợi!
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #64748b; font-size: 12px;">© 2026 Findora - Nền tảng tìm kiếm và trao trả đồ thất lạc thông minh.</p>
              <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 11px;">Email tự động được gửi từ hệ thống Findora. Vui lòng không trả lời trực tiếp email này.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
