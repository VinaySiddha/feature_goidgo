'use server';

import { dbExecute } from '../db';
import { RowDataPacket } from 'mysql2';
import { setSessionCookie, clearSessionCookie, getSessionUser } from '../session';
import { requireAnyFaculty } from '../auth';
import { t, nowIST, getRequestMeta } from '../utils/server-helpers';
import { User, UserRole } from '../types';

export async function loginUser(email: string, passwordHash: string) {
  const emailClean = t(email);
  if (!emailClean) return { success: false, message: 'Email is required.' };
  if (!passwordHash) return { success: false, message: 'Password is required.' };
  try {
    const [rows] = await dbExecute<RowDataPacket[]>(
      `SELECT u.*, c.name AS college
       FROM users u
       LEFT JOIN colleges c ON c.id = u.college_id
       WHERE u.email = ? AND u.password = ? AND u.deleted_at IS NULL`,
      [emailClean.toLowerCase(), passwordHash]
    );
    if (rows.length === 0) return { success: false, message: 'Invalid email or password.' };
    const u = rows[0] as RowDataPacket;
    const { ip, ua } = await getRequestMeta();
    dbExecute(
      'INSERT INTO login_history (user_email, user_name, ip_address, user_agent, created_at) VALUES (?, ?, ?, ?, ?)',
      [emailClean.toLowerCase(), u.name ?? email, ip, ua, nowIST()]
    ).catch(() => {});
    await setSessionCookie({
      id:      u.id as number,
      email:   (u.email as string).toLowerCase(),
      name:    u.name as string,
      role:    u.role as UserRole,
      college: (u.college as string | null) ?? null,
    });
    return { success: true, message: 'Login successful.', user: rows[0] as User };
  } catch (err) {
    console.error('loginUser error:', err);
    return { success: false, message: 'Something went wrong. Please try again later.' };
  }
}

export async function getMe() {
  return getSessionUser();
}

export async function logoutAction() {
  await clearSessionCookie();
}

export async function changeMyPassword(email: string, currentPasswordHash: string, newPasswordHash: string) {
  await requireAnyFaculty();
  const emailClean = t(email);
  if (!emailClean) return { success: false, message: 'Email is required.' };
  try {
    const [rows] = await dbExecute<RowDataPacket[]>(
      'SELECT id FROM users WHERE email = ? AND password = ? AND deleted_at IS NULL',
      [emailClean.toLowerCase(), currentPasswordHash]
    );
    if (rows.length === 0) return { success: false, message: 'Current password is incorrect.' };
    await dbExecute(
      'UPDATE users SET password = ? WHERE email = ? AND deleted_at IS NULL',
      [newPasswordHash, emailClean.toLowerCase()]
    );
    return { success: true, message: 'Password updated successfully.' };
  } catch {
    return { success: false, message: 'Failed to update password.' };
  }
}
