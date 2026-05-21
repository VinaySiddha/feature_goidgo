'use server';

import { dbExecute } from '../db';
import { RowDataPacket } from 'mysql2';
import { requireAnyFaculty } from '../auth';
import { nowIST, dataUrlToBlob, blobToDataUrl } from '../utils/server-helpers';

export async function saveCollegeAssets(data: {
  college: string;
  logo?: string | null;
  signature?: string | null;
  studentCount?: number | null;
  idCardTypeId?: number | null;
  lanyard?: 'Printed' | 'Not printed' | 'Not needed' | null;
  updatedBy: string;
}): Promise<{ success: boolean; message: string }> {
  await requireAnyFaculty();
  try {
    const [existing] = await dbExecute<RowDataPacket[]>(
      'SELECT id FROM college_assets WHERE college = ?', [data.college]
    );

    if (existing.length > 0) {
      // Build partial UPDATE — only touch columns that were explicitly passed
      const sets: string[] = [];
      const vals: (string | number | boolean | Buffer | Date | null)[] = [];

      if (data.logo !== undefined) {
        const logo = dataUrlToBlob(data.logo);
        sets.push('logo = ?, logo_mime = ?');
        vals.push(logo.buf, logo.mime);
      }
      if (data.signature !== undefined) {
        const sig = dataUrlToBlob(data.signature);
        sets.push('signature = ?, sig_mime = ?');
        vals.push(sig.buf, sig.mime);
      }
      // Scalar fields are always sent from the client with their resolved values
      sets.push('student_count = ?');
      vals.push(data.studentCount != null && data.studentCount > 0 ? data.studentCount : null);
      sets.push('id_card_type_id = ?');
      vals.push(data.idCardTypeId ?? null);
      sets.push('lanyard = ?');
      vals.push(data.lanyard ?? null);

      sets.push('updated_at = ?, updated_by = ?');
      vals.push(nowIST(), data.updatedBy, data.college);

      await dbExecute(
        `UPDATE college_assets SET ${sets.join(', ')} WHERE college = ?`,
        vals
      );
    } else {
      const logo    = dataUrlToBlob(data.logo);
      const sig     = dataUrlToBlob(data.signature);
      const count   = data.studentCount != null && data.studentCount > 0 ? data.studentCount : null;
      const typeId  = data.idCardTypeId ?? null;
      const lanyard = data.lanyard ?? null;

      await dbExecute(
        `INSERT INTO college_assets
           (college, logo, logo_mime, signature, sig_mime, student_count, id_card_type_id, lanyard, updated_at, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [data.college, logo.buf, logo.mime, sig.buf, sig.mime, count, typeId, lanyard, nowIST(), data.updatedBy]
      );
    }

    return { success: true, message: 'Assets saved successfully.' };
  } catch (err) {
    console.error('saveCollegeAssets error:', err);
    return { success: false, message: 'Failed to save assets. Please try again.' };
  }
}

export async function getCollegeAssets(
  college: string
): Promise<{ logo: string | null; signature: string | null; studentCount: number | null; idCardTypeId: number | null; idCardTypeName: string | null; lanyard: 'Printed' | 'Not printed' | 'Not needed' | null }> {
  await requireAnyFaculty();
  try {
    const [rows] = await dbExecute<RowDataPacket[]>(
      `SELECT ca.logo, ca.logo_mime, ca.signature, ca.sig_mime, ca.student_count, ca.id_card_type_id, ca.lanyard, ict.name AS id_card_type_name
       FROM college_assets ca
       LEFT JOIN id_card_types ict ON ict.id = ca.id_card_type_id AND ict.deleted_at IS NULL
       WHERE ca.college = ?`,
      [college]
    );
    if (rows.length === 0) return { logo: null, signature: null, studentCount: null, idCardTypeId: null, idCardTypeName: null, lanyard: null };
    const r = rows[0] as Record<string, unknown>;
    return {
      logo:           blobToDataUrl(r.logo,      r.logo_mime),
      signature:      blobToDataUrl(r.signature, r.sig_mime),
      studentCount:   r.student_count     != null ? Number(r.student_count)     : null,
      idCardTypeId:   r.id_card_type_id   != null ? Number(r.id_card_type_id)   : null,
      idCardTypeName: r.id_card_type_name != null ? String(r.id_card_type_name) : null,
      lanyard:        ['Printed', 'Not printed', 'Not needed'].includes(r.lanyard as string) ? r.lanyard as 'Printed' | 'Not printed' | 'Not needed' : null,
    };
  } catch {
    return { logo: null, signature: null, studentCount: null, idCardTypeId: null, idCardTypeName: null, lanyard: null };
  }
}
