'use server';

import { getSessionUser } from '../session';
import { User, StudentRecord } from '../types';
import { getCollegesFromDb } from './college.service';

export async function initApp(): Promise<{
  user: User | null;
  students: StudentRecord[];
  colleges: string[];
}> {
  const sessionUser = await getSessionUser();
  const user = sessionUser ? (sessionUser as unknown as User) : null;

  if (!user) return { user: null, students: [], colleges: [] };

  const colleges = await getCollegesFromDb().catch(() => [] as string[]);

  return { user, students: [], colleges };
}
