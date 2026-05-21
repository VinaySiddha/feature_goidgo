'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { StudentRecord, CustomField } from '@/lib/types';
import { FiSearch, FiChevronLeft, FiChevronRight, FiTrash2, FiMapPin, FiXCircle, FiEdit2, FiColumns, FiCheck } from 'react-icons/fi';
import StudentDetailsModal from './StudentDetailsModal';
import ConfirmDialog from './ConfirmDialog';
import TableSkeleton from './TableSkeleton';
import { formatISTDate } from '@/lib/formatDate';
import { getCustomValuesForStudents } from '@/lib/services/custom-fields.service';

// ── Column definitions ────────────────────────────────────────────────────────

export interface ColDef {
  key: string;
  label: string;
  defaultVisible: boolean;
  alwaysVisible?: boolean;
}

export const CORE_COLS: ColDef[] = [
  { key: 'photo',        label: 'Photo',              defaultVisible: true  },
  { key: 'name',         label: 'Name',               defaultVisible: true,  alwaysVisible: true },
  { key: 'parentage',    label: 'Father / Mother Name', defaultVisible: true  },
  { key: 'phone',        label: 'Contact',            defaultVisible: true  },
  { key: 'rollNo',       label: 'Roll No.',           defaultVisible: true  },
  { key: 'studentClass', label: 'Class / Section',    defaultVisible: true  },
  { key: 'bloodGroup',   label: 'Blood Group',        defaultVisible: false },
  { key: 'address',      label: 'Address',            defaultVisible: false },
  { key: 'busStop',      label: 'Bus Stop',           defaultVisible: false },
  { key: 'college',      label: 'College',            defaultVisible: true  },
  { key: 'createdBy',    label: 'Added By',           defaultVisible: false },
  { key: 'createdAt',    label: 'Date',               defaultVisible: false },
];

interface ServerPaginationProps {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

interface StudentTableProps {
  students: StudentRecord[];
  loading?: boolean;
  onDelete?: (id: string) => Promise<void> | void;
  onSave?: (student: StudentRecord) => Promise<void>;
  colleges?: string[];
  defaultFilterCollege?: string;
  onFilterCollegeChange?: (college: string | null) => void;
  hideCollegeFilter?: boolean;
  serverPagination?: ServerPaginationProps;
  onSearchChange?: (term: string) => void;
  customFields?: CustomField[];
  hideSearch?: boolean;
  visibleCols?: Set<string>;
  onVisibleColsChange?: (cols: Set<string>) => void;
  hideColumnsButton?: boolean;
}

function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '...')[] = [1];
  if (current > 3) pages.push('...');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}

export default function StudentTable({ students, loading, onDelete, onSave, colleges: collegesProp, defaultFilterCollege, onFilterCollegeChange, hideCollegeFilter, serverPagination, onSearchChange, customFields = [], hideSearch = false, visibleCols: externalVisibleCols, onVisibleColsChange, hideColumnsButton = false }: StudentTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null);
  const [modalEditMode, setModalEditMode] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [filterCollege, setFilterCollege] = useState<string | null>(defaultFilterCollege ?? null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Column visibility (controlled when externalVisibleCols is passed) ──
  const [internalVisibleCols, setInternalVisibleCols] = useState<Set<string>>(() =>
    new Set(CORE_COLS.filter(c => c.defaultVisible).map(c => c.key))
  );
  const visibleCols = externalVisibleCols ?? internalVisibleCols;
  const setVisibleCols = (next: Set<string>) => {
    if (onVisibleColsChange) onVisibleColsChange(next);
    else setInternalVisibleCols(next);
  };

  const [colMenuOpen, setColMenuOpen] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) {
        setColMenuOpen(false);
      }
    }
    if (colMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [colMenuOpen]);

  const allCols: ColDef[] = useMemo(() => [
    ...CORE_COLS,
    ...customFields.map(cf => ({ key: `cf_${cf.id}`, label: cf.label, defaultVisible: false })),
  ], [customFields]);

  const toggleCol = (key: string) => {
    const next = new Set(visibleCols);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setVisibleCols(next);
  };

  const show = (key: string) => visibleCols.has(key);

  // ── Fetch custom field values for visible page (declared here, effect below after paginatedStudents) ──
  const [cfValues, setCfValues] = useState<Map<string, Record<number, string>>>(new Map());

  const uniqueColleges = useMemo(() =>
    collegesProp && collegesProp.length > 0
      ? collegesProp
      : Array.from(new Set(students.map(s => s.college))),
    [students, collegesProp]
  );
  const showCollegeFilter = !hideCollegeFilter && uniqueColleges.length > 1;

  const filteredStudents = useMemo(() => {
    if (serverPagination) return students; // server already filtered
    const q = searchTerm.toLowerCase();
    return students.filter((s) => {
      const matchesSearch = !q || [
        s.name, s.studentId, s.college, s.parentage, s.rollNo,
        s.studentClass, s.course, s.year, s.email, s.phone,
        s.busStop, s.bloodGroup, s.createdBy,
      ].some(v => v?.toLowerCase().includes(q));
      const matchesCollege = !filterCollege || s.college === filterCollege;
      return matchesSearch && matchesCollege;
    });
  }, [students, searchTerm, filterCollege, serverPagination]);

  const displayPageSize = serverPagination?.pageSize ?? itemsPerPage;
  const displayPage     = serverPagination?.page     ?? currentPage;
  const totalItems      = serverPagination?.total     ?? filteredStudents.length;
  const totalPages      = Math.max(1, Math.ceil(totalItems / displayPageSize));
  const safePage        = Math.min(displayPage, totalPages);

  const paginatedStudents = useMemo(() => {
    if (serverPagination) return students; // already the right page
    const start = (safePage - 1) * itemsPerPage;
    return filteredStudents.slice(start, start + itemsPerPage);
  }, [students, filteredStudents, safePage, itemsPerPage, serverPagination]);

  const anyCustomColVisible = customFields.some(cf => visibleCols.has(`cf_${cf.id}`));

  useEffect(() => {
    if (!anyCustomColVisible || paginatedStudents.length === 0) { setCfValues(new Map()); return; }
    getCustomValuesForStudents(paginatedStudents.map(s => s.id)).then(result => {
      const mapped = new Map<string, Record<number, string>>();
      result.forEach((vals, sid) => {
        const rec: Record<number, string> = {};
        vals.forEach(v => { rec[v.custom_field_id] = v.value ?? ''; });
        mapped.set(sid, rec);
      });
      setCfValues(mapped);
    });
  }, [anyCustomColVisible, paginatedStudents, setCfValues]);

  const handlePageChange = (page: number) => {
    if (serverPagination) serverPagination.onPageChange(page);
    else setCurrentPage(page);
  };

  const updateFilterCollege = (college: string | null) => {
    setFilterCollege(college);
    onFilterCollegeChange?.(college);
    setCurrentPage(1);
  };
  const resetFilters = () => { updateFilterCollege(null); setSearchTerm(''); };
  const hasActiveFilters = filterCollege || searchTerm;
  const pageNumbers = getPageNumbers(safePage, totalPages);

  const Th = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <th className={`px-3 py-3 text-left text-[0.6rem] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap bg-slate-50 ${className}`}>
      {children}
    </th>
  );

  const Td = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <td className={`px-3 py-3 align-top ${className}`}>
      {children}
    </td>
  );

  if (loading) return <TableSkeleton rows={6} cols={5} />;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">

      {/* ── Institute filter ── */}
      {showCollegeFilter && (
        <div className="sm:w-44 sm:shrink-0">
          <p className="hidden sm:flex items-center gap-1.5 text-[0.6rem] font-black uppercase tracking-widest text-slate-400 mb-3">
            <FiMapPin className="w-3 h-3" /> Institute
          </p>

          {/* Mobile chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 sm:hidden">
            {uniqueColleges.map(college => (
              <button
                key={college}
                onClick={() => { updateFilterCollege(filterCollege === college ? null : college); }}
                className={`shrink-0 px-3 py-1.5 rounded text-xs font-bold transition whitespace-nowrap ${filterCollege === college ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {college}
              </button>
            ))}
          </div>

          {/* Desktop list */}
          <div className="hidden sm:flex flex-col gap-1">
            {uniqueColleges.map(college => (
              <button
                key={college}
                onClick={() => { updateFilterCollege(filterCollege === college ? null : college); }}
                className={`w-full text-left px-3 py-2 rounded text-xs font-bold transition-all leading-snug ${filterCollege === college ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {college}
              </button>
            ))}
          </div>

          {hasActiveFilters && (
            <button onClick={resetFilters} className="mt-2 sm:mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded bg-rose-50 text-rose-600 border border-rose-100 font-black text-xs hover:bg-rose-100 transition">
              <FiXCircle className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>
      )}

      {/* ── Table area ── */}
      <div className="flex-1 space-y-3 min-w-0">

        {/* Search + Columns row */}
        <div className="flex gap-2">
          {!hideSearch && <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search name, ID, college, phone…"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (onSearchChange) onSearchChange(e.target.value);
                if (!serverPagination) setCurrentPage(1);
              }}
              className="w-full pl-9 pr-4 py-2.5 rounded border border-slate-200 focus:border-slate-400 focus:outline-none transition bg-white shadow-sm font-medium text-sm"
            />
          </div>}

          {/* Columns picker */}
          {!hideColumnsButton && <div className="relative shrink-0" ref={colMenuRef}>
            <button
              onClick={() => setColMenuOpen(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded border text-xs font-black transition shrink-0 ${colMenuOpen ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'}`}
              title="Show / hide columns"
            >
              <FiColumns className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Columns</span>
              <span className="sm:hidden">{visibleCols.size}</span>
            </button>

            {colMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 z-30 bg-white border border-slate-200 rounded-lg shadow-xl w-56 py-1.5 overflow-hidden">
                <p className="px-3 py-1.5 text-[0.58rem] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 mb-1">
                  Visible Columns
                </p>
                <div className="max-h-72 overflow-y-auto">
                  {allCols.map(col => {
                    const isOn = visibleCols.has(col.key);
                    const locked = col.alwaysVisible;
                    return (
                      <button
                        key={col.key}
                        onClick={() => !locked && toggleCol(col.key)}
                        disabled={locked}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition ${locked ? 'cursor-not-allowed opacity-50' : 'hover:bg-slate-50'}`}
                      >
                        <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition ${isOn ? 'bg-violet-600 border-violet-600' : 'border-slate-300 bg-white'}`}>
                          {isOn && <FiCheck className="w-2.5 h-2.5 text-white" />}
                        </span>
                        <span className={`text-xs font-bold truncate ${isOn ? 'text-slate-900' : 'text-slate-400'}`}>
                          {col.label}
                          {locked && <span className="ml-1 text-[0.55rem] text-slate-300">(always)</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="border-t border-slate-100 px-3 py-2 flex gap-2 mt-1">
                  <button
                    onClick={() => setVisibleCols(new Set(allCols.filter(c => c.defaultVisible || c.alwaysVisible).map(c => c.key)))}
                    className="flex-1 text-[0.65rem] font-black text-slate-500 hover:text-slate-900 transition"
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => setVisibleCols(new Set(allCols.map(c => c.key)))}
                    className="flex-1 text-[0.65rem] font-black text-violet-600 hover:text-violet-800 transition"
                  >
                    Show All
                  </button>
                </div>
              </div>
            )}
          </div>}

          {hasActiveFilters && !showCollegeFilter && (
            <button onClick={resetFilters} className="flex items-center gap-1.5 px-3 py-2.5 rounded bg-rose-50 text-rose-600 border border-rose-100 font-black text-xs hover:bg-rose-100 transition shrink-0">
              <FiXCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded border border-slate-200/80 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="border-separate border-spacing-0 text-left text-sm text-slate-900" style={{ minWidth: '1100px' }}>
              <thead>
                <tr>
                  <Th className="sticky left-0 z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">#</Th>
                  {(onSave || onDelete) && <Th className="w-20">{''}</Th>}
                  {show('photo')        && <Th>Photo</Th>}
                  {show('name')         && <Th>Name</Th>}
                  {show('parentage')    && <Th>Father/Mother Name</Th>}
                  {show('phone')        && <Th>Contact</Th>}
                  {show('rollNo')       && <Th>Roll No.</Th>}
                  {show('studentClass') && <Th>Class/Section</Th>}
                  {show('bloodGroup')   && <Th>Blood Group</Th>}
                  {show('address')      && <Th>Address</Th>}
                  {show('busStop')      && <Th>Bus Stop</Th>}
                  {show('college')      && <Th>College</Th>}
                  {show('createdBy')    && <Th>Added By</Th>}
                  {show('createdAt')    && <Th>Date</Th>}
                  {customFields.map(cf => show(`cf_${cf.id}`) && <Th key={cf.id}>{cf.label}</Th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedStudents.map((s, idx) => (
                  <tr
                    key={s.id}
                    onClick={() => { setModalEditMode(false); setSelectedStudent(s); }}
                    className="hover:bg-slate-50/60 transition cursor-pointer group"
                  >
                    {/* # */}
                    <Td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50/60 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                      <span className="text-xs font-black text-slate-400">
                        {(safePage - 1) * displayPageSize + idx + 1}
                      </span>
                    </Td>

                    {/* Edit + Delete */}
                    {(onSave || onDelete) && (
                      <Td className="w-20">
                        <div className="flex items-center gap-1">
                          {onSave && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setModalEditMode(true); setSelectedStudent(s); }}
                              className="w-7 h-7 rounded bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-900 hover:text-white transition-all active:scale-95"
                              title="Edit student"
                            >
                              <FiEdit2 className="w-3 h-3" />
                            </button>
                          )}
                          {onDelete && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setPendingDeleteId(s.id); }}
                              className="w-7 h-7 rounded bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-600 hover:text-white transition-all active:scale-95"
                              title="Delete student"
                            >
                              <FiTrash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </Td>
                    )}

                    {show('photo') && (
                      <Td>
                        <div className="w-10 h-10 rounded overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                          {s.photo ? (
                            <img src={s.photo} alt={s.name} className="w-full h-full object-cover group-hover:scale-110 transition duration-300" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[0.45rem] text-slate-400 font-black uppercase">No Img</div>
                          )}
                        </div>
                      </Td>
                    )}

                    {show('name') && (
                      <Td>
                        <p className="font-black text-slate-900 whitespace-nowrap">{s.name}</p>
                      </Td>
                    )}

                    {show('parentage') && (
                      <Td>
                        <p className="text-slate-600 font-medium whitespace-nowrap">{s.parentage || <span className="text-slate-300">—</span>}</p>
                      </Td>
                    )}

                    {show('phone') && (
                      <Td>
                        <p className="font-bold text-slate-700 whitespace-nowrap">{s.phone}</p>
                      </Td>
                    )}

                    {show('rollNo') && (
                      <Td>
                        <p className="text-slate-600 font-medium whitespace-nowrap">{s.rollNo || <span className="text-slate-300">—</span>}</p>
                      </Td>
                    )}

                    {show('studentClass') && (
                      <Td>
                        <p className="text-slate-600 font-medium whitespace-nowrap">{s.studentClass || <span className="text-slate-300">—</span>}</p>
                      </Td>
                    )}

                    {show('bloodGroup') && (
                      <Td>
                        {s.bloodGroup
                          ? <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 text-xs font-black border border-rose-100">{s.bloodGroup}</span>
                          : <span className="text-slate-300 text-xs">—</span>}
                      </Td>
                    )}

                    {show('address') && (
                      <Td>
                        <p className="text-slate-600 font-medium max-w-[160px] truncate" title={s.address}>{s.address || <span className="text-slate-300">—</span>}</p>
                      </Td>
                    )}

                    {show('busStop') && (
                      <Td>
                        <p className="text-slate-600 font-medium whitespace-nowrap">{s.busStop || <span className="text-slate-300">—</span>}</p>
                      </Td>
                    )}

                    {show('college') && (
                      <Td>
                        <p className="text-slate-500 font-bold text-xs whitespace-nowrap">{s.college}</p>
                      </Td>
                    )}

                    {show('createdBy') && (
                      <Td>
                        <p className="text-slate-500 font-medium text-xs whitespace-nowrap">{s.createdBy || '—'}</p>
                      </Td>
                    )}

                    {show('createdAt') && (
                      <Td>
                        <p className="text-slate-400 font-medium text-xs whitespace-nowrap">{formatISTDate(s.createdAt)}</p>
                      </Td>
                    )}

                    {customFields.map(cf => show(`cf_${cf.id}`) && (
                      <Td key={cf.id}>
                        <span className="text-slate-700 text-xs font-medium whitespace-nowrap">
                          {cfValues.get(s.id)?.[cf.id] || <span className="text-slate-300">—</span>}
                        </span>
                      </Td>
                    ))}

                  </tr>
                ))}

                {filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan={21} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 bg-slate-50 rounded flex items-center justify-center text-xl">🔍</div>
                        <div>
                          <p className="text-base font-black text-slate-900">No matches found</p>
                          <p className="text-sm text-slate-500 font-medium mt-0.5">Try adjusting your filters or search.</p>
                        </div>
                        <button onClick={resetFilters} className="px-4 py-2 bg-slate-900 text-white rounded text-xs font-black uppercase tracking-widest hover:bg-black transition">
                          Clear Filters
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          <div className="bg-slate-50/50 px-3 sm:px-6 py-3 flex flex-wrap items-center justify-between border-t border-slate-100 gap-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[0.6rem] font-black uppercase tracking-widest text-slate-400">Rows:</span>
                <select
                  value={displayPageSize}
                  onChange={(e) => {
                    const size = Number(e.target.value);
                    if (serverPagination) serverPagination.onPageSizeChange(size);
                    else { setItemsPerPage(size); setCurrentPage(1); }
                  }}
                  className="bg-white border border-slate-200 rounded text-xs font-black px-2 py-1 outline-none focus:border-slate-400 transition cursor-pointer"
                >
                  {[5, 10, 25, 50].map(val => <option key={val} value={val}>{val}</option>)}
                </select>
              </div>
              <p className="text-[0.6rem] font-bold text-slate-500 uppercase tracking-widest">
                <span className="text-slate-900 font-black">
                  {totalItems === 0 ? 0 : (safePage - 1) * displayPageSize + 1}–{Math.min(safePage * displayPageSize, totalItems)}
                </span>{' '}
                of <span className="text-slate-900 font-black">{totalItems}</span>
              </p>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handlePageChange(Math.max(1, safePage - 1))}
                  disabled={safePage === 1}
                  className="p-1.5 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-900 hover:text-white disabled:opacity-30 transition-all"
                >
                  <FiChevronLeft className="w-3.5 h-3.5" />
                </button>

                {pageNumbers.map((page, idx) =>
                  page === '...'
                    ? <span key={`dot-${idx}`} className="w-7 h-7 flex items-center justify-center text-slate-400 text-xs select-none">·</span>
                    : <button
                        key={page}
                        onClick={() => handlePageChange(page as number)}
                        className={`w-7 h-7 rounded text-[0.65rem] font-black transition-all ${safePage === page ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                      >
                        {page}
                      </button>
                )}

                <button
                  onClick={() => handlePageChange(Math.min(totalPages, safePage + 1))}
                  disabled={safePage === totalPages}
                  className="p-1.5 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-900 hover:text-white disabled:opacity-30 transition-all"
                >
                  <FiChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <StudentDetailsModal
        student={selectedStudent}
        onClose={() => { setSelectedStudent(null); setModalEditMode(false); }}
        onSave={onSave}
        onDelete={onDelete ? (id) => { setSelectedStudent(null); setPendingDeleteId(id); } : undefined}
        initialEditMode={modalEditMode}
        customFields={customFields}
      />

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete Student"
        message="The student record will be soft-deleted. You can restore it later from the Deleted Students section."
        loading={deleting}
        onConfirm={async () => {
          if (!pendingDeleteId) return;
          setDeleting(true);
          await onDelete?.(pendingDeleteId);
          setPendingDeleteId(null);
          setDeleting(false);
        }}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
