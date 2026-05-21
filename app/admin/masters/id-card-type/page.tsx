'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  FiCreditCard, FiPlus, FiTrash2, FiSearch, FiChevronLeft, FiChevronRight,
  FiRotateCcw, FiChevronDown, FiX,
} from 'react-icons/fi';
import {
  getIdCardTypes, addIdCardType, deleteIdCardType,
  getDeletedIdCardTypes, restoreIdCardType,
} from '@/lib/services/id-card-type.service';
import TableSkeleton from '@/components/TableSkeleton';

interface CardType {
  id: number;
  name: string;
  description: string | null;
}

interface DeletedCardType extends CardType {
  deletedBy: string | null;
}

export default function IdCardTypePage() {
  const { user } = useAuth();

  const [types,         setTypes]         = useState<CardType[]>([]);
  const [deleted,       setDeleted]       = useState<DeletedCardType[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [formOpen,      setFormOpen]      = useState(false);
  const [showDeleted,   setShowDeleted]   = useState(false);
  const [search,        setSearch]        = useState('');
  const [page,          setPage]          = useState(1);
  const [rowsPerPage,   setRowsPerPage]   = useState(10);
  const [newName,       setNewName]       = useState('');
  const [newDesc,       setNewDesc]       = useState('');
  const [saving,        setSaving]        = useState(false);
  const [message,       setMessage]       = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  useEffect(() => {
    if (!user?.email) return;
    Promise.all([getIdCardTypes(), getDeletedIdCardTypes()]).then(([active, del]) => {
      setTypes(active);
      setDeleted(del);
      setLoading(false);
    });
  }, [user?.email]);

  function showMsg(text: string, type: 'success' | 'error') {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  }

  const filtered   = types.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.description ?? '').toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const safePage   = Math.min(page, totalPages);
  const paginated  = filtered.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);

  async function handleAdd() {
    if (!newName.trim()) { showMsg('Name is required.', 'error'); return; }
    setSaving(true);
    const result = await addIdCardType(newName.trim(), newDesc.trim() || null);
    setSaving(false);
    if (result.success) {
      const fresh = await getIdCardTypes();
      setTypes(fresh);
      setNewName('');
      setNewDesc('');
      showMsg(result.message, 'success');
    } else {
      showMsg(result.message, 'error');
    }
  }

  function handleDelete(type: CardType) {
    setConfirmDialog({
      title: 'Remove ID Card Type',
      message: `"${type.name}" will be soft-deleted. It can be restored later.`,
      onConfirm: async () => {
        const by = user?.name || user?.email || 'admin';
        const result = await deleteIdCardType(type.id, by);
        if (result.success) {
          setTypes(prev => prev.filter(t => t.id !== type.id));
          setDeleted(prev => [...prev, { ...type, deletedBy: by }].sort((a, b) => a.name.localeCompare(b.name)));
          showMsg(result.message, 'success');
        } else {
          showMsg(result.message, 'error');
        }
        setConfirmDialog(null);
      },
    });
  }

  async function handleRestore(item: DeletedCardType) {
    const result = await restoreIdCardType(item.id);
    if (result.success) {
      setDeleted(prev => prev.filter(d => d.id !== item.id));
      setTypes(prev => [...prev, { id: item.id, name: item.name, description: item.description }].sort((a, b) => a.name.localeCompare(b.name)));
      showMsg(result.message, 'success');
    } else {
      showMsg(result.message, 'error');
    }
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">ID Card Types</h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">Master list of ID card categories</p>
        </div>
        <button
          onClick={() => { setFormOpen(o => !o); setNewName(''); setNewDesc(''); setMessage(null); }}
          className={`flex items-center gap-2 font-black px-4 py-2.5 rounded transition shadow-sm active:scale-95 text-sm shrink-0 ${formOpen ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'bg-slate-900 text-white hover:bg-violet-600'}`}
        >
          {formOpen ? <FiX className="w-4 h-4" /> : <FiPlus className="w-4 h-4" />}
          <span className="hidden sm:inline">{formOpen ? 'Close' : 'Add Type'}</span>
          <span className="sm:hidden">{formOpen ? 'Close' : 'New'}</span>
        </button>
      </div>

      {/* Add form */}
      {formOpen && (
        <div className="bg-white rounded border border-slate-200 shadow-sm p-4 lg:p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="bg-slate-900 p-2.5 rounded text-white shrink-0"><FiCreditCard className="w-4 h-4" /></div>
            <div>
              <h2 className="text-base font-black text-slate-900">Add New ID Card Type</h2>
              <p className="text-slate-500 font-medium text-xs mt-0.5">Define a new category for ID cards</p>
            </div>
          </div>
          <div className="space-y-3 max-w-2xl">
            <div className="flex gap-3">
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder="Type name (e.g. Student, Staff, Visitor)"
                className="input-field text-sm flex-1 min-w-0"
                autoFocus
                maxLength={100}
              />
              <textarea
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="Description (optional)"
                rows={1}
                className="flex-1 min-w-0 px-4 py-3 rounded-lg border border-slate-200 text-slate-900 text-sm placeholder-slate-300 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-400/10 transition font-medium resize-none"
                maxLength={500}
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={saving}
              className="bg-slate-900 text-white font-black px-5 py-2.5 rounded hover:bg-violet-600 transition shadow-sm active:scale-95 flex items-center gap-2 text-sm disabled:opacity-50"
            >
              <FiPlus className="w-4 h-4" /> {saving ? 'Adding…' : 'Add Type'}
            </button>
          </div>
          {message && (
            <p className={`mt-3 text-sm font-bold p-3 rounded max-w-lg ${message.type === 'error' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>{message.text}</p>
          )}
        </div>
      )}

      {/* Master table */}
      {loading ? (
        <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden animate-pulse">
          <div className="px-4 lg:px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="space-y-1.5"><div className="h-3 bg-slate-200 rounded w-32" /><div className="h-2.5 bg-slate-100 rounded w-20" /></div>
            <div className="h-8 bg-slate-100 rounded w-48" />
          </div>
          <TableSkeleton rows={5} cols={5} />
        </div>
      ) : (
        <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 lg:px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-slate-900">Type Registry</h2>
              <p className="text-xs text-slate-400 font-bold mt-0.5">{types.length} total · {filtered.length} shown</p>
            </div>
            <div className="relative w-full sm:w-64">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
              <input
                type="text"
                placeholder="Search types…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-slate-400 transition bg-slate-50 font-medium"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-sm">
              <thead className="bg-slate-50 text-slate-400 text-[0.6rem] font-black uppercase tracking-widest">
                <tr>
                  <th className="px-4 lg:px-6 py-3.5 text-left w-12">#</th>
                  <th className="px-4 lg:px-6 py-3.5 text-left">Name</th>
                  <th className="px-4 lg:px-6 py-3.5 text-left hidden md:table-cell">Description</th>
                  <th className="px-4 lg:px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginated.map((type, idx) => (
                  <tr key={type.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-4 lg:px-6 py-4">
                      <span className="text-xs font-black text-slate-400">{(safePage - 1) * rowsPerPage + idx + 1}</span>
                    </td>
                    <td className="px-4 lg:px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-violet-50 flex items-center justify-center shrink-0">
                          <FiCreditCard className="w-3.5 h-3.5 text-violet-500" />
                        </div>
                        <p className="font-black text-slate-900 text-sm">{type.name}</p>
                      </div>
                    </td>
                    <td className="px-4 lg:px-6 py-4 hidden md:table-cell">
                      {type.description
                        ? <p className="text-sm text-slate-500 font-medium max-w-xs truncate">{type.description}</p>
                        : <span className="text-slate-300 text-sm italic">No description</span>
                      }
                    </td>
                    <td className="px-4 lg:px-6 py-4 text-right">
                      <button
                        onClick={() => handleDelete(type)}
                        className="w-8 h-8 rounded bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition ml-auto"
                        title="Remove type"
                      >
                        <FiTrash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 bg-slate-50 rounded flex items-center justify-center text-xl">🪪</div>
                        <div>
                          <p className="text-base font-black text-slate-900">{search ? 'No matches found' : 'No types added yet'}</p>
                          <p className="text-sm text-slate-500 font-medium mt-0.5">{search ? 'Try a different search term.' : 'Add the first ID card type above.'}</p>
                        </div>
                        {search && (
                          <button onClick={() => setSearch('')} className="px-4 py-2 bg-slate-900 text-white rounded text-xs font-black uppercase tracking-widest hover:bg-black transition">
                            Clear Search
                          </button>
                        )}
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
                <select
                  value={rowsPerPage}
                  onChange={e => { setRowsPerPage(Number(e.target.value)); setPage(1); }}
                  className="bg-white border border-slate-200 rounded text-xs font-black px-2 py-1 outline-none focus:border-slate-400 transition cursor-pointer"
                >
                  {[5, 10, 25].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <p className="text-[0.6rem] font-bold text-slate-500 uppercase tracking-widest">
                <span className="text-slate-900 font-black">{filtered.length === 0 ? 0 : (safePage - 1) * rowsPerPage + 1}–{Math.min(safePage * rowsPerPage, filtered.length)}</span>
                {' '}of <span className="text-slate-900 font-black">{filtered.length}</span>
              </p>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1} className="p-1.5 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-900 hover:text-white disabled:opacity-30 transition-all">
                  <FiChevronLeft className="w-3.5 h-3.5" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 rounded text-[0.65rem] font-black transition-all ${safePage === p ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>{p}</button>
                ))}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="p-1.5 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-900 hover:text-white disabled:opacity-30 transition-all">
                  <FiChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Deleted types */}
      <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowDeleted(v => !v)}
          className="w-full flex items-center justify-between px-4 lg:px-6 py-3.5 hover:bg-slate-50 transition text-left"
        >
          <span className="flex items-center gap-2 text-sm font-black text-slate-500">
            <FiRotateCcw className="w-4 h-4" />
            Deleted Types
            {deleted.length > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-600 text-[0.65rem] font-black">{deleted.length}</span>
            )}
          </span>
          <FiChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showDeleted ? 'rotate-180' : ''}`} />
        </button>
        {showDeleted && (
          <div className="border-t border-slate-100">
            {deleted.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-slate-400 font-bold">No deleted types.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {deleted.map(item => (
                  <div key={item.id} className="flex items-center justify-between px-4 lg:px-6 py-3 bg-rose-50/20">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded bg-rose-50 flex items-center justify-center shrink-0">
                        <FiCreditCard className="w-3.5 h-3.5 text-rose-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[0.6rem] font-black text-slate-300 tabular-nums">#{item.id}</span>
                          <p className="text-sm font-bold text-slate-400 truncate">{item.name}</p>
                        </div>
                        {item.description && <p className="text-[0.6rem] text-slate-300 font-medium truncate max-w-xs">{item.description}</p>}
                        {item.deletedBy && <p className="text-[0.6rem] text-slate-300 font-medium mt-0.5">by {item.deletedBy}</p>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRestore(item)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-black text-emerald-600 bg-emerald-50 hover:bg-emerald-500 hover:text-white border border-emerald-100 transition shrink-0 ml-3"
                    >
                      <FiRotateCcw className="w-3 h-3" /> Restore
                    </button>
                  </div>
                ))}
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

      {message && !formOpen && (
        <div className={`fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-lg shadow-2xl flex items-center gap-2.5 font-black text-sm border-2 max-w-[calc(100vw-2rem)] ${message.type === 'success' ? 'bg-emerald-500/90 text-white border-emerald-400/50' : 'bg-rose-500/90 text-white border-rose-400/50'}`}>
          <span className="shrink-0">{message.type === 'success' ? '✅' : '⚠️'}</span>
          <span className="truncate">{message.text}</span>
        </div>
      )}
    </div>
  );
}
