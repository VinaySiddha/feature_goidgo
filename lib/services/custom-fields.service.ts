'use server';

import { dbExecute, withTransaction, connExecute } from '../db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { requireAuth, requireFacultyAdmin } from '../auth';
import { CustomField, CustomFieldOption, CustomFieldType, StudentCustomValue } from '../types';

// ── helpers ───────────────────────────────────────────────────────────────────

function rowToField(r: RowDataPacket): CustomField {
  return {
    id:            r.id            as number,
    college:       r.college       as string,
    field_key:     r.field_key     as string,
    label:         r.label         as string,
    field_type:    r.field_type    as CustomFieldType,
    is_required:   Boolean(r.is_required),
    placeholder:   (r.placeholder  as string | null) ?? null,
    display_order: r.display_order as number,
    is_active:     Boolean(r.is_active),
    created_at:    r.created_at    as string,
  };
}

function rowToOption(r: RowDataPacket): CustomFieldOption {
  return {
    id:              r.id              as number,
    custom_field_id: r.custom_field_id as number,
    option_label:    r.option_label    as string,
    option_value:    r.option_value    as string,
    display_order:   r.display_order   as number,
  };
}

// ── READ ──────────────────────────────────────────────────────────────────────

/** Returns all active custom fields for a college, with their options. */
export async function getCustomFields(college: string): Promise<CustomField[]> {
  await requireAuth(['faculty', 'faculty_admin', 'admin']);
  if (!college) return [];

  const [fieldRows] = await dbExecute<RowDataPacket[]>(
    `SELECT * FROM custom_fields
     WHERE college = ? AND is_active = 1
     ORDER BY display_order ASC, id ASC`,
    [college.trim()]
  );

  if (fieldRows.length === 0) return [];

  const fields = fieldRows.map(rowToField);
  const ids = fields.map(f => f.id);

  const [optRows] = await dbExecute<RowDataPacket[]>(
    `SELECT * FROM custom_field_options
     WHERE custom_field_id IN (${ids.map(() => '?').join(',')})
     ORDER BY display_order ASC, id ASC`,
    ids
  );

  const optMap = new Map<number, CustomFieldOption[]>();
  for (const opt of optRows.map(rowToOption)) {
    const list = optMap.get(opt.custom_field_id) ?? [];
    list.push(opt);
    optMap.set(opt.custom_field_id, list);
  }

  return fields.map(f => ({ ...f, options: optMap.get(f.id) ?? [] }));
}

/** Returns all custom fields (active + inactive) for the field manager UI. */
export async function getAllCustomFields(college: string): Promise<CustomField[]> {
  await requireFacultyAdmin();
  if (!college) return [];

  const [fieldRows] = await dbExecute<RowDataPacket[]>(
    `SELECT * FROM custom_fields
     WHERE college = ?
     ORDER BY display_order ASC, id ASC`,
    [college.trim()]
  );

  if (fieldRows.length === 0) return [];

  const fields = fieldRows.map(rowToField);
  const ids = fields.map(f => f.id);

  const [optRows] = await dbExecute<RowDataPacket[]>(
    `SELECT * FROM custom_field_options
     WHERE custom_field_id IN (${ids.map(() => '?').join(',')})
     ORDER BY display_order ASC, id ASC`,
    ids
  );

  const optMap = new Map<number, CustomFieldOption[]>();
  for (const opt of optRows.map(rowToOption)) {
    const list = optMap.get(opt.custom_field_id) ?? [];
    list.push(opt);
    optMap.set(opt.custom_field_id, list);
  }

  return fields.map(f => ({ ...f, options: optMap.get(f.id) ?? [] }));
}

// ── CREATE ────────────────────────────────────────────────────────────────────

export interface CreateCustomFieldInput {
  college: string;
  label: string;
  field_type: CustomFieldType;
  is_required: boolean;
  placeholder?: string;
  options?: { option_label: string; option_value: string }[];
}

export async function createCustomField(
  input: CreateCustomFieldInput
): Promise<{ success: boolean; message: string; id?: number }> {
  await requireFacultyAdmin();
  const { college, label, field_type, is_required, placeholder, options } = input;

  if (!college?.trim()) return { success: false, message: 'College is required.' };
  if (!label?.trim())   return { success: false, message: 'Field label is required.' };

  // Build a stable snake_case key from the label
  const field_key = label.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

  try {
    let newId: number | undefined;

    await withTransaction(async (conn) => {
      // Get current max display_order for this college
      const [[orderRow]] = await connExecute<RowDataPacket[]>(
        conn,
        'SELECT COALESCE(MAX(display_order), -1) AS max_order FROM custom_fields WHERE college = ?',
        [college.trim()]
      );
      const nextOrder = (Number(orderRow.max_order) + 1);

      const [result] = await connExecute<ResultSetHeader>(
        conn,
        `INSERT INTO custom_fields
           (college, field_key, label, field_type, is_required, placeholder, display_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          college.trim(), field_key, label.trim(), field_type,
          is_required ? 1 : 0,
          placeholder?.trim() || null,
          nextOrder,
        ]
      );
      newId = result.insertId;

      if ((field_type === 'SELECT' || field_type === 'RADIO') && options?.length) {
        for (let i = 0; i < options.length; i++) {
          const { option_label, option_value } = options[i];
          if (!option_label?.trim()) continue;
          await connExecute(
            conn,
            `INSERT INTO custom_field_options
               (custom_field_id, option_label, option_value, display_order)
             VALUES (?, ?, ?, ?)`,
            [newId, option_label.trim(), option_value?.trim() || option_label.trim(), i]
          );
        }
      }
    });

    return { success: true, message: 'Field created successfully.', id: newId };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('Duplicate entry') || msg.includes('uq_college_key')) {
      return { success: false, message: 'A field with a similar name already exists for this school.' };
    }
    console.error('createCustomField error:', err);
    return { success: false, message: 'Failed to create field.' };
  }
}

// ── UPDATE ────────────────────────────────────────────────────────────────────

export interface UpdateCustomFieldInput {
  id: number;
  college: string;
  label: string;
  field_type: CustomFieldType;
  is_required: boolean;
  placeholder?: string;
  is_active: boolean;
  options?: { id?: number; option_label: string; option_value: string }[];
}

export async function updateCustomField(
  input: UpdateCustomFieldInput
): Promise<{ success: boolean; message: string }> {
  await requireFacultyAdmin();
  const { id, college, label, field_type, is_required, placeholder, is_active, options } = input;

  if (!label?.trim()) return { success: false, message: 'Field label is required.' };

  try {
    await withTransaction(async (conn) => {
      await connExecute(
        conn,
        `UPDATE custom_fields SET
           label=?, field_type=?, is_required=?, placeholder=?, is_active=?
         WHERE id=? AND college=?`,
        [
          label.trim(), field_type, is_required ? 1 : 0,
          placeholder?.trim() || null, is_active ? 1 : 0,
          id, college.trim(),
        ]
      );

      // Replace options entirely for SELECT/RADIO fields
      if (field_type === 'SELECT' || field_type === 'RADIO') {
        await connExecute(conn,
          'DELETE FROM custom_field_options WHERE custom_field_id = ?', [id]);

        if (options?.length) {
          for (let i = 0; i < options.length; i++) {
            const { option_label, option_value } = options[i];
            if (!option_label?.trim()) continue;
            await connExecute(
              conn,
              `INSERT INTO custom_field_options
                 (custom_field_id, option_label, option_value, display_order)
               VALUES (?, ?, ?, ?)`,
              [id, option_label.trim(), option_value?.trim() || option_label.trim(), i]
            );
          }
        }
      } else {
        // Non-option type: remove any stale options
        await connExecute(conn,
          'DELETE FROM custom_field_options WHERE custom_field_id = ?', [id]);
      }
    });

    return { success: true, message: 'Field updated successfully.' };
  } catch (err) {
    console.error('updateCustomField error:', err);
    return { success: false, message: 'Failed to update field.' };
  }
}

// ── REORDER ───────────────────────────────────────────────────────────────────

/** Accepts an ordered array of field IDs and updates display_order accordingly. */
export async function reorderCustomFields(
  college: string,
  orderedIds: number[]
): Promise<{ success: boolean }> {
  await requireFacultyAdmin();
  try {
    await withTransaction(async (conn) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await connExecute(
          conn,
          'UPDATE custom_fields SET display_order=? WHERE id=? AND college=?',
          [i, orderedIds[i], college.trim()]
        );
      }
    });
    return { success: true };
  } catch (err) {
    console.error('reorderCustomFields error:', err);
    return { success: false };
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function deleteCustomField(
  id: number,
  college: string
): Promise<{ success: boolean; message: string }> {
  await requireFacultyAdmin();
  try {
    // Soft-delete: mark inactive
    await dbExecute(
      'UPDATE custom_fields SET is_active = 0 WHERE id = ? AND college = ?',
      [id, college.trim()]
    );
    return { success: true, message: 'Field removed.' };
  } catch (err) {
    console.error('deleteCustomField error:', err);
    return { success: false, message: 'Failed to remove field.' };
  }
}

// ── STUDENT CUSTOM VALUES ─────────────────────────────────────────────────────

/** Fetch all custom values for a single student. */
export async function getStudentCustomValues(
  studentId: string
): Promise<StudentCustomValue[]> {
  await requireAuth(['faculty', 'faculty_admin', 'admin']);
  if (!studentId) return [];
  const [rows] = await dbExecute<RowDataPacket[]>(
    'SELECT custom_field_id, value FROM student_custom_values WHERE student_id = ?',
    [studentId]
  );
  return rows.map(r => ({
    custom_field_id: r.custom_field_id as number,
    value:           (r.value as string | null) ?? null,
  }));
}

/** Fetch custom values for multiple students in one query (returns a map). */
export async function getCustomValuesForStudents(
  studentIds: string[]
): Promise<Map<string, StudentCustomValue[]>> {
  await requireAuth(['faculty', 'faculty_admin', 'admin']);
  const result = new Map<string, StudentCustomValue[]>();
  if (!studentIds.length) return result;

  const [rows] = await dbExecute<RowDataPacket[]>(
    `SELECT student_id, custom_field_id, value
     FROM student_custom_values
     WHERE student_id IN (${studentIds.map(() => '?').join(',')})`,
    studentIds
  );
  for (const r of rows) {
    const sid = r.student_id as string;
    const list = result.get(sid) ?? [];
    list.push({ custom_field_id: r.custom_field_id as number, value: r.value as string | null });
    result.set(sid, list);
  }
  return result;
}

/** Upsert custom field values for a student (used inside a transaction). */
export async function saveStudentCustomValues(
  studentId: string,
  values: StudentCustomValue[]
): Promise<void> {
  if (!values.length) return;
  for (const { custom_field_id, value } of values) {
    await dbExecute(
      `INSERT INTO student_custom_values (student_id, custom_field_id, value)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE value = VALUES(value)`,
      [studentId, custom_field_id, value ?? null]
    );
  }
}
