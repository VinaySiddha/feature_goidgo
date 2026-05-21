'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';
import StudentTable from '@/components/StudentTable';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  FiDownload, FiArchive, FiRefreshCw, FiRotateCcw, FiChevronDown,
} from 'react-icons/fi';
import {
  getStudentsPaginated, getStudentsForExport, getStudentCountStats,
  getDeletedStudents, restoreStudentInDb,
  deleteStudentFromDb, updateStudentInDb,
} from '@/lib/services/student.service';
import { getAuditLogs } from '@/lib/services/audit.service';
import { getCollegeAssets } from '@/lib/services/college-assets.service';
import TableSkeleton from '@/components/TableSkeleton';
import { formatISTDate } from '@/lib/formatDate';
import { AuditLog, StudentRecord, StudentStats, CustomField } from '@/lib/types';
import { getCustomFields, getCustomValuesForStudents } from '@/lib/services/custom-fields.service';
import { CORE_COLS, ColDef } from '@/components/StudentTable';

export default function AdminDashboardPage() {
  const { user, colleges } = useAuth();

  // ── Single college selector (drives stats + table) ──
  const [selectedCollege, setSelectedCollege] = useState<string>('');
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  useEffect(() => {
    if (selectedCollege) getCustomFields(selectedCollege).then(setCustomFields).catch(() => {});
  }, [selectedCollege]);

  const allCols = useMemo<ColDef[]>(() => [
    ...CORE_COLS,
    ...customFields.map(cf => ({ key: `cf_${cf.id}`, label: cf.label, defaultVisible: false })),
  ], [customFields]);

  const [visibleCols, setVisibleCols] = useState<Set<string>>(
    () => new Set(CORE_COLS.filter(c => c.defaultVisible).map(c => c.key))
  );

  // ── Table state ──
  const [tableStudents,  setTableStudents]  = useState<StudentRecord[]>([]);
  const [tableTotal,     setTableTotal]     = useState(0);
  const [tablePage,      setTablePage]      = useState(1);
  const [tablePageSize,  setTablePageSize]  = useState(5);
  const [tableSearch,    setTableSearch]    = useState('');
  const [tableLoading,   setTableLoading]   = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Stats state ──
  const [stats,      setStats]      = useState<StudentStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [strength,   setStrength]   = useState<number | null>(null);

  // ── Other ──
  const [refreshing,          setRefreshing]          = useState(false);
  const [deletedStudents,     setDeletedStudents]     = useState<StudentRecord[]>([]);
  const [deletedLoading,      setDeletedLoading]      = useState(false);
  const [showDeletedStudents, setShowDeletedStudents] = useState(false);
  const [auditLogs,           setAuditLogs]           = useState<AuditLog[]>([]);
  const [logsLoading,         setLogsLoading]         = useState(false);
  const [logsFetched,         setLogsFetched]         = useState(false);
  const [message,             setMessage]             = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  // Set default college when colleges load
  useEffect(() => {
    if (colleges.length > 0 && !selectedCollege) setSelectedCollege(colleges[0]);
  }, [colleges, selectedCollege]);

  // Fetch table data
  const fetchTable = useCallback(async () => {
    if (!selectedCollege) return;
    setTableLoading(true);
    const { students, total } = await getStudentsPaginated({
      college: selectedCollege,
      search:  tableSearch || undefined,
      page:    tablePage,
      limit:   tablePageSize,
    });
    setTableStudents(students);
    setTableTotal(total);
    setTableLoading(false);
  }, [selectedCollege, tableSearch, tablePage, tablePageSize]);

  useEffect(() => { fetchTable(); }, [fetchTable]);

  // Fetch stats + strength together
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    const [s, assets] = await Promise.all([
      getStudentCountStats({ college: selectedCollege || undefined }),
      selectedCollege ? getCollegeAssets(selectedCollege) : Promise.resolve(null),
    ]);
    setStats(s);
    setStrength(assets?.studentCount ?? null);
    setStatsLoading(false);
  }, [selectedCollege]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Audit logs (once)
  useEffect(() => {
    if (!user?.email || logsFetched) return;
    setLogsFetched(true);
    setLogsLoading(true);
    getAuditLogs()
      .then(a => { setAuditLogs(a); setLogsLoading(false); })
      .catch(() => setLogsLoading(false));
  }, [user?.email, logsFetched]);

  const handleCollegeChange = (college: string) => {
    setSelectedCollege(college);
    setTablePage(1);
    setTableSearch('');
    setSearchInput('');
  };

  const handleSearchChange = (term: string) => {
    setSearchInput(term);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setTableSearch(term);
      setTablePage(1);
    }, 300);
  };

  const handleDeleteStudent = async (id: string) => {
    const result = await deleteStudentFromDb(id, user?.name || user?.email);
    if (result.success) {
      setTableStudents(prev => prev.filter(s => s.id !== id));
      setTableTotal(prev => prev - 1);
      fetchStats();
    }
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

  const exportZip = async () => {
    setMessage({ text: 'Preparing export…', type: 'success' });
    const exportList = await getStudentsForExport({ college: selectedCollege || undefined });
    if (exportList.length === 0) { setMessage({ text: 'No student records to export.', type: 'error' }); return; }
    const sorted = [...exportList].sort((a, b) => a.name.localeCompare(b.name));
    const rows = await buildExportRows(sorted);
    const [{ writeExcelBuffer }, JSZip] = await Promise.all([import('@/lib/utils/excel'), import('jszip').then(m => m.default)]);
    const zip = new JSZip();
    const photos = zip.folder('photos')!;
    zip.file('students.xlsx', await writeExcelBuffer(rows, 'Students'));
    let photoCount = 0;
    sorted.forEach((s, i) => {
      if (!s.photo) return;
      photos.file(`${i + 1}.png`, s.photo.replace(/^data:image\/\w+;base64,/, ''), { base64: true });
      photoCount++;
    });
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${selectedCollege || 'export'}-${new Date().toISOString().slice(0, 10)}.zip`; a.click();
    URL.revokeObjectURL(url);
    setMessage({ text: `Exported ${sorted.length} students · ${photoCount} photo${photoCount !== 1 ? 's' : ''} in photos/ folder.`, type: 'success' });
    setTimeout(() => setMessage(null), 5000);
  };

  const exportExcel = async () => {
    const exportList = await getStudentsForExport({ college: selectedCollege || undefined });
    const sorted = [...exportList].sort((a, b) => a.name.localeCompare(b.name));
    const rows = await buildExportRows(sorted);
    const { writeExcelFile } = await import('@/lib/utils/excel');
    await writeExcelFile(rows, 'Students', `${selectedCollege || 'Admin'}_Students_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (!user) return null;

  const total        = strength            ?? (stats?.total ?? 0);
  const completed    = stats?.completed    ?? 0;
  const missingPhoto = (stats?.total ?? 0) - (stats?.withPhoto ?? 0);
  const pending      = Math.max(0, total - completed);

  const byCollege = stats?.byCollege ?? [];
  const byFaculty = stats?.byFaculty ?? [];
  const downloads = auditLogs.filter(l => l.action.startsWith('export_')).slice(0, 6);
  const dataLoaded = stats !== null;

  return (
    <div className="space-y-4">

      {/* Header row with title + college picker + actions */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 truncate">Dashboard</h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">{tableTotal} students in registry</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Single college selector */}
          {colleges.length > 1 && (
            <div className="relative">
              <select
                value={selectedCollege}
                onChange={e => handleCollegeChange(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm font-black outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-400/10 transition cursor-pointer"
              >
                {colleges.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <FiChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>
          )}
          {strength !== null && (
            <span className="text-xs font-bold text-violet-600 bg-violet-50 border border-violet-100 px-3 py-1.5 rounded-lg">
              Strength: {strength.toLocaleString()}
            </span>
          )}
          <button
            onClick={async () => { setRefreshing(true); await fetchTable(); await fetchStats(); setRefreshing(false); }}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 bg-white border border-slate-200 rounded font-black text-sm text-slate-600 hover:bg-slate-50 transition shadow-sm active:scale-95 disabled:opacity-60"
          >
            <FiRefreshCw className={`w-4 h-4 shrink-0 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={exportZip}
            className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 bg-slate-900 text-white rounded font-black text-sm hover:bg-green-700 transition shadow-sm active:scale-95"
          >
            <FiArchive className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Export ZIP</span>
            <span className="sm:hidden">ZIP</span>
          </button>
          <button onClick={exportExcel} className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 bg-white border border-slate-200 rounded font-black text-sm text-slate-600 hover:bg-slate-50 transition shadow-sm active:scale-95">
            <FiDownload className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Excel</span>
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      {!dataLoaded || statsLoading ? (
        <div className="space-y-4 animate-pulse">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 p-4 space-y-3">
                <div className="h-2.5 bg-slate-200 rounded w-1/2" />
                <div className="h-8 bg-slate-200 rounded w-1/3" />
                <div className="h-2 bg-slate-100 rounded w-1/4" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                  <div className="h-3 bg-slate-200 rounded w-24" />
                </div>
                <TableSkeleton rows={4} cols={3} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Strength',       value: total,        icon: '👥', color: 'bg-blue-50 border-blue-100',       num: 'text-blue-700',    sub: 'text-blue-400',    denom: total    },
              { label: 'Completed',      value: completed,    icon: '✅', color: 'bg-emerald-50 border-emerald-100', num: 'text-emerald-700', sub: 'text-emerald-400', denom: total    },
              { label: 'Pending',        value: pending,      icon: '⏳', color: 'bg-amber-50 border-amber-100',     num: 'text-amber-700',   sub: 'text-amber-400',   denom: total    },
              { label: 'Missing Photos', value: missingPhoto, icon: '📷', color: 'bg-rose-50 border-rose-100',       num: 'text-rose-700',    sub: 'text-rose-400',    denom: stats?.total ?? 0 },
            ].map(({ label, value, icon, color, num, sub, denom }) => (
              <div key={label} className={`rounded-lg border p-4 ${color}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className={`text-[0.65rem] font-black uppercase tracking-widest ${sub}`}>{label}</p>
                    <p className={`text-3xl font-black mt-1 ${num}`}>{value}</p>
                    {denom > 0 && <p className={`text-[0.65rem] font-bold mt-1 ${sub}`}>{Math.round(value / denom * 100)}% of {label === 'Missing Photos' ? 'enrolled' : 'strength'}</p>}
                  </div>
                  <span className="text-xl">{icon}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* School-wise */}
            <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <span className="text-base">🏫</span>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">School-wise Report</h3>
              </div>
              <div className="divide-y divide-slate-50 max-h-48 overflow-y-auto">
                {byCollege.length === 0 ? (
                  <p className="px-4 py-6 text-xs text-slate-400 text-center font-bold">No data yet.</p>
                ) : byCollege.map(({ college, total: ct, withPhoto: wp, pending: pend }) => (
                  <div key={college} className="px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-slate-50/60">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-700 truncate">{college}</p>
                      <p className="text-[0.6rem] text-slate-400 font-medium">{wp} photos · {pend} pending</p>
                    </div>
                    <span className="text-sm font-black text-slate-900 shrink-0">{ct}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Faculty productivity */}
            <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <span className="text-base">👩‍🏫</span>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Faculty Productivity</h3>
              </div>
              <div className="divide-y divide-slate-50 max-h-48 overflow-y-auto">
                {byFaculty.length === 0 ? (
                  <p className="px-4 py-6 text-xs text-slate-400 text-center font-bold">No entries yet.</p>
                ) : byFaculty.map(({ faculty: name, count }, i) => (
                  <div key={name} className="px-4 py-2.5 flex items-center gap-3">
                    <span className={`w-5 h-5 rounded text-[0.6rem] font-black flex items-center justify-center shrink-0 ${i === 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>{i + 1}</span>
                    <p className="text-xs font-bold text-slate-700 truncate flex-1">{name}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="h-1.5 w-16 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.round(count / (byFaculty[0]?.count || 1) * 100)}%` }} />
                      </div>
                      <span className="text-xs font-black text-slate-600">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Download history */}
            <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <span className="text-base">📥</span>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Download History</h3>
              </div>
              <div className="divide-y divide-slate-50 max-h-48 overflow-y-auto">
                {logsLoading ? <TableSkeleton rows={3} cols={2} /> : downloads.length === 0 ? (
                  <p className="px-4 py-6 text-xs text-slate-400 text-center font-bold">No downloads yet.</p>
                ) : downloads.map(log => (
                  <div key={log.id} className="px-4 py-2.5 flex items-start gap-2">
                    <span className="text-sm mt-0.5">{log.action === 'export_zip' ? '🗜️' : log.action === 'export_excel' ? '📊' : '📄'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-700 truncate">{log.userName || log.userEmail}</p>
                      <p className="text-[0.6rem] text-slate-400 font-medium">{log.action.replace('export_', '').toUpperCase()} · {new Date(log.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Student Table */}
      <div className="bg-white rounded border border-slate-200 shadow-sm p-3 sm:p-4 lg:p-6">
        <StudentTable
          students={tableStudents}
          loading={tableLoading}
          onDelete={handleDeleteStudent}
          onSave={async (updated) => { const r = await updateStudentInDb(updated); if (r.success) setTableStudents(prev => prev.map(s => s.id === updated.id ? updated : s)); }}
          colleges={colleges}
          hideCollegeFilter
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

      {/* Deleted Students */}
      <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
        <button
          onClick={() => {
            setShowDeletedStudents(v => !v);
            if (deletedStudents.length === 0 && !deletedLoading) {
              setDeletedLoading(true);
              getDeletedStudents().then(d => { setDeletedStudents(d); setDeletedLoading(false); }).catch(() => setDeletedLoading(false));
            }
          }}
          className="w-full flex items-center justify-between px-4 lg:px-6 py-3.5 hover:bg-slate-50 transition text-left"
        >
          <span className="flex items-center gap-2 text-sm font-black text-slate-500">
            <FiRotateCcw className="w-4 h-4" />
            Deleted Students
            {(() => { const c = (selectedCollege ? deletedStudents.filter(s => s.college === selectedCollege) : deletedStudents).length; return c > 0 && <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-600 text-[0.65rem] font-black">{c}</span>; })()}
          </span>
          <FiChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showDeletedStudents ? 'rotate-180' : ''}`} />
        </button>
        {showDeletedStudents && (
          <div className="border-t border-slate-100">
            {deletedLoading ? <TableSkeleton rows={3} cols={4} /> : (() => {
              const filtered = selectedCollege ? deletedStudents.filter(s => s.college === selectedCollege) : deletedStudents;
              return filtered.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-slate-400 font-bold">No deleted students{selectedCollege ? ` for ${selectedCollege}` : ''}.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm border-separate border-spacing-0">
                    <thead className="bg-slate-50 text-slate-400 text-[0.6rem] font-black uppercase tracking-widest">
                      <tr>
                        <th className="px-4 lg:px-6 py-3 text-left">Student</th>
                        <th className="px-4 lg:px-6 py-3 text-left hidden sm:table-cell">College</th>
                        <th className="px-4 lg:px-6 py-3 text-left hidden md:table-cell">Course</th>
                        <th className="px-4 lg:px-6 py-3 text-left hidden lg:table-cell">Deleted By</th>
                        <th className="px-4 lg:px-6 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filtered.map(s => (
                        <tr key={s.id} className="bg-rose-50/20">
                          <td className="px-4 lg:px-6 py-3">
                            <p className="font-bold text-slate-400 text-sm">{s.name}</p>
                            <p className="text-[0.65rem] text-slate-300">{s.studentId}</p>
                          </td>
                          <td className="px-4 lg:px-6 py-3 hidden sm:table-cell"><p className="text-sm text-slate-400 font-medium">{s.college}</p></td>
                          <td className="px-4 lg:px-6 py-3 hidden md:table-cell"><p className="text-sm text-slate-400 font-medium">{s.course}</p></td>
                          <td className="px-4 lg:px-6 py-3 hidden lg:table-cell"><p className="text-sm text-slate-400 font-medium">{s.deletedBy ?? '—'}</p></td>
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
              );
            })()}
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

      {message && (
        <div className={`fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-lg shadow-2xl flex items-center gap-2.5 font-black text-sm border-2 max-w-[calc(100vw-2rem)] ${message.type === 'success' ? 'bg-emerald-500/90 text-white border-emerald-400/50' : 'bg-rose-500/90 text-white border-rose-400/50'}`}>
          <span className="shrink-0">{message.type === 'success' ? '✅' : '⚠️'}</span>
          <span className="truncate">{message.text}</span>
        </div>
      )}
    </div>
  );
}
