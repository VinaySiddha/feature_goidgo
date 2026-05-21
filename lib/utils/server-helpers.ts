import { dbExecute } from '../db';
import { StudentRecord } from '../types';
import { RowDataPacket } from 'mysql2';
import { headers } from 'next/headers';

export function nowIST(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace('T', ' ');
}

export async function getRequestMeta() {
  try {
    const h = await headers();
    const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? 'unknown';
    const ua = h.get('user-agent') ?? 'unknown';
    return { ip, ua };
  } catch {
    return { ip: 'unknown', ua: 'unknown' };
  }
}

/** Trim a string; return null if empty/missing */
export function t(v: string | undefined | null): string | null {
  if (v == null) return null;
  const s = v.trim();
  return s.length > 0 ? s : null;
}

export function rowToStudent(row: RowDataPacket): StudentRecord {
  const r = row as Record<string, unknown>;

  let photo: string | undefined;
  const p = r.photo;
  if (p instanceof Buffer || p instanceof Uint8Array) {
    const b64 = Buffer.from(p).toString('base64');
    if (b64) photo = `data:image/png;base64,${b64}`;
  } else if (typeof p === 'string' && p.length > 0) {
    photo = p;
  }

  return {
    id:           String(r.id ?? ''),
    college:      String(r.college ?? ''),
    name:         String(r.name ?? ''),
    phone:        String(r.phone ?? ''),
    createdAt:    r.createdAt ? String(r.createdAt) : new Date().toISOString(),
    studentId:    r.studentid    ? String(r.studentid)    : (r.studentId    ? String(r.studentId)    : undefined),
    createdBy:    r.createdby    ? String(r.createdby)    : (r.createdBy    ? String(r.createdBy)    : undefined),
    course:       r.course       ? String(r.course)       : undefined,
    year:         r.year         ? String(r.year)         : undefined,
    email:        r.email        ? String(r.email)        : undefined,
    parentage:    r.parentage    ? String(r.parentage)    : undefined,
    rollNo:       r.rollNo       ? String(r.rollNo)       : undefined,
    studentClass: r.studentClass ? String(r.studentClass) : undefined,
    busStop:      r.busStop      ? String(r.busStop)      : undefined,
    bloodGroup:   r.bloodGroup   ? String(r.bloodGroup)   : undefined,
    dob:          r.dob          ? String(r.dob)          : undefined,
    address:      r.address      ? String(r.address)      : undefined,
    percentage:   r.percentage   ? String(r.percentage)   : undefined,
    deletedBy:    r.deleted_by   ? String(r.deleted_by)   : null,
    photo,
  };
}

export async function getCollegeId(name: string | null | undefined): Promise<number | null> {
  if (!name) return null;
  const [rows] = await dbExecute<RowDataPacket[]>(
    'SELECT id FROM colleges WHERE name = ? AND deleted_at IS NULL',
    [name.trim()]
  );
  return rows.length > 0 ? (rows[0] as RowDataPacket).id as number : null;
}

export function dataUrlToBlob(dataUrl: string | null | undefined): { buf: Buffer | null; mime: string | null } {
  if (!dataUrl) return { buf: null, mime: null };
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return { buf: null, mime: null };
  return { buf: Buffer.from(m[2], 'base64'), mime: m[1] };
}

export function blobToDataUrl(blob: unknown, mime: unknown): string | null {
  if (!blob || !mime) return null;
  const buf = blob instanceof Buffer ? blob : Buffer.from(blob as Uint8Array);
  return `data:${mime};base64,${buf.toString('base64')}`;
}
