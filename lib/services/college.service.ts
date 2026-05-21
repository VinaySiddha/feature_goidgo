'use server';

import { dbExecute } from '../db';
import { RowDataPacket } from 'mysql2';
import { requireAdmin } from '../auth';
import { t } from '../utils/server-helpers';

export async function getCollegesFromDb() {
  try {
    const [rows] = await dbExecute<RowDataPacket[]>(
      'SELECT name FROM colleges WHERE deleted_at IS NULL ORDER BY name'
    );
    return rows.map(r => r.name as string);
  } catch {
    return [];
  }
}

export async function addCollegeToDb(name: string) {
  await requireAdmin();
  const trimmed = t(name);
  if (!trimmed) return { success: false, message: 'College name is required.' };
  try {
    const [deleted] = await dbExecute<RowDataPacket[]>(
      'SELECT id FROM colleges WHERE name = ? AND deleted_at IS NOT NULL',
      [trimmed]
    );
    if (deleted.length > 0) {
      await dbExecute('UPDATE colleges SET deleted_at = NULL, deleted_by = NULL WHERE name = ?', [trimmed]);
      return { success: true, message: 'College restored successfully.' };
    }
    const [active] = await dbExecute<RowDataPacket[]>(
      'SELECT id FROM colleges WHERE name = ? AND deleted_at IS NULL',
      [trimmed]
    );
    if (active.length > 0) return { success: false, message: 'This college already exists.' };

    await dbExecute('INSERT INTO colleges (name) VALUES (?)', [trimmed]);
    return { success: true, message: 'College added successfully.' };
  } catch {
    return { success: false, message: 'Failed to add college.' };
  }
}

export async function deleteCollegeFromDb(name: string, deletedBy?: string) {
  await requireAdmin();
  const trimmed = t(name);
  if (!trimmed) return { success: false, message: 'College name is required.' };
  try {
    const by = t(deletedBy) ?? 'Unknown';
    await dbExecute(
      'UPDATE colleges SET deleted_at = NOW(), deleted_by = ? WHERE name = ? AND deleted_at IS NULL',
      [by, trimmed]
    );
    return { success: true, message: 'College removed successfully.' };
  } catch {
    return { success: false, message: 'Failed to remove college.' };
  }
}

export async function getDeletedColleges(): Promise<{ name: string; deletedBy: string | null }[]> {
  await requireAdmin();
  try {
    const [rows] = await dbExecute<RowDataPacket[]>(
      'SELECT name, deleted_by AS deletedBy FROM colleges WHERE deleted_at IS NOT NULL ORDER BY name'
    );
    return rows as { name: string; deletedBy: string | null }[];
  } catch {
    return [];
  }
}

export async function restoreCollegeFromDb(name: string): Promise<{ success: boolean; message: string }> {
  await requireAdmin();
  const trimmed = t(name);
  if (!trimmed) return { success: false, message: 'College name is required.' };
  try {
    await dbExecute('UPDATE colleges SET deleted_at = NULL, deleted_by = NULL WHERE name = ?', [trimmed]);
    return { success: true, message: 'College restored successfully.' };
  } catch {
    return { success: false, message: 'Failed to restore college.' };
  }
}
