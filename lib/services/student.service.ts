'use server';

import { dbExecute, withTransaction, connExecute } from '../db';
import { RowDataPacket } from 'mysql2';
import { requireAnyFaculty, requireAdmin, requireAuth } from '../auth';
import { t, rowToStudent } from '../utils/server-helpers';
import { StudentRecord, StudentStats } from '../types';

export async function addStudentToDb(student: StudentRecord) {
  await requireAnyFaculty();
  const name    = t(student.name);
  const college = t(student.college);
  const phone   = t(student.phone);
  if (!name)    return { success: false, message: 'Student name is required.' };
  if (!college) return { success: false, message: 'College is required.' };
  if (!phone)   return { success: false, message: 'Phone number is required.' };

  const photoBlob = student.photo
    ? Buffer.from(student.photo.replace(/^data:image\/\w+;base64,/, ''), 'base64')
    : Buffer.alloc(0);

  try {
    await dbExecute(
      `INSERT INTO students
         (id, college, name, parentage, studentid, rollNo, studentClass,
          course, year, email, phone, busStop, bloodGroup, dob, address, percentage, photo, createdby)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        student.id, college, name,
        t(student.parentage), t(student.studentId), t(student.rollNo),
        t(student.studentClass), t(student.course), t(student.year),
        t(student.email), phone, t(student.busStop), t(student.bloodGroup),
        t(student.dob), t(student.address), t(student.percentage),
        photoBlob, t(student.createdBy) ?? 'Unknown',
      ]
    );
    return { success: true, message: 'Student registered successfully.' };
  } catch (error: unknown) {
    console.error('Add student error:', error);
    const msg = error instanceof Error ? error.message : '';
    if (msg.includes('Duplicate entry')) return { success: false, message: 'A student with this ID already exists.' };
    return { success: false, message: 'Failed to save student record.' };
  }
}

export async function bulkAddStudentsToDb(
  students: StudentRecord[]
): Promise<{ saved: number; failed: number; errors: string[] }> {
  await requireAnyFaculty();
  let saved = 0;
  const errors: string[] = [];

  try {
    await withTransaction(async (conn) => {
      for (const student of students) {
        const name    = t(student.name);
        const college = t(student.college);
        const phone   = t(student.phone);
        if (!name || !college || !phone) {
          errors.push(`${student.name || 'Unnamed'}: missing required fields`);
          continue;
        }
        const photoBlob = student.photo
          ? Buffer.from(student.photo.replace(/^data:image\/\w+;base64,/, ''), 'base64')
          : Buffer.alloc(0);
        try {
          await connExecute(conn,
            `INSERT INTO students
               (id, college, name, parentage, studentid, rollNo, studentClass,
                course, year, email, phone, busStop, bloodGroup, dob, address, percentage, photo, createdby)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              student.id, college, name,
              t(student.parentage), t(student.studentId), t(student.rollNo),
              t(student.studentClass), t(student.course), t(student.year),
              t(student.email), phone, t(student.busStop), t(student.bloodGroup),
              t(student.dob), t(student.address), t(student.percentage),
              photoBlob, t(student.createdBy) ?? 'Unknown',
            ]
          );
          saved++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : '';
          errors.push(`${student.name}: ${msg.includes('Duplicate') ? 'duplicate ID — skipped' : 'failed to save'}`);
        }
      }
    });
  } catch (err) {
    console.error('bulkAddStudentsToDb transaction error:', err);
  }

  return { saved, failed: students.length - saved, errors };
}

export async function updateStudentInDb(student: StudentRecord) {
  await requireAnyFaculty();
  const name  = t(student.name);
  const phone = t(student.phone);
  if (!name)  return { success: false, message: 'Student name is required.' };
  if (!phone) return { success: false, message: 'Phone number is required.' };

  try {
    await withTransaction(async (conn) => {
      if (student.photo) {
        const photoBlob = Buffer.from(student.photo.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        await connExecute(conn,
          `UPDATE students SET
             college=?, name=?, parentage=?, studentid=?, rollNo=?, studentClass=?,
             course=?, year=?, email=?, phone=?, busStop=?, bloodGroup=?, dob=?, address=?, percentage=?, photo=?
           WHERE id=? AND deleted_at IS NULL`,
          [
            t(student.college) ?? student.college, name,
            t(student.parentage), t(student.studentId), t(student.rollNo),
            t(student.studentClass), t(student.course), t(student.year),
            t(student.email), phone, t(student.busStop), t(student.bloodGroup),
            t(student.dob), t(student.address), t(student.percentage),
            photoBlob, student.id,
          ]
        );
      } else {
        await connExecute(conn,
          `UPDATE students SET
             college=?, name=?, parentage=?, studentid=?, rollNo=?, studentClass=?,
             course=?, year=?, email=?, phone=?, busStop=?, bloodGroup=?, dob=?, address=?, percentage=?
           WHERE id=? AND deleted_at IS NULL`,
          [
            t(student.college) ?? student.college, name,
            t(student.parentage), t(student.studentId), t(student.rollNo),
            t(student.studentClass), t(student.course), t(student.year),
            t(student.email), phone, t(student.busStop), t(student.bloodGroup),
            t(student.dob), t(student.address), t(student.percentage),
            student.id,
          ]
        );
      }
    });
    return { success: true, message: 'Student updated successfully.' };
  } catch (error) {
    console.error('Update student error:', error);
    return { success: false, message: 'Failed to update student record.' };
  }
}

export async function deleteStudentFromDb(id: string, deletedBy?: string) {
  await requireAnyFaculty();
  if (!id) return { success: false, message: 'Student ID is required.' };
  try {
    const by = t(deletedBy) ?? 'Unknown';
    await dbExecute(
      'UPDATE students SET deleted_at = NOW(), deleted_by = ? WHERE id = ? AND deleted_at IS NULL',
      [by, id]
    );
    return { success: true };
  } catch (error) {
    console.error('Delete student error:', error);
    return { success: false };
  }
}

export async function restoreStudentInDb(id: string): Promise<{ success: boolean }> {
  await requireAuth(['admin', 'faculty_admin', 'faculty']);
  if (!id) return { success: false };
  try {
    await dbExecute('UPDATE students SET deleted_at = NULL, deleted_by = NULL WHERE id = ?', [id]);
    return { success: true };
  } catch (error) {
    console.error('Restore student error:', error);
    return { success: false };
  }
}

export async function getStudents() {
  await requireAnyFaculty();
  try {
    const [rows] = await dbExecute<RowDataPacket[]>(
      'SELECT * FROM students WHERE deleted_at IS NULL ORDER BY createdAt DESC'
    );
    return rows.map(rowToStudent);
  } catch (error) {
    console.error('Fetch students error:', error);
    return [];
  }
}

export async function getStudentsByCollege(college: string): Promise<StudentRecord[]> {
  await requireAnyFaculty();
  if (!college) return [];
  try {
    const [rows] = await dbExecute<RowDataPacket[]>(
      'SELECT * FROM students WHERE college = ? AND deleted_at IS NULL ORDER BY createdAt DESC',
      [college.trim()]
    );
    return rows.map(rowToStudent);
  } catch (error) {
    console.error('Fetch students by college error:', error);
    return [];
  }
}

export async function getDeletedStudents(): Promise<StudentRecord[]> {
  await requireAdmin();
  try {
    const [rows] = await dbExecute<RowDataPacket[]>(
      'SELECT * FROM students WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC'
    );
    return rows.map(rowToStudent);
  } catch (error) {
    console.error('Fetch deleted students error:', error);
    return [];
  }
}

export async function getDeletedStudentsByCollege(college: string): Promise<StudentRecord[]> {
  await requireAuth(['admin', 'faculty_admin', 'faculty']);
  if (!college) return [];
  try {
    const [rows] = await dbExecute<RowDataPacket[]>(
      'SELECT * FROM students WHERE college = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC',
      [college.trim()]
    );
    return rows.map(rowToStudent);
  } catch (error) {
    console.error('Fetch deleted students by college error:', error);
    return [];
  }
}

export async function getCollegeDashboardData(college: string): Promise<{ students: StudentRecord[]; deletedStudents: StudentRecord[] }> {
  await requireAnyFaculty();
  if (!college) return { students: [], deletedStudents: [] };
  const [students, deletedStudents] = await Promise.all([
    getStudentsByCollege(college),
    getDeletedStudentsByCollege(college),
  ]);
  return { students, deletedStudents };
}

export async function migrateBase64PhotosToBlob(): Promise<{ success: boolean; migrated: number; message: string }> {
  try {
    const [rows] = await dbExecute<RowDataPacket[]>(
      "SELECT id, photo FROM students WHERE photo IS NOT NULL AND photo != ''"
    );
    const base64Rows = (rows as RowDataPacket[]).filter(r => typeof r.photo === 'string' && r.photo.length > 0);
    let migrated = 0;
    for (const row of base64Rows) {
      const raw  = (row.photo as string).replace(/^data:image\/\w+;base64,/, '');
      const blob = Buffer.from(raw, 'base64');
      await dbExecute('UPDATE students SET photo = ? WHERE id = ?', [blob, row.id]);
      migrated++;
    }
    return { success: true, migrated, message: `Migrated ${migrated} photo(s) from base64 to BLOB.` };
  } catch (error) {
    console.error('Migration error:', error);
    return { success: false, migrated: 0, message: 'Migration failed.' };
  }
}

export interface StudentQueryParams {
  college?: string;
  createdBy?: string;
  search?: string;
  studentClass?: string;
  page?: number;
  limit?: number;
}

export async function getStudentsPaginated(
  params: StudentQueryParams
): Promise<{ students: StudentRecord[]; total: number }> {
  await requireAnyFaculty();
  const { college, createdBy, search, studentClass, page = 1, limit = 25 } = params;
  const offset = (page - 1) * limit;

  const conditions: string[] = ['deleted_at IS NULL'];
  const values: (string | number)[] = [];

  if (college)       { conditions.push('college = ?');      values.push(college.trim()); }
  if (createdBy)     { conditions.push('createdby = ?');    values.push(createdBy.trim()); }
  if (studentClass)  { conditions.push('studentClass = ?'); values.push(studentClass.trim()); }
  if (search?.trim()) {
    const like = `%${search.trim()}%`;
    conditions.push('(name LIKE ? OR phone LIKE ? OR rollNo LIKE ? OR studentid LIKE ? OR email LIKE ?)');
    values.push(like, like, like, like, like);
  }

  const where = conditions.join(' AND ');

  const [[countRow]] = await dbExecute<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM students WHERE ${where}`,
    values
  );
  const total = Number((countRow as RowDataPacket).total);

  const [rows] = await dbExecute<RowDataPacket[]>(
    `SELECT * FROM students WHERE ${where} ORDER BY name ASC LIMIT ? OFFSET ?`,
    [...values, limit, offset]
  );

  return { students: rows.map(rowToStudent), total };
}

export async function getStudentsForExport(
  params: Omit<StudentQueryParams, 'page' | 'limit'>
): Promise<StudentRecord[]> {
  await requireAnyFaculty();
  const { college, createdBy, search, studentClass } = params;

  const conditions: string[] = ['deleted_at IS NULL'];
  const values: (string | number)[] = [];

  if (college)       { conditions.push('college = ?');      values.push(college.trim()); }
  if (createdBy)     { conditions.push('createdby = ?');    values.push(createdBy.trim()); }
  if (studentClass)  { conditions.push('studentClass = ?'); values.push(studentClass.trim()); }
  if (search?.trim()) {
    const like = `%${search.trim()}%`;
    conditions.push('(name LIKE ? OR phone LIKE ? OR rollNo LIKE ? OR studentid LIKE ? OR email LIKE ?)');
    values.push(like, like, like, like, like);
  }

  const where = conditions.join(' AND ');
  const [rows] = await dbExecute<RowDataPacket[]>(
    `SELECT * FROM students WHERE ${where} ORDER BY name ASC`,
    values
  );
  return rows.map(rowToStudent);
}

export async function getStudentCountStats(
  params: { college?: string; createdBy?: string }
): Promise<StudentStats> {
  await requireAnyFaculty();
  const { college, createdBy } = params;

  const conditions: string[] = ['deleted_at IS NULL'];
  const values: string[] = [];
  if (college)   { conditions.push('college = ?');   values.push(college.trim()); }
  if (createdBy) { conditions.push('createdby = ?'); values.push(createdBy.trim()); }
  const where = conditions.join(' AND ');

  const [[statsRow]] = await dbExecute<RowDataPacket[]>(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN LENGTH(photo) > 0 THEN 1 ELSE 0 END) AS withPhoto,
       SUM(CASE WHEN LENGTH(photo) > 0
                 AND parentage IS NOT NULL AND parentage != ''
                 AND phone IS NOT NULL AND phone != ''
            THEN 1 ELSE 0 END) AS completed
     FROM students WHERE ${where}`,
    values
  );

  let byCollege: StudentStats['byCollege'] = [];
  if (!college) {
    const [byCollegeRows] = await dbExecute<RowDataPacket[]>(
      `SELECT college,
         COUNT(*) AS total,
         SUM(CASE WHEN LENGTH(photo) > 0 THEN 1 ELSE 0 END) AS withPhoto,
         SUM(CASE WHEN photo IS NULL OR LENGTH(photo) = 0
                       OR parentage IS NULL OR parentage = ''
                  THEN 1 ELSE 0 END) AS pending
       FROM students WHERE deleted_at IS NULL
       GROUP BY college ORDER BY college`,
      []
    );
    byCollege = (byCollegeRows as RowDataPacket[]).map(r => ({
      college:   r.college   as string,
      total:     Number(r.total),
      withPhoto: Number(r.withPhoto),
      pending:   Number(r.pending),
    }));
  }

  const [byFacultyRows] = await dbExecute<RowDataPacket[]>(
    `SELECT createdby AS faculty, COUNT(*) AS count
     FROM students WHERE ${where}
     GROUP BY createdby ORDER BY count DESC LIMIT 8`,
    values
  );
  const byFaculty = (byFacultyRows as RowDataPacket[]).map(r => ({
    faculty: (r.faculty as string) ?? 'Unknown',
    count:   Number(r.count),
  }));

  return {
    total:     Number(statsRow.total),
    withPhoto: Number(statsRow.withPhoto),
    completed: Number(statsRow.completed),
    byCollege,
    byFaculty,
  };
}

export async function parseExcelFileServer(
  formData: FormData
): Promise<{ success: boolean; rows: string[][] }> {
  await requireAnyFaculty();
  try {
    const file = formData.get('file') as File | null;
    if (!file) return { success: false, rows: [] };
    const { readExcelRows } = await import('../utils/excel');
    const buffer = await file.arrayBuffer();
    const rows = await readExcelRows(buffer);
    return { success: true, rows: rows as string[][] };
  } catch (err) {
    console.error('parseExcelFileServer error:', err);
    return { success: false, rows: [] };
  }
}
