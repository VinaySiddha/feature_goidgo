'use server';

import { dbExecute } from '../db';
import { RowDataPacket } from 'mysql2';
import { requireAnyFaculty } from '../auth';
import { t } from '../utils/server-helpers';
import { DraftRecord } from '../types';

export async function saveDraftToDb(draft: DraftRecord): Promise<{ success: boolean; message?: string }> {
  await requireAnyFaculty();
  try {
    const photoBlob = draft.photo
      ? Buffer.from(draft.photo.replace(/^data:image\/\w+;base64,/, ''), 'base64')
      : null;
    await dbExecute(
      `INSERT INTO student_drafts
         (id, college, name, parentage, studentid, rollNo, studentClass,
          course, year, email, phone, busStop, bloodGroup, photo, saved_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         college=VALUES(college), name=VALUES(name), parentage=VALUES(parentage),
         studentid=VALUES(studentid), rollNo=VALUES(rollNo), studentClass=VALUES(studentClass),
         course=VALUES(course), year=VALUES(year), email=VALUES(email),
         phone=VALUES(phone), busStop=VALUES(busStop), bloodGroup=VALUES(bloodGroup),
         photo=VALUES(photo), saved_by=VALUES(saved_by)`,
      [
        draft.id, t(draft.college), t(draft.name), t(draft.parentage),
        t(draft.studentId), t(draft.rollNo), t(draft.studentClass),
        t(draft.course), t(draft.year), t(draft.email), t(draft.phone),
        t(draft.busStop), t(draft.bloodGroup), photoBlob, draft.savedBy,
      ]
    );
    return { success: true };
  } catch (error) {
    console.error('Save draft error:', error);
    return { success: false, message: 'Failed to save draft.' };
  }
}

export async function getDraftsByUser(savedBy: string): Promise<DraftRecord[]> {
  await requireAnyFaculty();
  try {
    const [rows] = await dbExecute<RowDataPacket[]>(
      'SELECT * FROM student_drafts WHERE saved_by = ? ORDER BY updated_at DESC',
      [savedBy]
    );
    return (rows as RowDataPacket[]).map(r => {
      let photo: string | undefined;
      const p = r.photo;
      if (p instanceof Buffer && p.length > 0) {
        photo = `data:image/png;base64,${p.toString('base64')}`;
      } else if (typeof p === 'string' && p.length > 0) {
        photo = p;
      }
      return {
        id:           String(r.id),
        college:      String(r.college ?? ''),
        name:         String(r.name ?? ''),
        phone:        String(r.phone ?? ''),
        parentage:    r.parentage    ? String(r.parentage)    : undefined,
        studentId:    r.studentid    ? String(r.studentid)    : undefined,
        rollNo:       r.rollNo       ? String(r.rollNo)       : undefined,
        studentClass: r.studentClass ? String(r.studentClass) : undefined,
        course:       r.course       ? String(r.course)       : undefined,
        year:         r.year         ? String(r.year)         : undefined,
        email:        r.email        ? String(r.email)        : undefined,
        busStop:      r.busStop      ? String(r.busStop)      : undefined,
        bloodGroup:   r.bloodGroup   ? String(r.bloodGroup)   : undefined,
        photo,
        savedBy:   String(r.saved_by),
        updatedAt: String(r.updated_at),
      } as DraftRecord;
    });
  } catch (error) {
    console.error('Get drafts error:', error);
    return [];
  }
}

export async function deleteDraftFromDb(id: string): Promise<{ success: boolean }> {
  await requireAnyFaculty();
  try {
    await dbExecute('DELETE FROM student_drafts WHERE id = ?', [id]);
    return { success: true };
  } catch (error) {
    console.error('Delete draft error:', error);
    return { success: false };
  }
}
