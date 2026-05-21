'use server';

import { dbExecute } from '../db';
import { RowDataPacket } from 'mysql2';
import { requireAdmin, requireAuth } from '../auth';
import { t, getCollegeId } from '../utils/server-helpers';
import { DbUser, UserRole } from '../types';

export async function registerUser(name: string, email: string, passwordHash: string, role: UserRole, college?: string) {
  await requireAdmin();
  const nameClean  = t(name);
  const emailClean = t(email);
  if (!nameClean)    return { success: false, message: 'Name is required.' };
  if (!emailClean)   return { success: false, message: 'Email is required.' };
  if (!passwordHash) return { success: false, message: 'Password is required.' };

  try {
    const [existing] = await dbExecute<RowDataPacket[]>(
      'SELECT id FROM users WHERE email = ?',
      [emailClean.toLowerCase()]
    );
    if (existing.length > 0) return { success: false, message: 'An account with this email already exists.' };

    const collegeId = await getCollegeId(college);
    await dbExecute(
      'INSERT INTO users (name, email, password, role, college_id) VALUES (?, ?, ?, ?, ?)',
      [nameClean, emailClean.toLowerCase(), passwordHash, role, collegeId]
    );
    return { success: true, message: 'Registration complete. Welcome!', user: { name: nameClean, email: emailClean, password: passwordHash, role, college } };
  } catch (error) {
    console.error('Registration error:', error);
    return { success: false, message: 'Failed to create account.' };
  }
}

export async function getUsers(): Promise<DbUser[]> {
  await requireAdmin();
  try {
    const [rows] = await dbExecute<RowDataPacket[]>(
      `SELECT u.id, u.name, u.email, u.role, c.name AS college, u.created_at
       FROM users u
       LEFT JOIN colleges c ON c.id = u.college_id
       WHERE u.deleted_at IS NULL
       ORDER BY u.created_at DESC`
    );
    return rows as DbUser[];
  } catch (error) {
    console.error('Get users error:', error);
    return [];
  }
}

export async function getUsersByCollege(college: string): Promise<DbUser[]> {
  await requireAuth(['admin', 'faculty_admin']);
  if (!college) return [];
  try {
    const [rows] = await dbExecute<RowDataPacket[]>(
      `SELECT u.id, u.name, u.email, u.role, c.name AS college, u.created_at
       FROM users u
       LEFT JOIN colleges c ON c.id = u.college_id
       WHERE c.name = ? AND u.role = 'faculty' AND u.deleted_at IS NULL
       ORDER BY u.created_at DESC`,
      [college.trim()]
    );
    return rows as DbUser[];
  } catch (error) {
    console.error('Get users by college error:', error);
    return [];
  }
}

export async function getDeletedUsers(): Promise<DbUser[]> {
  await requireAdmin();
  try {
    const [rows] = await dbExecute<RowDataPacket[]>(
      `SELECT u.id, u.name, u.email, u.role, c.name AS college, u.created_at, u.deleted_by AS deletedBy
       FROM users u
       LEFT JOIN colleges c ON c.id = u.college_id
       WHERE u.deleted_at IS NOT NULL
       ORDER BY u.deleted_at DESC`
    );
    return rows as DbUser[];
  } catch (error) {
    console.error('Get deleted users error:', error);
    return [];
  }
}

export async function getDeletedUsersByCollege(college: string): Promise<DbUser[]> {
  await requireAuth(['admin', 'faculty_admin']);
  if (!college) return [];
  try {
    const [rows] = await dbExecute<RowDataPacket[]>(
      `SELECT u.id, u.name, u.email, u.role, c.name AS college, u.created_at, u.deleted_by AS deletedBy
       FROM users u
       LEFT JOIN colleges c ON c.id = u.college_id
       WHERE c.name = ? AND u.role = 'faculty' AND u.deleted_at IS NOT NULL
       ORDER BY u.deleted_at DESC`,
      [college.trim()]
    );
    return rows as DbUser[];
  } catch (error) {
    console.error('Get deleted users by college error:', error);
    return [];
  }
}

export async function deleteUser(id: number, deletedBy?: string) {
  await requireAuth(['admin', 'faculty_admin']);
  if (!id) return { success: false };
  try {
    const by = t(deletedBy) ?? 'Unknown';
    await dbExecute(
      'UPDATE users SET deleted_at = NOW(), deleted_by = ? WHERE id = ? AND deleted_at IS NULL',
      [by, id]
    );
    return { success: true };
  } catch (error) {
    console.error('Delete user error:', error);
    return { success: false };
  }
}

export async function restoreUserInDb(id: number): Promise<{ success: boolean }> {
  await requireAuth(['admin', 'faculty_admin']);
  if (!id) return { success: false };
  try {
    await dbExecute('UPDATE users SET deleted_at = NULL, deleted_by = NULL WHERE id = ?', [id]);
    return { success: true };
  } catch (error) {
    console.error('Restore user error:', error);
    return { success: false };
  }
}

export async function updateUser(id: number, data: { name: string; email: string; role: string; college?: string | null; passwordHash?: string }) {
  await requireAdmin();
  const name  = t(data.name);
  const email = t(data.email);
  if (!name)  return { success: false, message: 'Name is required.' };
  if (!email) return { success: false, message: 'Email is required.' };

  try {
    const collegeId = await getCollegeId(data.college);
    if (data.passwordHash) {
      await dbExecute(
        'UPDATE users SET name=?, email=?, role=?, college_id=?, password=? WHERE id=? AND deleted_at IS NULL',
        [name, email.toLowerCase(), data.role, collegeId, data.passwordHash, id]
      );
    } else {
      await dbExecute(
        'UPDATE users SET name=?, email=?, role=?, college_id=? WHERE id=? AND deleted_at IS NULL',
        [name, email.toLowerCase(), data.role, collegeId, id]
      );
    }
    return { success: true };
  } catch (error) {
    console.error('Update user error:', error);
    return { success: false };
  }
}

export async function getUsersPageData(): Promise<{ users: DbUser[]; deletedUsers: DbUser[] }> {
  await requireAdmin();
  const [users, deletedUsers] = await Promise.all([getUsers(), getDeletedUsers()]);
  return { users, deletedUsers };
}
