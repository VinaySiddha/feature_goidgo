'use server';

import { RowDataPacket } from 'mysql2';
import { dbExecute } from '../db';
import { t, nowIST } from '../utils/server-helpers';
import { requireAdmin } from '../auth';

export interface Inquiry {
  id: number;
  institutionName: string;
  contactName: string;
  email: string;
  phone: string | null;
  message: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface InquiryData {
  institutionName: string;
  contactName: string;
  email: string;
  phone: string;
  message: string;
}

async function ensureInquiriesTable() {
  await dbExecute(`
    CREATE TABLE IF NOT EXISTS contact_inquiries (
      id               INT AUTO_INCREMENT PRIMARY KEY,
      institution_name VARCHAR(255) NOT NULL,
      contact_name     VARCHAR(255) NOT NULL,
      email            VARCHAR(255) NOT NULL,
      phone            VARCHAR(50)  NULL,
      message          TEXT         NULL,
      created_at       DATETIME     NOT NULL,
      read_at          DATETIME     NULL DEFAULT NULL
    )
  `);
}

export async function submitInquiry(
  data: InquiryData
): Promise<{ success: boolean; message: string }> {
  try {
    await ensureInquiriesTable();
    const name   = t(data.institutionName);
    const person = t(data.contactName);
    const email  = t(data.email);

    if (!name || !person || !email) {
      return { success: false, message: 'Institution name, your name, and email are required.' };
    }

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email)) {
      return { success: false, message: 'Please enter a valid email address.' };
    }

    await dbExecute(
      `INSERT INTO contact_inquiries
         (institution_name, contact_name, email, phone, message, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, person, email, t(data.phone) ?? null, t(data.message) ?? null, nowIST()]
    );

    return { success: true, message: "Thank you! We'll be in touch within 24 hours." };
  } catch (err) {
    console.error('submitInquiry error:', err);
    return { success: false, message: 'Something went wrong. Please try again or contact us directly.' };
  }
}

export type CallbackReason = 'product_details' | 'onboarding' | 'support';

export async function submitCallbackRequest(data: {
  phone: string;
  reason: CallbackReason;
}): Promise<{ success: boolean; message: string }> {
  try {
    const phone = t(data.phone);
    if (!phone) return { success: false, message: 'Please enter your phone number.' };

    const phoneRe = /^[+\d\s\-()]{6,20}$/;
    if (!phoneRe.test(phone)) return { success: false, message: 'Please enter a valid phone number.' };

    await dbExecute(
      `INSERT INTO callback_requests (phone, reason, created_at) VALUES (?, ?, ?)`,
      [phone, data.reason, nowIST()]
    );

    return { success: true, message: "We've received your request. Expect a call within a few hours." };
  } catch (err) {
    console.error('submitCallbackRequest error:', err);
    return { success: false, message: 'Something went wrong. Please call us directly at +91 95410 22466.' };
  }
}

export async function getInquiries(): Promise<Inquiry[]> {
  await requireAdmin();
  try {
    await ensureInquiriesTable();
    const [rows] = await dbExecute<RowDataPacket[]>(
      'SELECT * FROM contact_inquiries ORDER BY created_at DESC'
    );
    return (rows as RowDataPacket[]).map(r => ({
      id:              r.id,
      institutionName: r.institution_name,
      contactName:     r.contact_name,
      email:           r.email,
      phone:           r.phone   ?? null,
      message:         r.message ?? null,
      createdAt:       r.created_at,
      readAt:          r.read_at ?? null,
    }));
  } catch (err) {
    console.error('getInquiries error:', err);
    return [];
  }
}

export async function markInquiryRead(id: number): Promise<void> {
  await requireAdmin();
  await dbExecute('UPDATE contact_inquiries SET read_at = NOW() WHERE id = ?', [id]);
}
