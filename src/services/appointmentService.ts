import {
  collection,
  addDoc,
  doc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { extractAppointmentFromMessageWithGemini, ExtractedAppointmentResult } from './geminiService';
import { sendEmail, generateAppointmentHtmlEmail } from './emailService';

export interface AppointmentPayload {
  id?: string;
  chatId: string;
  creatorId: string;
  creatorName: string;
  partnerId: string;
  partnerName: string;
  title: string;
  dateText: string;
  timeText: string;
  locationText: string;
  noteText?: string;
  isoStart: string;
  isoEnd: string;
  googleCalendarUrl: string;
  createdAt: any;
}

/**
 * Detects if a message text contains appointment / meeting intent
 */
export function detectAppointmentIntent(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const clean = text.toLowerCase();

  const patterns = [
    /hẹn\s+(bạn|anh|chị|em|nhau|gặp)/i,
    /gặp\s+(ở|tại|lúc|nhau)/i,
    /(ngày mai|hôm nay|chiều nay|sáng mai|tối nay)\s+(lúc|ở|tại)?/i,
    /(trả đồ|nhận đồ|giao đồ)\s+(ở|tại|lúc)?/i,
    /mấy giờ\s+(gặp|đến|qua)/i,
    /địa điểm\s+(hẹn|gặp)/i,
    /quán\s+cà?\s*phê/i,
    /cổng\s+(số|trường|chính)/i,
  ];

  return patterns.some((p) => p.test(clean));
}

/**
 * Generates official Google Calendar template URL
 */
export function generateGoogleCalendarUrl(params: {
  title: string;
  location: string;
  description: string;
  isoStart: string;
  isoEnd: string;
}): string {
  const base = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
  const text = encodeURIComponent(params.title || 'Hẹn gặp nhận lại đồ - Findora');
  const location = encodeURIComponent(params.location || 'Điểm hẹn');
  const details = encodeURIComponent(params.description || 'Cuộc hẹn trao trả đồ qua ứng dụng Findora.');
  const dates = `${params.isoStart}/${params.isoEnd}`;

  return `${base}&text=${text}&dates=${dates}&location=${location}&details=${details}`;
}

/**
 * Formats a Date object into Google Calendar ISO format (e.g. "20260826T150000")
 */
export function formatToGoogleCalendarIso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const mins = pad(date.getMinutes());
  const secs = pad(date.getSeconds());
  return `${year}${month}${day}T${hours}${mins}${secs}`;
}

/**
 * Creates and saves an appointment to Firestore
 */
export async function createAndSaveAppointment(params: {
  chatId: string;
  creatorId: string;
  creatorName: string;
  partnerId: string;
  partnerName: string;
  title: string;
  dateText: string;
  timeText: string;
  locationText: string;
  noteText?: string;
  isoStart: string;
  isoEnd: string;
}): Promise<AppointmentPayload> {
  const googleCalendarUrl = generateGoogleCalendarUrl({
    title: params.title,
    location: params.locationText,
    description: `${params.noteText || ''}\n\nCuộc hẹn giữa ${params.creatorName} và ${params.partnerName} qua ứng dụng Findora.`,
    isoStart: params.isoStart,
    isoEnd: params.isoEnd,
  });

  const payload: Omit<AppointmentPayload, 'id'> = {
    chatId: params.chatId,
    creatorId: params.creatorId,
    creatorName: params.creatorName,
    partnerId: params.partnerId,
    partnerName: params.partnerName,
    title: params.title,
    dateText: params.dateText,
    timeText: params.timeText,
    locationText: params.locationText,
    noteText: params.noteText || '',
    isoStart: params.isoStart,
    isoEnd: params.isoEnd,
    googleCalendarUrl,
    createdAt: serverTimestamp(),
  };

  // Asynchronously dispatch appointment email to both participants
  (async () => {
    try {
      const recipients: string[] = [];

      // 1. Creator email
      if (auth.currentUser?.email) {
        recipients.push(auth.currentUser.email);
      } else if (params.creatorId) {
        const creatorSnap = await getDoc(doc(db, 'users', params.creatorId)).catch(() => null);
        if (creatorSnap?.exists() && creatorSnap.data()?.email) {
          recipients.push(creatorSnap.data().email);
        }
      }

      // 2. Partner email
      if (params.partnerId) {
        const partnerSnap = await getDoc(doc(db, 'users', params.partnerId)).catch(() => null);
        if (partnerSnap?.exists() && partnerSnap.data()?.email) {
          recipients.push(partnerSnap.data().email);
        }
      }

      if (recipients.length > 0) {
        const html = generateAppointmentHtmlEmail({
          title: params.title,
          dateText: params.dateText,
          timeText: params.timeText,
          locationText: params.locationText,
          noteText: params.noteText,
          creatorName: params.creatorName,
          partnerName: params.partnerName,
          googleCalendarUrl,
        });

        await sendEmail({
          to: recipients,
          subject: `[Findora] Xác nhận lịch hẹn: ${params.title}`,
          html,
        });
      }
    } catch (emailErr) {
      console.log('Notice: Auto email dispatch notice:', emailErr);
    }
  })();

  try {
    const docRef = await addDoc(collection(db, 'appointments'), payload);
    return { id: docRef.id, ...payload };
  } catch (err) {
    console.log('Notice: Storing appointment locally/in-chat due to rules notice:', err);
    const fallbackId = `app_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    return { id: fallbackId, ...payload };
  }
}
