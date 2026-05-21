'use server';

import { dbExecute } from '../db';
import { RowDataPacket } from 'mysql2';
import { requireAdmin, requireAnyFaculty, requireAuth } from '../auth';
import { nowIST, getRequestMeta } from '../utils/server-helpers';
import { AuditLog, LoginHistory } from '../types';

export async function addAuditLog(data: {
  userEmail: string;
  userName: string;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: string;
}): Promise<void> {
  await requireAnyFaculty();
  const { ip, ua } = await getRequestMeta();
  try {
    await dbExecute(
      `INSERT INTO audit_logs (user_email, user_name, action, entity_type, entity_id, details, ip_address, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.userEmail, data.userName, data.action,
       data.entityType ?? null, data.entityId ?? null, data.details ?? null, ip, ua, nowIST()]
    );
  } catch { /* non-critical */ }
}

export async function getAuditLogs(): Promise<AuditLog[]> {
  await requireAdmin();
  try {
    const [rows] = await dbExecute<RowDataPacket[]>(
      `SELECT id, user_email AS userEmail, user_name AS userName, action,
              entity_type AS entityType, entity_id AS entityId, details,
              ip_address AS ipAddress, user_agent AS userAgent,
              created_at AS createdAt
       FROM audit_logs ORDER BY created_at DESC LIMIT 500`
    );
    return (rows as RowDataPacket[]).map(r => ({ ...r, createdAt: String(r.createdAt) })) as AuditLog[];
  } catch { return []; }
}

export async function getAuditLogsByCollege(college: string): Promise<AuditLog[]> {
  await requireAuth(['admin', 'faculty_admin']);
  try {
    const [rows] = await dbExecute<RowDataPacket[]>(
      `SELECT al.id, al.user_email AS userEmail, al.user_name AS userName, al.action,
              al.entity_type AS entityType, al.entity_id AS entityId, al.details,
              al.ip_address AS ipAddress, al.user_agent AS userAgent,
              al.created_at AS createdAt
       FROM audit_logs al
       WHERE al.user_email IN (
         SELECT u.email FROM users u
         LEFT JOIN colleges c ON c.id = u.college_id
         WHERE c.name = ?
       )
       ORDER BY al.created_at DESC LIMIT 300`,
      [college]
    );
    return (rows as RowDataPacket[]).map(r => ({ ...r, createdAt: String(r.createdAt) })) as AuditLog[];
  } catch { return []; }
}

export async function getLoginHistory(): Promise<LoginHistory[]> {
  await requireAdmin();
  try {
    const [rows] = await dbExecute<RowDataPacket[]>(
      `SELECT id, user_email AS userEmail, user_name AS userName,
              ip_address AS ipAddress, user_agent AS userAgent,
              created_at AS createdAt
       FROM login_history ORDER BY created_at DESC LIMIT 500`
    );
    return (rows as RowDataPacket[]).map(r => ({ ...r, createdAt: String(r.createdAt) })) as LoginHistory[];
  } catch { return []; }
}

export async function getLoginHistoryByCollege(college: string): Promise<LoginHistory[]> {
  await requireAuth(['admin', 'faculty_admin']);
  try {
    const [rows] = await dbExecute<RowDataPacket[]>(
      `SELECT lh.id, lh.user_email AS userEmail, lh.user_name AS userName,
              lh.ip_address AS ipAddress, lh.user_agent AS userAgent,
              lh.created_at AS createdAt
       FROM login_history lh
       WHERE lh.user_email IN (
         SELECT u.email FROM users u
         LEFT JOIN colleges c ON c.id = u.college_id
         WHERE c.name = ?
       )
       ORDER BY lh.created_at DESC LIMIT 300`,
      [college]
    );
    return (rows as RowDataPacket[]).map(r => ({ ...r, createdAt: String(r.createdAt) })) as LoginHistory[];
  } catch { return []; }
}

export async function getStudentAuditLogs() {
  await requireAdmin();
  try {
    const [rows] = await dbExecute<RowDataPacket[]>(
      `SELECT audit_id AS auditId, operation, snapshot, changed_at AS changedAt,
              changed_by AS changedBy, student_id AS studentId, college, name,
              course, year, studentclass AS studentClass, rollno, phone,
              has_photo AS hasPhoto, deleted_by AS deletedBy
       FROM student_audit
       ORDER BY changed_at DESC LIMIT 500`
    );
    return (rows as RowDataPacket[]).map(r => ({ ...r, changedAt: String(r.changedAt) }));
  } catch { return []; }
}

export async function getUserAuditLogs() {
  await requireAdmin();
  try {
    const [rows] = await dbExecute<RowDataPacket[]>(
      `SELECT ua.audit_id AS auditId, ua.operation, ua.snapshot,
              ua.changed_at AS changedAt, ua.user_id AS userId,
              ua.name, ua.email, ua.role,
              c.name AS college, ua.deleted_by AS deletedBy
       FROM user_audit ua
       LEFT JOIN colleges c ON c.id = ua.college_id
       ORDER BY ua.changed_at DESC LIMIT 500`
    );
    return (rows as RowDataPacket[]).map(r => ({ ...r, changedAt: String(r.changedAt) }));
  } catch { return []; }
}

export async function getCollegeAuditLogs() {
  await requireAdmin();
  try {
    const [rows] = await dbExecute<RowDataPacket[]>(
      `SELECT audit_id AS auditId, operation, snapshot,
              changed_at AS changedAt, college_id AS collegeId,
              name, deleted_by AS deletedBy
       FROM college_audit
       ORDER BY changed_at DESC LIMIT 500`
    );
    return (rows as RowDataPacket[]).map(r => ({ ...r, changedAt: String(r.changedAt) }));
  } catch { return []; }
}

export async function getExportLogs(): Promise<AuditLog[]> {
  await requireAdmin();
  try {
    const [rows] = await dbExecute<RowDataPacket[]>(
      `SELECT id, user_email AS userEmail, user_name AS userName, action,
              entity_type AS entityType, entity_id AS entityId, details,
              ip_address AS ipAddress, user_agent AS userAgent,
              created_at AS createdAt
       FROM audit_logs
       WHERE action IN ('export_zip', 'export_excel')
       ORDER BY created_at DESC LIMIT 500`
    );
    return (rows as RowDataPacket[]).map(r => ({ ...r, createdAt: String(r.createdAt) })) as AuditLog[];
  } catch { return []; }
}

export async function getLogsPageData() {
  await requireAdmin();
  const [exportLogs, loginHistory, studentAudit, userAudit, collegeAudit] = await Promise.all([
    getExportLogs(),
    getLoginHistory(),
    getStudentAuditLogs(),
    getUserAuditLogs(),
    getCollegeAuditLogs(),
  ]);
  return { exportLogs, loginHistory, studentAudit, userAudit, collegeAudit };
}
