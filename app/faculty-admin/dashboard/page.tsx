'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';
import {
  getStudentsPaginated, getStudentsForExport, getStudentCountStats,
  getDeletedStudentsByCollege, restoreStudentInDb,
  deleteStudentFromDb, updateStudentInDb,
} from '@/lib/services/student.service';
import { getCollegeAssets } from '@/lib/services/college-assets.service';
import { addAuditLog } from '@/lib/services/audit.service';
import { StudentRecord, StudentStats, CustomField } from '@/lib/types';
import StudentTable, { CORE_COLS, ColDef } from '@/components/StudentTable';
import { getCustomFields } from '@/lib/services/custom-fields.service';
import { saveAs } from 'file-saver';
import {
  FiDownload, FiRefreshCw, FiArchive, FiRotateCcw, FiChevronDown, FiColumns, FiCheck,
} from 'react-icons/fi';
import { formatISTDate } from '@/lib/formatDate';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function FacultyAdminDashboardPage() {
  const { user } = useAuth();

  // ── Table state ──
  const [tableStudents,  setTableStudents]  = useState<StudentRecord[]>([]);
  const [tableTotal,     setTableTotal]     = useState(0);
  const [tablePage,      setTablePage]      = useState(1);
  const [tablePageSize,  setTablePageSize]  = useState(5);
  const [tableSearch,    setTableSearch]    = useState('');
  const [filterClass,    setFilterClass]    = useState('');
  const [filterFaculty,  setFilterFaculty]  = useState('');
  const [tableLoading,   setTableLoading]   = useState(false);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Stats ──
  const [stats,    setStats]    = useState<StudentStats | null>(null);
  const [strength, setStrength] = useState<number | null>(null);

  // ── Filter options (populated from first full-fetch) ──
  const [allClasses,  setAllClasses]  = useState<string[]>([]);
  const [allFaculty,  setAllFaculty]  = useState<string[]>([]);

  // ── Custom fields ──
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  // ── Column visibility (lifted here so picker lives in the filter bar) ──
  const allCols = useMemo<ColDef[]>(() => [
    ...CORE_COLS,
    ...customFields.map(cf => ({ key: `cf_${cf.id}`, label: cf.label, defaultVisible: false })),
  ], [customFields]);
  const [visibleCols, setVisibleCols] = useState<Set<string>>(
    () => new Set(CORE_COLS.filter(c => c.defaultVisible).map(c => c.key))
  );
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setColMenuOpen(false);
    }
    if (colMenuOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [colMenuOpen]);
  const toggleCol = (key: string) => {
    setVisibleCols(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  };

  // ── Other ──
  const [refreshing,          setRefreshing]          = useState(false);
  const [deletedStudents,     setDeletedStudents]     = useState<StudentRecord[]>([]);
  const [showDeletedStudents, setShowDeletedStudents] = useState(false);
  const [toast,               setToast]               = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [exportProgress,      setExportProgress]      = useState<number | null>(null);
  const [confirmDialog,       setConfirmDialog]       = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const college = user?.college ?? '';

  const showToast = (text: string, type: 'success' | 'error') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3000);
  };

  // fetch paginated table
  const fetchTable = useCallback(async () => {
    if (!college) return;
    setTableLoading(true);
    const { students, total } = await getStudentsPaginated({
      college,
      search:       tableSearch   || undefined,
      studentClass: filterClass   || undefined,
      createdBy:    filterFaculty || undefined,
      page:         tablePage,
      limit:        tablePageSize,
    });
    setTableStudents(students);
    setTableTotal(total);
    setTableLoading(false);
  }, [college, tableSearch, filterClass, filterFaculty, tablePage, tablePageSize]);

  useEffect(() => { fetchTable(); }, [fetchTable]);

  useEffect(() => {
    if (college) getCustomFields(college).then(setCustomFields);
  }, [college]);

  // fetch stats
  const fetchStats = useCallback(async () => {
    if (!college) return;
    const [s, assets] = await Promise.all([
      getStudentCountStats({ college }),
      getCollegeAssets(college),
    ]);
    setStats(s);
    setStrength(assets?.studentCount ?? null);
    setAllFaculty(s.byFaculty.map(f => f.faculty));
  }, [college]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // fetch distinct classes for filter dropdown (once on mount)
  useEffect(() => {
    if (!college) return;
    getStudentsPaginated({ college, limit: 1000, page: 1 }).then(({ students }) => {
      setAllClasses([...new Set(students.map(s => s.studentClass).filter(Boolean))] as string[]);
    });
  }, [college]);

  // fetch deleted students
  useEffect(() => {
    if (college) getDeletedStudentsByCollege(college).then(setDeletedStudents);
  }, [college]);

  if (!user) return null;

  const handleSearchChange = (term: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setTableSearch(term); setTablePage(1); }, 300);
  };

  const handleDeleteStudent = async (id: string) => {
    const deletedBy = user.name || user.email;
    const result = await deleteStudentFromDb(id, deletedBy);
    if (result.success) {
      const removed = tableStudents.find(s => s.id === id);
      setTableStudents(prev => prev.filter(s => s.id !== id));
      setTableTotal(prev => prev - 1);
      if (removed) setDeletedStudents(prev => [{ ...removed, deletedBy: deletedBy || null }, ...prev]);
      showToast('Student removed.', 'success');
      fetchStats();
    } else {
      showToast('Failed to remove student.', 'error');
    }
  };

  const handleSaveStudent = async (updated: StudentRecord) => {
    const result = await updateStudentInDb(updated);
    if (result.success) setTableStudents(prev => prev.map(s => s.id === updated.id ? updated : s));
  };

  const handleRestoreStudent = async (id: string) => {
    const result = await restoreStudentInDb(id);
    if (result.success) {
      const restored = deletedStudents.find(s => s.id === id);
      setDeletedStudents(prev => prev.filter(s => s.id !== id));
      if (restored) { setTableStudents(prev => [restored, ...prev]); setTableTotal(prev => prev + 1); }
      fetchStats();
    }
  };

  const exportExcel = async () => {
    const { writeExcelFile } = await import('@/lib/utils/excel');
    const sorted = (await getStudentsForExport({ college })).sort((a, b) => a.name.localeCompare(b.name));
    await writeExcelFile(sorted.map((s, i) => ({
      '#': i + 1, 'Photo': s.photo ? `${i + 1}.png` : '',
      Name: s.name, 'Father/Mother Name': s.parentage || '',
      'Student ID': s.studentId || '', 'Roll No.': s.rollNo || '',
      Class: s.studentClass || '', College: s.college,
      Course: s.course || '', Year: s.year || '', Email: s.email || '',
      Phone: s.phone, 'Date of Birth': s.dob || '', Percentage: s.percentage || '',
      'Blood Group': s.bloodGroup || '', Address: s.address || '',
      'Bus Stop': s.busStop || '', 'Added By': s.createdBy || 'Unknown',
      'Created At': formatISTDate(s.createdAt),
    })), 'Students', `${college}_Students_${new Date().toISOString().slice(0, 10)}.xlsx`);
    addAuditLog({ userEmail: user.email, userName: user.name, action: 'export_excel', entityType: 'students', details: `Exported ${sorted.length} records (Excel) — ${college}` }).catch(() => {});
  };

  const exportZip = async () => {
    const sorted = (await getStudentsForExport({ college })).sort((a, b) => a.name.localeCompare(b.name));
    if (sorted.length === 0) { showToast('No student records to export.', 'error'); return; }
    setExportProgress(0);
    const [{ writeExcelBuffer }, JSZip] = await Promise.all([import('@/lib/utils/excel'), import('jszip').then(m => m.default)]);
    const zip = new JSZip();
    const photos = zip.folder('photos')!;
    const xlsxBuf = await writeExcelBuffer(sorted.map((s, i) => ({
      '#': i + 1, 'Photo': s.photo ? `${i + 1}.png` : '',
      Name: s.name, 'Father/Mother Name': s.parentage || '',
      'Student ID': s.studentId || '', 'Roll No.': s.rollNo || '',
      Class: s.studentClass || '', College: s.college,
      Course: s.course || '', Year: s.year || '', Email: s.email || '',
      Phone: s.phone, 'Date of Birth': s.dob || '', Percentage: s.percentage || '',
      'Blood Group': s.bloodGroup || '', Address: s.address || '',
      'Bus Stop': s.busStop || '', 'Added By': s.createdBy || 'Unknown',
      'Created At': formatISTDate(s.createdAt),
    })), 'Students');
    zip.file('students.xlsx', xlsxBuf);
    let photoCount = 0;
    sorted.forEach((s, i) => {
      if (!s.photo) return;
      photos.file(`${i + 1}.png`, s.photo.replace(/^data:image\/\w+;base64,/, ''), { base64: true });
      photoCount++;
    });
    const blob = await zip.generateAsync(
      { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
      ({ percent }) => setExportProgress(Math.round(percent))
    );
    setExportProgress(null);
    saveAs(blob, `${college}_export_${new Date().toISOString().slice(0, 10)}.zip`);
    showToast(`Exported ${sorted.length} students · ${photoCount} photo${photoCount !== 1 ? 's' : ''} in photos/ folder.`, 'success');
    addAuditLog({ userEmail: user.email, userName: user.name, action: 'export_zip', entityType: 'students', details: `Exported ${sorted.length} records, ${photoCount} photos (ZIP) — ${college}` }).catch(() => {});
  };

  const total        = strength            ?? (stats?.total ?? 0);
  const completed    = stats?.completed    ?? 0;
  const pending      = Math.max(0, total - completed);
  const missingPhoto = (stats?.total ?? 0) - (stats?.withPhoto ?? 0);
  const byFaculty    = stats?.byFaculty    ?? [];
  const maxCount     = byFaculty[0]?.count ?? 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 truncate">Dashboard</h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">{tableLoading ? 'Loading…' : `${total} students · ${college}`}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={async () => { setRefreshing(true); await fetchTable(); await fetchStats(); setRefreshing(false); }}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 bg-white border border-slate-200 rounded font-black text-sm text-slate-600 hover:bg-slate-50 transition shadow-sm active:scale-95 disabled:opacity-60"
          >
            <FiRefreshCw className={`w-4 h-4 shrink-0 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button onClick={exportZip} disabled={exportProgress !== null} className="relative flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 bg-slate-900 text-white rounded font-black text-sm hover:bg-violet-600 transition shadow-sm active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed overflow-hidden">
            {exportProgress !== null && (
              <span className="absolute inset-0 bg-violet-600" style={{ width: `${exportProgress}%`, transition: 'width 0.3s' }} />
            )}
            <FiArchive className="w-4 h-4 shrink-0 relative z-10" />
            <span className="hidden sm:inline relative z-10">{exportProgress !== null ? `${exportProgress}%` : 'Export ZIP'}</span>
            <span className="sm:hidden relative z-10">{exportProgress !== null ? `${exportProgress}%` : 'ZIP'}</span>
          </button>
          <button onClick={exportExcel} className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 bg-white border border-slate-200 rounded font-black text-sm text-slate-600 hover:bg-slate-50 transition shadow-sm active:scale-95">
            <FiDownload className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Excel</span>
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Strength',       value: total        },
          { label: 'Completed Profiles',      value: completed    },
          { label: 'Pending Profiles',        value: pending      },
          { label: 'Missing Photos', value: missingPhoto },
        ].map(card => (
          <div key={card.label} className="bg-white rounded border border-slate-200 shadow-sm p-4">
            <p className="text-[0.65rem] font-black uppercase tracking-widest text-slate-400 mb-1">{card.label}</p>
            <p className="text-2xl font-black text-slate-800">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Faculty Productivity */}
      {byFaculty.length > 0 && (
        <div className="bg-white rounded border border-slate-200 shadow-sm p-4">
          <p className="text-[0.65rem] font-black uppercase tracking-widest text-slate-400 mb-3">Faculty Productivity</p>
          <div className="space-y-2">
            {byFaculty.map(({ faculty: name, count }) => (
              <div key={name} className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-600 w-32 truncate shrink-0">{name}</span>
                <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${Math.round((count / maxCount) * 100)}%` }} />
                </div>
                <span className="text-xs font-black text-slate-500 w-8 text-right shrink-0">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search & Filter + Table */}
      <div className="bg-white rounded border border-slate-200 shadow-sm">
        <div className="px-4 lg:px-6 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Search by name, phone, roll no…"
            onChange={e => handleSearchChange(e.target.value)}
            className="flex-1 min-w-[160px] text-sm border border-slate-200 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-400 font-medium text-slate-700 placeholder:text-slate-300"
          />
          <select
            value={filterClass}
            onChange={e => { setFilterClass(e.target.value); setTablePage(1); }}
            className="text-sm border border-slate-200 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-400 font-medium text-slate-600 bg-white"
          >
            <option value="">All Classes</option>
            {allClasses.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={filterFaculty}
            onChange={e => { setFilterFaculty(e.target.value); setTablePage(1); }}
            className="text-sm border border-slate-200 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-400 font-medium text-slate-600 bg-white"
          >
            <option value="">All Faculty</option>
            {allFaculty.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          {(tableSearch || filterClass || filterFaculty) && (
            <button onClick={() => { setTableSearch(''); setFilterClass(''); setFilterFaculty(''); setTablePage(1); }} className="text-xs font-black text-slate-400 hover:text-slate-600 px-2 py-1.5 rounded hover:bg-slate-100 transition">Clear</button>
          )}
          <span className="ml-auto text-[0.65rem] font-black text-slate-400">{tableTotal} total</span>
          <div className="relative shrink-0" ref={colMenuRef}>
            <button
              onClick={() => setColMenuOpen(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-black transition ${colMenuOpen ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'}`}
              title="Show / hide columns"
            >
              <FiColumns className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Columns</span>
              <span className="sm:hidden">{visibleCols.size}</span>
            </button>
            {colMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-lg shadow-xl w-56 py-1.5 overflow-hidden">
                <p className="px-3 py-1.5 text-[0.58rem] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 mb-1">Visible Columns</p>
                <div className="max-h-72 overflow-y-auto">
                  {allCols.map(col => {
                    const isOn = visibleCols.has(col.key);
                    const locked = col.alwaysVisible;
                    return (
                      <button key={col.key} onClick={() => !locked && toggleCol(col.key)} disabled={locked}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition ${locked ? 'cursor-not-allowed opacity-50' : 'hover:bg-slate-50'}`}>
                        <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition ${isOn ? 'bg-violet-600 border-violet-600' : 'border-slate-300 bg-white'}`}>
                          {isOn && <FiCheck className="w-2.5 h-2.5 text-white" />}
                        </span>
                        <span className={`text-xs font-bold truncate ${isOn ? 'text-slate-900' : 'text-slate-400'}`}>
                          {col.label}{locked && <span className="ml-1 text-[0.55rem] text-slate-300">(always)</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="border-t border-slate-100 px-3 py-2 flex gap-2 mt-1">
                  <button onClick={() => setVisibleCols(new Set(allCols.filter(c => c.defaultVisible || c.alwaysVisible).map(c => c.key)))} className="flex-1 text-[0.65rem] font-black text-slate-500 hover:text-slate-900 transition">Reset</button>
                  <button onClick={() => setVisibleCols(new Set(allCols.map(c => c.key)))} className="flex-1 text-[0.65rem] font-black text-violet-600 hover:text-violet-800 transition">Show All</button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="p-3 sm:p-4 lg:p-6">
          <StudentTable
            students={tableStudents}
            loading={tableLoading}
            onDelete={handleDeleteStudent}
            onSave={handleSaveStudent}
            hideCollegeFilter
            hideSearch
            hideColumnsButton
            customFields={customFields}
            visibleCols={visibleCols}
            onVisibleColsChange={setVisibleCols}
            serverPagination={{
              total:            tableTotal,
              page:             tablePage,
              pageSize:         tablePageSize,
              onPageChange:     (p) => setTablePage(p),
              onPageSizeChange: (s) => { setTablePageSize(s); setTablePage(1); },
            }}
          />
        </div>
      </div>

      {/* Deleted Students */}
      <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowDeletedStudents(v => !v)}
          className="w-full flex items-center justify-between px-4 lg:px-6 py-3.5 hover:bg-slate-50 transition text-left"
        >
          <span className="flex items-center gap-2 text-sm font-black text-slate-500">
            <FiRotateCcw className="w-4 h-4" />
            Deleted Students
            {deletedStudents.length > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-600 text-[0.65rem] font-black">{deletedStudents.length}</span>
            )}
          </span>
          <FiChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showDeletedStudents ? 'rotate-180' : ''}`} />
        </button>
        {showDeletedStudents && (
          <div className="border-t border-slate-100">
            {deletedStudents.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-slate-400 font-bold">No deleted students.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border-separate border-spacing-0">
                  <thead className="bg-slate-50 text-slate-400 text-[0.6rem] font-black uppercase tracking-widest">
                    <tr>
                      <th className="px-4 lg:px-6 py-3 text-left">Student</th>
                      <th className="px-4 lg:px-6 py-3 text-left hidden sm:table-cell">Course</th>
                      <th className="px-4 lg:px-6 py-3 text-left hidden md:table-cell">Deleted By</th>
                      <th className="px-4 lg:px-6 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {deletedStudents.map(s => (
                      <tr key={s.id} className="bg-rose-50/20">
                        <td className="px-4 lg:px-6 py-3">
                          <p className="font-bold text-slate-400 text-sm">{s.name}</p>
                          <p className="text-[0.65rem] text-slate-300">{s.studentId}</p>
                        </td>
                        <td className="px-4 lg:px-6 py-3 hidden sm:table-cell">
                          <p className="text-sm text-slate-400 font-medium">{s.course}</p>
                        </td>
                        <td className="px-4 lg:px-6 py-3 hidden md:table-cell">
                          <p className="text-sm text-slate-400 font-medium">{s.deletedBy ?? '—'}</p>
                        </td>
                        <td className="px-4 lg:px-6 py-3 text-right">
                          <button
                            onClick={() => handleRestoreStudent(s.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-black text-emerald-600 bg-emerald-50 hover:bg-emerald-500 hover:text-white border border-emerald-100 transition ml-auto"
                          >
                            <FiRotateCcw className="w-3 h-3" /> Restore
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDialog !== null}
        title={confirmDialog?.title ?? ''}
        message={confirmDialog?.message ?? ''}
        onConfirm={() => confirmDialog?.onConfirm()}
        onCancel={() => setConfirmDialog(null)}
      />

      {toast && (
        <div className={`fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-lg shadow-2xl flex items-center gap-2.5 font-black text-sm border-2 max-w-[calc(100vw-2rem)] ${
          toast.type === 'success' ? 'bg-emerald-500/90 text-white border-emerald-400/50' : 'bg-rose-500/90 text-white border-rose-400/50'
        }`}>
          <span className="shrink-0">{toast.type === 'success' ? '✅' : '⚠️'}</span>
          <span className="truncate">{toast.text}</span>
        </div>
      )}
    </div>
  );
}
