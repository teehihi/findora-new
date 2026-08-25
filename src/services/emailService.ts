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
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #0f172a; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f1f5f9; padding: 36px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 560px; width: 100%; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(15, 23, 42, 0.05); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #00A896; padding: 28px 24px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">FINDORA</h1>
              <p style="margin: 4px 0 0 0; color: #ccfbf1; font-size: 13.5px; font-weight: 500;">Xác Nhận Lịch Hẹn Gặp Mặt</p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 28px;">
              <!-- Title Card -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #00A896; border-radius: 8px; padding: 16px 18px; margin-bottom: 24px;">
                <div style="font-size: 11.5px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Cuộc hẹn</div>
                <h2 style="margin: 0; color: #0f172a; font-size: 17px; font-weight: 700; line-height: 1.4;">${params.title}</h2>
              </div>

              <!-- Details Table -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 28px;">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 13.5px; width: 34%; font-weight: 500;">Người tham gia</td>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-size: 14px; font-weight: 600;">${params.creatorName} &amp; ${params.partnerName}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 13.5px; font-weight: 500;">Ngày hẹn</td>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-size: 14px; font-weight: 600;">${params.dateText}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 13.5px; font-weight: 500;">Giờ hẹn</td>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #00A896; font-size: 14px; font-weight: 700;">${params.timeText}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 13.5px; font-weight: 500;">Địa điểm</td>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-size: 14px; font-weight: 600;">${params.locationText}</td>
                </tr>
                ${params.noteText ? `
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 13.5px; font-weight: 500;">Ghi chú</td>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #334155; font-size: 13.5px;">${params.noteText}</td>
                </tr>
                ` : ''}
              </table>

              <!-- Google Calendar Action Button -->
              <div style="text-align: center; margin: 30px 0 16px 0;">
                <a href="${params.googleCalendarUrl}" target="_blank" style="background-color: #00A896; color: #ffffff; text-decoration: none; padding: 13px 28px; border-radius: 10px; font-weight: 700; font-size: 14px; display: inline-block; letter-spacing: 0.2px;">
                  Thêm Vào Google Calendar
                </a>
              </div>

              <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 20px; line-height: 1.5;">
                Vui lòng đến đúng giờ và chuẩn bị đầy đủ giấy tờ cần thiết để đối chiếu.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 18px 24px; text-align: center; border-top: 1px solid #f1f5f9;">
              <p style="margin: 0; color: #64748b; font-size: 12px;">Findora &bull; Nền tảng tìm kiếm và trao trả đồ thất lạc</p>
              <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 11px;">Email tự động từ hệ thống. Vui lòng không trả lời thư này.</p>
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
