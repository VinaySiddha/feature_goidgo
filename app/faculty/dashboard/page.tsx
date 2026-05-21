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
import { getCustomFields, getCustomValuesForStudents } from '@/lib/services/custom-fields.service';
import {
  FiDownload, FiRefreshCw, FiArchive,
  FiRotateCcw, FiChevronDown, FiColumns, FiCheck,
} from 'react-icons/fi';
import { formatISTDate } from '@/lib/formatDate';

export default function FacultyDashboardPage() {
  const { user, colleges } = useAuth();

  // ── Table state ──
  const [tableStudents,  setTableStudents]  = useState<StudentRecord[]>([]);
  const [tableTotal,     setTableTotal]     = useState(0);
  const [tablePage,      setTablePage]      = useState(1);
  const [tablePageSize,  setTablePageSize]  = useState(5);
  const [tableSearch,    setTableSearch]    = useState('');
  const [tableLoading,   setTableLoading]   = useState(false);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Stats ──
  const [stats,    setStats]    = useState<StudentStats | null>(null);
  const [strength, setStrength] = useState<number | null>(null);

  // ── Other ──
  const [deletedStudents,      setDeletedStudents]      = useState<StudentRecord[]>([]);
  const [showDeletedStudents,  setShowDeletedStudents]  = useState(false);
  const [notice,               setNotice]               = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [exportProgress,       setExportProgress]       = useState<number | null>(null);
  const [refreshing,           setRefreshing]           = useState(false);

  const [customFields, setCustomFields] = useState<CustomField[]>([]);

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

  const createdBy = user?.name || user?.email || '';
  const college   = user?.college ?? '';

  // fetch table page
  const fetchTable = useCallback(async () => {
    if (!createdBy) return;
    setTableLoading(true);
    const { students, total } = await getStudentsPaginated({
      college:   college || undefined,
      createdBy,
      search:    tableSearch || undefined,
      page:      tablePage,
      limit:     tablePageSize,
    });
    setTableStudents(students);
    setTableTotal(total);
    setTableLoading(false);
  }, [createdBy, college, tableSearch, tablePage, tablePageSize]);

  useEffect(() => { fetchTable(); }, [fetchTable]);

  // fetch stats once on mount / when user changes
  const fetchStats = useCallback(async () => {
    if (!createdBy) return;
    const [s, assets] = await Promise.all([
      getStudentCountStats({ college: college || undefined, createdBy }),
      college ? getCollegeAssets(college) : Promise.resolve(null),
    ]);
    setStats(s);
    setStrength(assets?.studentCount ?? null);
  }, [createdBy, college]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  useEffect(() => {
    if (college) getCustomFields(college).then(setCustomFields).catch(() => {});
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
    const result = await deleteStudentFromDb(id, user.name || user.email);
    if (result.success) {
      setTableStudents(prev => prev.filter(s => s.id !== id));
      setTableTotal(prev => prev - 1);
      fetchStats();
    }
  };

  const handleSaveStudent = async (updated: StudentRecord) => {
    const result = await updateStudentInDb(updated);
    if (result.success) setTableStudents(prev => prev.map(s => s.id === updated.id ? updated : s));
  };

  const handleRestoreStudent = async (id: string) => {
    const result = await restoreStudentInDb(id);
    if (result.success) {
      setDeletedStudents(prev => prev.filter(s => s.id !== id));
      fetchTable();
      fetchStats();
    }
  };

  const buildExportRows = async (sorted: StudentRecord[]) => {
    const show = (key: string) => visibleCols.has(key);
    const visibleCfCols = allCols.filter(c => c.key.startsWith('cf_') && show(c.key));
    let cfValMap = new Map<string, { custom_field_id: number; value: string | null }[]>();
    if (visibleCfCols.length > 0) {
      cfValMap = await getCustomValuesForStudents(sorted.map(s => s.id));
    }
    return sorted.map((s, i) => {
      const row: Record<string, string | number> = { '#': i + 1 };
      if (show('photo'))        row['Photo']              = s.photo ? `${i + 1}.png` : '';
      if (show('name'))         row['Name']               = s.name;
      if (show('parentage'))    row['Father/Mother Name'] = s.parentage || '';
      if (show('phone'))        row['Phone']              = s.phone;
      if (show('rollNo'))       row['Roll No.']           = s.rollNo || '';
      if (show('studentClass')) row['Class']              = s.studentClass || '';
      if (show('bloodGroup'))   row['Blood Group']        = s.bloodGroup || '';
      if (show('address'))      row['Address']            = s.address || '';
      if (show('busStop'))      row['Bus Stop']           = s.busStop || '';
      if (show('college'))      row['College']            = s.college;
      if (show('createdBy'))    row['Added By']           = s.createdBy || '';
      if (show('createdAt'))    row['Created At']         = formatISTDate(s.createdAt);
      for (const col of visibleCfCols) {
        const cfId = Number(col.key.replace('cf_', ''));
        const entry = cfValMap.get(s.id)?.find(v => v.custom_field_id === cfId);
        row[col.label] = entry?.value || '';
      }
      return row;
    });
  };

  const exportExcel = async () => {
    const sorted = (await getStudentsForExport({ college: college || undefined, createdBy }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const rows = await buildExportRows(sorted);
    const { writeExcelFile } = await import('@/lib/utils/excel');
    await writeExcelFile(rows, 'Students', `student-records-${new Date().toISOString().slice(0, 10)}.xlsx`);
    addAuditLog({ userEmail: user.email, userName: user.name, action: 'export_excel', entityType: 'students', details: `Exported ${sorted.length} records (Excel)` }).catch(() => {});
  };

  const exportZip = async () => {
    const sorted = (await getStudentsForExport({ college: college || undefined, createdBy }))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (sorted.length === 0) { setNotice({ message: 'No student records to export.', type: 'error' }); return; }
    setExportProgress(0);
    const rows = await buildExportRows(sorted);
    const [{ writeExcelBuffer }, JSZip] = await Promise.all([import('@/lib/utils/excel'), import('jszip').then(m => m.default)]);
    const zip = new JSZip();
    const photos = zip.folder('photos')!;
    const xlsxBuf = await writeExcelBuffer(rows, 'Students');
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
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `students-export-${new Date().toISOString().slice(0, 10)}.zip`; a.click(); URL.revokeObjectURL(url);
    setNotice({ message: `Exported ${sorted.length} students · ${photoCount} photo${photoCount !== 1 ? 's' : ''}.`, type: 'success' });
    setTimeout(() => setNotice(null), 5000);
    addAuditLog({ userEmail: user.email, userName: user.name, action: 'export_zip', entityType: 'students', details: `Exported ${sorted.length} records, ${photoCount} photos (ZIP)` }).catch(() => {});
  };

  const total        = strength            ?? (stats?.total ?? 0);
  const completed    = stats?.completed    ?? 0;
  const pending      = Math.max(0, total - completed);
  const missingPhoto = (stats?.total ?? 0) - (stats?.withPhoto ?? 0);

  return (
    <div id="faculty-registry-section" className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 truncate">Dashboard</h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">{tableTotal} students in registry</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={async () => { setRefreshing(true); await fetchTable(); await fetchStats(); setRefreshing(false); }}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded font-black text-sm text-slate-600 hover:bg-slate-50 transition shadow-sm active:scale-95 disabled:opacity-60"
          >
            <FiRefreshCw className={`w-4 h-4 shrink-0 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button onClick={exportZip} disabled={exportProgress !== null} className="relative flex items-center gap-2 px-3 py-2 bg-slate-900 text-white rounded font-black text-sm hover:bg-blue-700 transition shadow-sm active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed overflow-hidden">
            {exportProgress !== null && (
              <span className="absolute inset-0 bg-blue-600" style={{ width: `${exportProgress}%`, transition: 'width 0.3s' }} />
            )}
            <FiArchive className="w-4 h-4 shrink-0 relative z-10" />
            <span className="hidden xs:inline relative z-10">{exportProgress !== null ? `${exportProgress}%` : 'ZIP'}</span>
          </button>
          <button onClick={exportExcel} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded font-black text-sm text-slate-600 hover:bg-slate-50 transition shadow-sm active:scale-95">
            <FiDownload className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Excel</span>
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Strength',        value: total,        icon: '👥', color: 'bg-blue-50 border-blue-100',       num: 'text-blue-700',    sub: 'text-blue-400' },
          { label: 'Completed Profiles',       value: completed,    icon: '✅', color: 'bg-emerald-50 border-emerald-100', num: 'text-emerald-700', sub: 'text-emerald-400' },
          { label: 'Pending Profiles',         value: pending,      icon: '⏳', color: 'bg-amber-50 border-amber-100',     num: 'text-amber-700',   sub: 'text-amber-400' },
          { label: 'Missing Photos',  value: missingPhoto, icon: '📷', color: 'bg-rose-50 border-rose-100',       num: 'text-rose-700',    sub: 'text-rose-400' },
        ].map(({ label, value, icon, color, num, sub }) => (
          <div key={label} className={`rounded-lg border p-4 ${color}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className={`text-[0.65rem] font-black uppercase tracking-widest ${sub}`}>{label}</p>
                <p className={`text-3xl font-black mt-1 ${num}`}>{value}</p>
              </div>
              <span className="text-xl">{icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Student Table */}
      <div className="bg-white rounded border border-slate-200 shadow-sm">
        <div className="px-4 lg:px-6 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Search by name, phone, roll no…"
            onChange={e => handleSearchChange(e.target.value)}
            className="flex-1 min-w-[160px] text-sm border border-slate-200 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 font-medium text-slate-700 placeholder:text-slate-300"
          />
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
                        <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition ${isOn ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'}`}>
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
                  <button onClick={() => setVisibleCols(new Set(allCols.map(c => c.key)))} className="flex-1 text-[0.65rem] font-black text-blue-600 hover:text-blue-800 transition">Show All</button>
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
            colleges={colleges}
            hideCollegeFilter
            hideSearch
            hideColumnsButton
            customFields={customFields}
            visibleCols={visibleCols}
            onVisibleColsChange={setVisibleCols}
            onSearchChange={handleSearchChange}
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

      {notice && (
        <div className={`fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-lg shadow-2xl flex items-center gap-2.5 font-black text-sm border-2 max-w-[calc(100vw-2rem)] ${notice.type === 'success' ? 'bg-emerald-500/90 text-white border-emerald-400/50' : 'bg-rose-500/90 text-white border-rose-400/50'}`}>
          <span className="truncate">{notice.message}</span>
        </div>
      )}
    </div>
  );
}
