'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  FiMapPin, FiPlus, FiTrash2, FiSearch, FiChevronLeft, FiChevronRight,
  FiRotateCcw, FiChevronDown, FiX, FiEye, FiUsers, FiImage, FiEdit3, FiCreditCard, FiTag, FiDownload,
} from 'react-icons/fi';
import { getDeletedColleges, restoreCollegeFromDb } from '@/lib/services/college.service';
import { getCollegeAssets } from '@/lib/services/college-assets.service';
import TableSkeleton from '@/components/TableSkeleton';
import { useEffect } from 'react';

interface InstituteAssets {
  logo: string | null;
  signature: string | null;
  studentCount: number | null;
  idCardTypeName: string | null;
  lanyard: 'Printed' | 'Not printed' | 'Not needed' | null;
}

function InstitutePreviewModal({
  college,
  onClose,
}: {
  college: string;
  onClose: () => void;
}) {
  const [assets, setAssets] = useState<InstituteAssets | null>(null);
  const [loading, setLoading] = useState(true);

  const downloadDataUrl = (dataUrl: string, label: string) => {
    const ext = dataUrl.split(';')[0].split('/')[1] ?? 'png';
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${college.replace(/\s+/g, '_')}_${label}.${ext}`;
    a.click();
  };

  useEffect(() => {
    getCollegeAssets(college).then(a => { setAssets(a); setLoading(false); });
  }, [college]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-green-50 border border-green-100 flex items-center justify-center shrink-0">
              <FiMapPin className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-900">{college}</p>
              <p className="text-[0.65rem] text-slate-400 font-medium">Institute Assets Preview</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {loading ? (
            <div className="space-y-4 animate-pulse">
              <div className="grid grid-cols-2 gap-4">
                <div className="h-36 bg-slate-100 rounded-lg" />
                <div className="h-36 bg-slate-100 rounded-lg" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="h-16 bg-slate-100 rounded-lg" />
                <div className="h-16 bg-slate-100 rounded-lg" />
                <div className="h-16 bg-slate-100 rounded-lg" />
              </div>
            </div>
          ) : (
            <>
              {/* Logo + Signature side by side */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <FiImage className="w-3.5 h-3.5 text-violet-500" />
                      <span className="text-xs font-black text-slate-700">College Logo</span>
                    </div>
                    {assets?.logo && (
                      <button onClick={() => downloadDataUrl(assets.logo!, 'logo')} className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition" title="Download logo">
                        <FiDownload className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {assets?.logo ? (
                    <div className="flex items-center justify-center h-32 bg-white p-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={assets.logo} alt="Institute Logo" className="max-h-full max-w-full object-contain" />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-32 gap-2 text-slate-300 bg-slate-50/50">
                      <FiImage className="w-7 h-7" />
                      <p className="text-xs font-bold">No logo uploaded</p>
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <FiEdit3 className="w-3.5 h-3.5 text-violet-500" />
                      <span className="text-xs font-black text-slate-700">Principal Signature</span>
                    </div>
                    {assets?.signature && (
                      <button onClick={() => downloadDataUrl(assets.signature!, 'signature')} className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition" title="Download signature">
                        <FiDownload className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {assets?.signature ? (
                    <div className="flex items-center justify-center h-32 bg-white p-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={assets.signature} alt="Principal Signature" className="max-h-full max-w-full object-contain" />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-32 gap-2 text-slate-300 bg-slate-50/50">
                      <FiEdit3 className="w-7 h-7" />
                      <p className="text-xs font-bold">No signature uploaded</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Info row: strength · ID card · lanyard */}
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1 px-3 py-3 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="flex items-center gap-1.5">
                    <FiUsers className="w-3.5 h-3.5 text-violet-500" />
                    <p className="text-[0.65rem] font-black text-slate-500 uppercase tracking-wide">Strength</p>
                  </div>
                  {assets?.studentCount != null ? (
                    <p className="text-sm font-black text-slate-900">{assets.studentCount.toLocaleString()} <span className="text-xs font-medium text-slate-400">students</span></p>
                  ) : (
                    <p className="text-xs font-bold text-slate-400">Not set</p>
                  )}
                </div>

                <div className="flex flex-col gap-1 px-3 py-3 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="flex items-center gap-1.5">
                    <FiCreditCard className="w-3.5 h-3.5 text-blue-500" />
                    <p className="text-[0.65rem] font-black text-slate-500 uppercase tracking-wide">ID Card</p>
                  </div>
                  {assets?.idCardTypeName != null ? (
                    <p className="text-sm font-black text-slate-900">{assets.idCardTypeName}</p>
                  ) : (
                    <p className="text-xs font-bold text-slate-400">Not set</p>
                  )}
                </div>

                <div className="flex flex-col gap-1 px-3 py-3 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="flex items-center gap-1.5">
                    <FiTag className="w-3.5 h-3.5 text-amber-500" />
                    <p className="text-[0.65rem] font-black text-slate-500 uppercase tracking-wide">Lanyard</p>
                  </div>
                  {assets?.lanyard != null ? (
                    <p className="text-sm font-black text-slate-900">{assets.lanyard}</p>
                  ) : (
                    <p className="text-xs font-bold text-slate-400">Not set</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminInstitutesPage() {
  const { user, dataLoaded, colleges, addCollege, removeCollege, refreshColleges } = useAuth();

  const [newCollege,          setNewCollege]          = useState('');
  const [message,             setMessage]             = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [instituteFormOpen,   setInstituteFormOpen]   = useState(false);
  const [collegeSearch,       setCollegeSearch]       = useState('');
  const [collegePage,         setCollegePage]         = useState(1);
  const [collegeRowsPerPage,  setCollegeRowsPerPage]  = useState(10);
  const [deletedColleges,     setDeletedColleges]     = useState<{ name: string; deletedBy: string | null }[]>([]);
  const [showDeletedColleges, setShowDeletedColleges] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [previewCollege, setPreviewCollege] = useState<string | null>(null);
  const [collegeAssetsMap, setCollegeAssetsMap] = useState<Record<string, { idCardTypeName: string | null; lanyard: string | null; studentCount: number | null }>>({});

  useEffect(() => {
    if (!user?.email) return;
    getDeletedColleges().then(setDeletedColleges).catch(() => {});
  }, [user?.email]);

  useEffect(() => {
    if (!colleges.length) return;
    Promise.all(
      colleges.map(college =>
        getCollegeAssets(college).then(a => ({ college, idCardTypeName: a.idCardTypeName, lanyard: a.lanyard, studentCount: a.studentCount ?? null }))
      )
    ).then(results => {
      const map: Record<string, { idCardTypeName: string | null; lanyard: string | null; studentCount: number | null }> = {};
      results.forEach(r => { map[r.college] = { idCardTypeName: r.idCardTypeName, lanyard: r.lanyard, studentCount: r.studentCount }; });
      setCollegeAssetsMap(map);
    }).catch(() => {});
  }, [colleges]);

  const filteredColleges  = colleges.filter(c => c.toLowerCase().includes(collegeSearch.toLowerCase()));
  const totalCollegePages = Math.max(1, Math.ceil(filteredColleges.length / collegeRowsPerPage));
  const safeCollegePage   = Math.min(collegePage, totalCollegePages);
  const paginatedColleges = filteredColleges.slice((safeCollegePage - 1) * collegeRowsPerPage, safeCollegePage * collegeRowsPerPage);

  const handleAddCollege = async () => {
    const result = await addCollege(newCollege);
    setMessage({ text: result.message, type: result.success ? 'success' : 'error' });
    if (result.success) { setNewCollege(''); setTimeout(() => setMessage(null), 3000); }
  };

  const handleRemoveCollege = (college: string) => {
    setConfirmDialog({
      title: 'Remove Institute',
      message: `"${college}" will be soft-deleted. It can be restored later and its name can be reused.`,
      onConfirm: async () => {
        const result = await removeCollege(college);
        setMessage({ text: result.message, type: result.success ? 'success' : 'error' });
        if (result.success) {
          const deletedBy = user?.name || user?.email || null;
          setDeletedColleges(prev => [...prev, { name: college, deletedBy }].sort((a, b) => a.name.localeCompare(b.name)));
          setTimeout(() => setMessage(null), 3000);
        }
        setConfirmDialog(null);
      },
    });
  };

  const handleRestoreCollege = async (name: string) => {
    const result = await restoreCollegeFromDb(name);
    setMessage({ text: result.message, type: result.success ? 'success' : 'error' });
    if (result.success) {
      setDeletedColleges(prev => prev.filter(c => c.name !== name));
      await refreshColleges();
      setTimeout(() => setMessage(null), 3000);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">Institutes</h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">Manage authorized colleges and institutions</p>
        </div>
        <button
          onClick={() => { setInstituteFormOpen(o => !o); setNewCollege(''); setMessage(null); }}
          className={`flex items-center gap-2 font-black px-4 py-2.5 rounded transition shadow-sm active:scale-95 text-sm shrink-0 ${instituteFormOpen ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'bg-slate-900 text-white hover:bg-green-700'}`}
        >
          {instituteFormOpen ? <FiX className="w-4 h-4" /> : <FiPlus className="w-4 h-4" />}
          <span className="hidden sm:inline">{instituteFormOpen ? 'Close' : 'Add Institute'}</span>
          <span className="sm:hidden">{instituteFormOpen ? 'Close' : 'New'}</span>
        </button>
      </div>

      {/* Add form */}
      {instituteFormOpen && (
        <div className="bg-white rounded border border-slate-200 shadow-sm p-4 lg:p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="bg-slate-900 p-2.5 rounded text-white shrink-0"><FiMapPin className="w-4 h-4" /></div>
            <div>
              <h2 className="text-base font-black text-slate-900">Add New Institute</h2>
              <p className="text-slate-500 font-medium text-xs mt-0.5">Expand the institutional network</p>
            </div>
          </div>
          <div className="flex gap-2 max-w-lg">
            <input
              type="text"
              value={newCollege}
              onChange={e => setNewCollege(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddCollege()}
              placeholder="Official Institution Name"
              className="input-field text-sm flex-1"
              autoFocus
            />
            <button onClick={handleAddCollege} className="bg-slate-900 text-white font-black px-5 py-2.5 rounded hover:bg-green-700 transition shadow-sm active:scale-95 flex items-center gap-2 text-sm shrink-0">
              <FiPlus className="w-4 h-4" /> Add
            </button>
          </div>
          {message && (
            <p className={`mt-3 text-sm font-bold p-3 rounded max-w-lg ${message.type === 'error' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>{message.text}</p>
          )}
        </div>
      )}

      {/* Registry table */}
      {!dataLoaded ? (
        <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden animate-pulse">
          <div className="px-4 lg:px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="space-y-1.5"><div className="h-3 bg-slate-200 rounded w-32" /><div className="h-2.5 bg-slate-100 rounded w-20" /></div>
            <div className="h-8 bg-slate-100 rounded w-48" />
          </div>
          <TableSkeleton rows={6} cols={6} />
        </div>
      ) : (
        <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 lg:px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-slate-900">Institute Registry</h2>
              <p className="text-xs text-slate-400 font-bold mt-0.5">{colleges.length} total · {filteredColleges.length} shown</p>
            </div>
            <div className="relative w-full sm:w-64">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
              <input
                type="text"
                placeholder="Search institutes…"
                value={collegeSearch}
                onChange={e => { setCollegeSearch(e.target.value); setCollegePage(1); }}
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-slate-400 transition bg-slate-50 font-medium"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-sm">
              <thead className="bg-slate-50 text-slate-400 text-[0.6rem] font-black uppercase tracking-widest">
                <tr>
                  <th className="px-4 lg:px-6 py-3.5 text-left w-12">#</th>
                  <th className="px-4 lg:px-6 py-3.5 text-left">Institute Name</th>
                  <th className="px-4 lg:px-6 py-3.5 text-left hidden sm:table-cell">Students</th>
                  <th className="px-4 lg:px-6 py-3.5 text-left hidden lg:table-cell">ID Card Type</th>
                  <th className="px-4 lg:px-6 py-3.5 text-left hidden lg:table-cell">Lanyard</th>
                  <th className="px-4 lg:px-6 py-3.5 text-left hidden md:table-cell">Status</th>
                  <th className="px-4 lg:px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedColleges.map((college, idx) => (
                  <tr key={college} onClick={() => setPreviewCollege(college)} className="hover:bg-violet-50/40 transition cursor-pointer">
                    <td className="px-4 lg:px-6 py-4"><span className="text-xs font-black text-slate-400">{(safeCollegePage - 1) * collegeRowsPerPage + idx + 1}</span></td>
                    <td className="px-4 lg:px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-green-50 flex items-center justify-center shrink-0"><FiMapPin className="w-3.5 h-3.5 text-green-600" /></div>
                        <p className="font-black text-slate-900 text-sm">{college}</p>
                      </div>
                    </td>
                    <td className="px-4 lg:px-6 py-4 hidden sm:table-cell">
                      <span className="text-sm font-bold text-slate-700">{collegeAssetsMap[college]?.studentCount ?? 0}<span className="text-slate-400 font-medium ml-1">student{(collegeAssetsMap[college]?.studentCount ?? 0) !== 1 ? 's' : ''}</span></span>
                    </td>
                    <td className="px-4 lg:px-6 py-4 hidden lg:table-cell">
                      {collegeAssetsMap[college]?.idCardTypeName ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[0.65rem] font-black bg-blue-50 text-blue-700 border border-blue-100">
                          <FiCreditCard className="w-3 h-3 shrink-0" />
                          {collegeAssetsMap[college].idCardTypeName}
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 lg:px-6 py-4 hidden lg:table-cell">
                      {collegeAssetsMap[college]?.lanyard ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[0.65rem] font-black bg-amber-50 text-amber-700 border border-amber-100">
                          <FiTag className="w-3 h-3 shrink-0" />
                          {collegeAssetsMap[college].lanyard}
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 lg:px-6 py-4 hidden md:table-cell">
                      <span className="inline-flex items-center px-2.5 py-1 rounded text-[0.65rem] font-black uppercase tracking-widest bg-green-50 text-green-700 border border-green-100">Authorized</span>
                    </td>
                    <td className="px-4 lg:px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setPreviewCollege(college)} className="w-8 h-8 rounded bg-violet-50 text-violet-500 flex items-center justify-center hover:bg-violet-500 hover:text-white transition" title="Preview institute assets">
                          <FiEye className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleRemoveCollege(college)} className="w-8 h-8 rounded bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition" title="Remove institute">
                          <FiTrash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredColleges.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 bg-slate-50 rounded flex items-center justify-center text-xl">🏫</div>
                        <div>
                          <p className="text-base font-black text-slate-900">{collegeSearch ? 'No matches found' : 'No institutes registered yet'}</p>
                          <p className="text-sm text-slate-500 font-medium mt-0.5">{collegeSearch ? 'Try a different search term.' : 'Add the first institution above.'}</p>
                        </div>
                        {collegeSearch && <button onClick={() => setCollegeSearch('')} className="px-4 py-2 bg-slate-900 text-white rounded text-xs font-black uppercase tracking-widest hover:bg-black transition">Clear Search</button>}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="bg-slate-50/50 px-4 lg:px-6 py-3 flex flex-wrap items-center justify-between border-t border-slate-100 gap-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[0.6rem] font-black uppercase tracking-widest text-slate-400">Rows:</span>
                <select value={collegeRowsPerPage} onChange={e => { setCollegeRowsPerPage(Number(e.target.value)); setCollegePage(1); }} className="bg-white border border-slate-200 rounded text-xs font-black px-2 py-1 outline-none focus:border-slate-400 transition cursor-pointer">
                  {[5, 10, 25].map(val => <option key={val} value={val}>{val}</option>)}
                </select>
              </div>
              <p className="text-[0.6rem] font-bold text-slate-500 uppercase tracking-widest">
                <span className="text-slate-900 font-black">{filteredColleges.length === 0 ? 0 : (safeCollegePage - 1) * collegeRowsPerPage + 1}–{Math.min(safeCollegePage * collegeRowsPerPage, filteredColleges.length)}</span>
                {' '}of <span className="text-slate-900 font-black">{filteredColleges.length}</span>
              </p>
            </div>
            {totalCollegePages > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => setCollegePage(p => Math.max(1, p - 1))} disabled={safeCollegePage === 1} className="p-1.5 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-900 hover:text-white disabled:opacity-30 transition-all">
                  <FiChevronLeft className="w-3.5 h-3.5" />
                </button>
                {Array.from({ length: totalCollegePages }, (_, i) => i + 1).map(page => (
                  <button key={page} onClick={() => setCollegePage(page)} className={`w-7 h-7 rounded text-[0.65rem] font-black transition-all ${safeCollegePage === page ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>{page}</button>
                ))}
                <button onClick={() => setCollegePage(p => Math.min(totalCollegePages, p + 1))} disabled={safeCollegePage === totalCollegePages} className="p-1.5 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-900 hover:text-white disabled:opacity-30 transition-all">
                  <FiChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Deleted Institutes */}
      <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
        <button onClick={() => setShowDeletedColleges(v => !v)} className="w-full flex items-center justify-between px-4 lg:px-6 py-3.5 hover:bg-slate-50 transition text-left">
          <span className="flex items-center gap-2 text-sm font-black text-slate-500">
            <FiRotateCcw className="w-4 h-4" />
            Deleted Institutes
            {deletedColleges.length > 0 && <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-600 text-[0.65rem] font-black">{deletedColleges.length}</span>}
          </span>
          <FiChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showDeletedColleges ? 'rotate-180' : ''}`} />
        </button>
        {showDeletedColleges && (
          <div className="border-t border-slate-100">
            {deletedColleges.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-slate-400 font-bold">No deleted institutes.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {deletedColleges.map(({ name, deletedBy: who }) => (
                  <div key={name} className="flex items-center justify-between px-4 lg:px-6 py-3 bg-rose-50/20">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded bg-rose-50 flex items-center justify-center shrink-0"><FiMapPin className="w-3.5 h-3.5 text-rose-400" /></div>
                      <div>
                        <p className="text-sm font-bold text-slate-400">{name}</p>
                        {who && <p className="text-[0.6rem] text-slate-300 font-medium mt-0.5">by {who}</p>}
                      </div>
                    </div>
                    <button onClick={() => handleRestoreCollege(name)} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-black text-emerald-600 bg-emerald-50 hover:bg-emerald-500 hover:text-white border border-emerald-100 transition">
                      <FiRotateCcw className="w-3 h-3" /> Restore
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {previewCollege && (
        <InstitutePreviewModal college={previewCollege} onClose={() => setPreviewCollege(null)} />
      )}

      <ConfirmDialog
        open={confirmDialog !== null}
        title={confirmDialog?.title ?? ''}
        message={confirmDialog?.message ?? ''}
        onConfirm={() => confirmDialog?.onConfirm()}
        onCancel={() => setConfirmDialog(null)}
      />

      {message && !instituteFormOpen && (
        <div className={`fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-lg shadow-2xl flex items-center gap-2.5 font-black text-sm border-2 max-w-[calc(100vw-2rem)] ${message.type === 'success' ? 'bg-emerald-500/90 text-white border-emerald-400/50' : 'bg-rose-500/90 text-white border-rose-400/50'}`}>
          <span className="shrink-0">{message.type === 'success' ? '✅' : '⚠️'}</span>
          <span className="truncate">{message.text}</span>
        </div>
      )}
    </div>
  );
}
