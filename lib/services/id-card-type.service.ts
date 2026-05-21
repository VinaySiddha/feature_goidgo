'use server';

import { dbExecute } from '../db';
import { RowDataPacket } from 'mysql2';
import { requireAdmin, requireAnyFaculty } from '../auth';
import { t, nowIST } from '../utils/server-helpers';

export async function getIdCardTypes(): Promise<{ id: number; name: string; description: string | null }[]> {
  await requireAdmin();
  try {
    const [rows] = await dbExecute<RowDataPacket[]>(
      'SELECT id, name, description FROM id_card_types WHERE deleted_at IS NULL ORDER BY name'
    );
    return rows as { id: number; name: string; description: string | null }[];
  } catch {
    return [];
  }
}

export async function getIdCardTypesForFaculty(): Promise<{ id: number; name: string; description: string | null }[]> {
  await requireAnyFaculty();
  try {
    const [rows] = await dbExecute<RowDataPacket[]>(
      'SELECT id, name, description FROM id_card_types WHERE deleted_at IS NULL ORDER BY name'
    );
    return rows as { id: number; name: string; description: string | null }[];
  } catch {
    return [];
  }
}

export async function addIdCardType(
  name: string,
  description: string | null
): Promise<{ success: boolean; message: string }> {
  await requireAdmin();
  const trimmedName = t(name);
  const trimmedDesc = t(description);
  if (!trimmedName) return { success: false, message: 'Name is required.' };
  if (trimmedName.length > 100) return { success: false, message: 'Name must be 100 characters or fewer.' };
  try {
    const [existing] = await dbExecute<RowDataPacket[]>(
      'SELECT id, deleted_at FROM id_card_types WHERE name = ?', [trimmedName]
    );
    if (existing.length > 0) {
      if ((existing[0] as Record<string, unknown>).deleted_at) {
        await dbExecute('UPDATE id_card_types SET deleted_at = NULL, deleted_by = NULL, description = ? WHERE name = ?', [trimmedDesc, trimmedName]);
        return { success: true, message: `"${trimmedName}" restored and re-added.` };
      }
      return { success: false, message: `"${trimmedName}" already exists.` };
    }
    await dbExecute('INSERT INTO id_card_types (name, description) VALUES (?, ?)', [trimmedName, trimmedDesc]);
    return { success: true, message: `"${trimmedName}" added successfully.` };
  } catch {
    return { success: false, message: 'Failed to add ID card type.' };
  }
}

export async function deleteIdCardType(
  id: number,
  deletedBy: string
): Promise<{ success: boolean; message: string }> {
  await requireAdmin();
  try {
    const usageRows = await dbExecute(
      'SELECT college FROM college_assets WHERE id_card_type_id = ? LIMIT 1',
      [id]
    ) as unknown as { college: string }[];
    if (usageRows.length > 0) {
      return {
        success: false,
        message: `Cannot delete: this ID card type is used by institute "${usageRows[0].college}".`,
      };
    }
    await dbExecute(
      'UPDATE id_card_types SET deleted_at = ?, deleted_by = ? WHERE id = ? AND deleted_at IS NULL',
      [nowIST(), deletedBy, id]
    );
    return { success: true, message: 'ID card type removed.' };
  } catch {
    return { success: false, message: 'Failed to remove ID card type.' };
  }
}

export async function getDeletedIdCardTypes(): Promise<{ id: number; name: string; description: string | null; deletedBy: string | null }[]> {
  await requireAdmin();
  try {
    const [rows] = await dbExecute<RowDataPacket[]>(
      'SELECT id, name, description, deleted_by AS deletedBy FROM id_card_types WHERE deleted_at IS NOT NULL ORDER BY name'
    );
    return rows as { id: number; name: string; description: string | null; deletedBy: string | null }[];
  } catch {
    return [];
  }
}

export async function restoreIdCardType(id: number): Promise<{ success: boolean; message: string }> {
  await requireAdmin();
  try {
    await dbExecute(
      'UPDATE id_card_types SET deleted_at = NULL, deleted_by = NULL WHERE id = ?', [id]
    );
    return { success: true, message: 'ID card type restored.' };
  } catch {
    return { success: false, message: 'Failed to restore ID card type.' };
  }
}
