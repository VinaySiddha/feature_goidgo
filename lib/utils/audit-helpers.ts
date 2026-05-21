import { connExecute, DbConnection } from '../db';
import { StudentRecord } from '../types';

export type Snapshot = 'BEFORE' | 'AFTER';

export type UserAuditRow = {
  id: number;
  name: string;
  email: string;
  role: string;
  college_id?: number | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
};

export type CollegeAuditRow = {
  id: number;
  name: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
  created_at?: string | null;
};

function insertStudentAuditRow(op: 'INSERT' | 'UPDATE' | 'DELETE', snapshot: Snapshot, s: StudentRecord, conn: DbConnection) {
  return connExecute(
    conn,
    `INSERT INTO student_audit
       (operation, snapshot, changed_at, changed_by, student_id, college, name, parentage,
        studentid, rollno, studentclass, course, year, email, phone, busstop,
        bloodgroup, dob, address, percentage, has_photo, createdby, createdat,
        deleted_by, deleted_at)
     VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      op, snapshot,
      s.createdBy ?? null,
      s.id, s.college, s.name,
      s.parentage ?? null, s.studentId ?? null, s.rollNo ?? null,
      s.studentClass ?? null, s.course ?? null, s.year ?? null,
      s.email ?? null, s.phone, s.busStop ?? null, s.bloodGroup ?? null,
      s.dob ?? null, s.address ?? null, s.percentage ?? null,
      s.photo && s.photo.length > 0 ? 1 : 0,
      s.createdBy ?? null, s.createdAt ?? null,
      s.deletedBy ?? null, null,
    ]
  );
}

export async function logStudentAudit(
  op: 'INSERT' | 'UPDATE' | 'DELETE',
  before: StudentRecord | null,
  after: StudentRecord | null,
  conn: DbConnection
) {
  if (before) await insertStudentAuditRow(op, 'BEFORE', before, conn);
  if (after)  await insertStudentAuditRow(op, 'AFTER',  after,  conn);
}

function insertUserAuditRow(op: 'INSERT' | 'UPDATE' | 'DELETE', snapshot: Snapshot, u: UserAuditRow, conn: DbConnection) {
  return connExecute(
    conn,
    `INSERT INTO user_audit
       (operation, snapshot, changed_at, user_id, name, email, role, college_id, deleted_at, deleted_by)
     VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?)`,
    [op, snapshot, u.id, u.name, u.email, u.role, u.college_id ?? null, u.deleted_at ?? null, u.deleted_by ?? null]
  );
}

export async function logUserAudit(
  op: 'INSERT' | 'UPDATE' | 'DELETE',
  before: UserAuditRow | null,
  after: UserAuditRow | null,
  conn: DbConnection
) {
  if (before) await insertUserAuditRow(op, 'BEFORE', before, conn);
  if (after)  await insertUserAuditRow(op, 'AFTER',  after,  conn);
}

function insertCollegeAuditRow(op: 'INSERT' | 'UPDATE' | 'DELETE', snapshot: Snapshot, c: CollegeAuditRow, conn: DbConnection) {
  return connExecute(
    conn,
    `INSERT INTO college_audit
       (operation, snapshot, changed_at, college_id, name, deleted_at, deleted_by, created_at)
     VALUES (?, ?, NOW(), ?, ?, ?, ?, ?)`,
    [op, snapshot, c.id, c.name, c.deleted_at ?? null, c.deleted_by ?? null, c.created_at ?? null]
  );
}

export async function logCollegeAudit(
  op: 'INSERT' | 'UPDATE' | 'DELETE',
  before: CollegeAuditRow | null,
  after: CollegeAuditRow | null,
  conn: DbConnection
) {
  if (before) await insertCollegeAuditRow(op, 'BEFORE', before, conn);
  if (after)  await insertCollegeAuditRow(op, 'AFTER',  after,  conn);
}
