export type UserRole = 'faculty' | 'admin' | 'faculty_admin';

// ── Custom Fields ─────────────────────────────────────────────────────────────

export type CustomFieldType =
  | 'TEXT' | 'NUMBER' | 'DATE' | 'EMAIL'
  | 'PHONE' | 'SELECT' | 'RADIO' | 'CHECKBOX' | 'TEXTAREA';

export interface CustomFieldOption {
  id: number;
  custom_field_id: number;
  option_label: string;
  option_value: string;
  display_order: number;
}

export interface CustomField {
  id: number;
  college: string;
  field_key: string;
  label: string;
  field_type: CustomFieldType;
  is_required: boolean;
  placeholder: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  options?: CustomFieldOption[];   // populated when field_type is SELECT or RADIO
}

export interface StudentCustomValue {
  custom_field_id: number;
  value: string | null;
}

export interface AuditLog {
  id: number;
  userEmail: string;
  userName: string;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface LoginHistory {
  id: number;
  userEmail: string;
  userName: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface StudentAuditRow {
  auditId: number;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  snapshot: 'BEFORE' | 'AFTER';
  changedAt: string;
  changedBy: string | null;
  studentId: string;
  college: string | null;
  name: string | null;
  course: string | null;
  year: string | null;
  studentClass: string | null;
  rollno: string | null;
  phone: string | null;
  hasPhoto: number | null;
  deletedBy: string | null;
}

export interface UserAuditRow {
  auditId: number;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  snapshot: 'BEFORE' | 'AFTER';
  changedAt: string;
  userId: number;
  name: string | null;
  email: string | null;
  role: string | null;
  college: string | null;
  deletedBy: string | null;
}

export interface CollegeAuditRow {
  auditId: number;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  snapshot: 'BEFORE' | 'AFTER';
  changedAt: string;
  collegeId: number;
  name: string | null;
  deletedBy: string | null;
}

export interface User {
  name: string;
  email: string;
  password: string;
  college?: string;
  role: UserRole;
}

export interface DbUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  college?: string | null;
  created_at: string;
  deletedBy?: string | null;
}

export interface DraftRecord {
  id: string;
  college: string;
  name: string;
  phone: string;
  studentId?: string;
  course?: string;
  year?: string;
  email?: string;
  parentage?: string;
  rollNo?: string;
  studentClass?: string;
  busStop?: string;
  bloodGroup?: string;
  dob?: string;
  address?: string;
  percentage?: string;
  photo?: string;
  savedBy: string;
  updatedAt: string;
}

export interface StudentStats {
  total: number;
  withPhoto: number;
  completed: number;
  byCollege: Array<{ college: string; total: number; withPhoto: number; pending: number }>;
  byFaculty: Array<{ faculty: string; count: number }>;
}

export interface StudentRecord {
  id: string;
  college: string;
  name: string;
  phone: string;
  createdAt: string;
  studentId?: string;
  course?: string;
  year?: string;
  email?: string;
  parentage?: string;
  rollNo?: string;
  studentClass?: string;
  busStop?: string;
  bloodGroup?: string;
  dob?: string;
  address?: string;
  percentage?: string;
  photo?: string;
  createdBy?: string;
  deletedBy?: string | null;
}
