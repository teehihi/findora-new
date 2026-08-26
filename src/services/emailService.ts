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
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 560px; width: 100%; background-color: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 10px 25px rgba(15, 23, 42, 0.06); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #00A896 0%, #028090 100%); padding: 30px 24px; text-align: center;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                <tr>
                  <td style="vertical-align: middle; padding-right: 10px;">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M12 6V12L16 14" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </td>
                  <td style="vertical-align: middle; text-align: left;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">FINDORA</h1>
                  </td>
                </tr>
              </table>
              <p style="margin: 6px 0 0 0; color: #ccfbf1; font-size: 13.5px; font-weight: 500;">Thông Báo Xác Nhận Lịch Hẹn Gặp Mặt</p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 28px;">
              <!-- Title Card -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #00A896; border-radius: 10px; padding: 16px 18px; margin-bottom: 24px;">
                <div style="font-size: 11.5px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Nội dung cuộc hẹn</div>
                <h2 style="margin: 0; color: #0f172a; font-size: 17px; font-weight: 700; line-height: 1.4;">${params.title}</h2>
              </div>

              <!-- Details Table with Vector Icons -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 28px;">
                
                <!-- Row: Participants -->
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; width: 40px; vertical-align: middle;">
                    <div style="width: 32px; height: 32px; border-radius: 8px; background-color: #eff6ff; text-align: center; line-height: 32px; display: inline-block;">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-top: 8px;">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                      </svg>
                    </div>
                  </td>
                  <td style="padding: 12px 0 12px 8px; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 13.5px; font-weight: 500; width: 30%;">Người tham gia</td>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-size: 14px; font-weight: 600;">${params.creatorName} &amp; ${params.partnerName}</td>
                </tr>

                <!-- Row: Date -->
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; width: 40px; vertical-align: middle;">
                    <div style="width: 32px; height: 32px; border-radius: 8px; background-color: #f0fdf4; text-align: center; line-height: 32px; display: inline-block;">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-top: 8px;">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                    </div>
                  </td>
                  <td style="padding: 12px 0 12px 8px; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 13.5px; font-weight: 500;">Ngày hẹn</td>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-size: 14px; font-weight: 600;">${params.dateText}</td>
                </tr>

                <!-- Row: Time -->
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; width: 40px; vertical-align: middle;">
                    <div style="width: 32px; height: 32px; border-radius: 8px; background-color: #f0fdfa; text-align: center; line-height: 32px; display: inline-block;">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00A896" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-top: 8px;">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                    </div>
                  </td>
                  <td style="padding: 12px 0 12px 8px; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 13.5px; font-weight: 500;">Giờ hẹn</td>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #00A896; font-size: 14.5px; font-weight: 800;">${params.timeText}</td>
                </tr>

                <!-- Row: Location -->
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; width: 40px; vertical-align: middle;">
                    <div style="width: 32px; height: 32px; border-radius: 8px; background-color: #fef2f2; text-align: center; line-height: 32px; display: inline-block;">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-top: 8px;">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                      </svg>
                    </div>
                  </td>
                  <td style="padding: 12px 0 12px 8px; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 13.5px; font-weight: 500;">Địa điểm</td>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-size: 14px; font-weight: 600;">${params.locationText}</td>
                </tr>

                <!-- Row: Note -->
                ${params.noteText ? `
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; width: 40px; vertical-align: middle;">
                    <div style="width: 32px; height: 32px; border-radius: 8px; background-color: #f8fafc; text-align: center; line-height: 32px; display: inline-block;">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-top: 8px;">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                      </svg>
                    </div>
                  </td>
                  <td style="padding: 12px 0 12px 8px; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 13.5px; font-weight: 500;">Ghi chú</td>
                  <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #334155; font-size: 13.5px;">${params.noteText}</td>
                </tr>
                ` : ''}
              </table>

              <!-- Google Calendar Action Button with Icon -->
              <div style="text-align: center; margin: 30px 0 16px 0;">
                <a href="${params.googleCalendarUrl}" target="_blank" style="background-color: #00A896; color: #ffffff; text-decoration: none; padding: 13px 28px; border-radius: 12px; font-weight: 700; font-size: 14px; display: inline-block; letter-spacing: 0.2px; box-shadow: 0 4px 14px rgba(0, 168, 150, 0.25);">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 6px; margin-top: -2px;">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                  </svg>
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

/**
 * Generate a luxury Findora-branded HTML email template for Password Change OTP
 */
export function generateOtpEmailTemplate(params: {
  userName: string;
  otpCode: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mã Xác Thực OTP - Findora</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #0f172a; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f1f5f9; padding: 36px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 500px; width: 100%; background-color: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 10px 25px rgba(15, 23, 42, 0.06); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #00A896 0%, #028090 100%); padding: 28px 24px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">FINDORA</h1>
              <p style="margin: 6px 0 0 0; color: #ccfbf1; font-size: 13.5px; font-weight: 500;">Xác Thực Thay Đổi Mật Khẩu</p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 28px; text-align: center;">
              <p style="margin: 0 0 16px 0; color: #334155; font-size: 15px; text-align: left;">
                Xin chào <strong>${params.userName || 'bạn'}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; color: #64748b; font-size: 14px; line-height: 1.5; text-align: left;">
                Chúng tôi nhận được yêu cầu cập nhật mật khẩu cho tài khoản Findora của bạn. Vui lòng sử dụng mã OTP gồm 6 chữ số dưới đây để xác nhận:
              </p>

              <!-- Big OTP Code Box -->
              <div style="background-color: #f0fdf4; border: 2px dashed #00A896; border-radius: 14px; padding: 18px 24px; margin: 24px 0; display: inline-block;">
                <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #00A896; font-family: monospace;">${params.otpCode}</span>
              </div>

              <p style="margin: 16px 0 0 0; color: #94a3b8; font-size: 12.5px; line-height: 1.5;">
                Mã này có hiệu lực trong vòng <strong>10 phút</strong>. Tuyệt đối không chia sẻ mã này cho bất kỳ ai.
              </p>
              <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 12px; line-height: 1.5;">
                Nếu bạn không thực hiện yêu cầu này, vui lòng đổi mật khẩu ngay để bảo vệ tài khoản.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 18px 24px; text-align: center; border-top: 1px solid #f1f5f9;">
              <p style="margin: 0; color: #64748b; font-size: 12px;">Findora &bull; Nền tảng tìm kiếm và trao trả đồ thất lạc</p>
              <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 11px;">Email bảo mật tự động từ hệ thống.</p>
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
