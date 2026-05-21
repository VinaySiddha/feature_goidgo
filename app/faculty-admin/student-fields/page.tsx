'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import {
  getAllCustomFields,
  createCustomField,
  updateCustomField,
  deleteCustomField,
  reorderCustomFields,
} from '@/lib/services/custom-fields.service';
import { CustomField, CustomFieldType } from '@/lib/types';
import {
  FiPlus, FiEdit2, FiTrash2, FiChevronUp, FiChevronDown,
  FiToggleLeft, FiToggleRight, FiX, FiSave, FiList,
  FiType, FiHash, FiCalendar, FiMail, FiPhone,
  FiCheckSquare, FiAlignLeft,
} from 'react-icons/fi';

// ── constants ─────────────────────────────────────────────────────────────────

const FIELD_TYPES: { value: CustomFieldType; label: string; icon: React.ElementType }[] = [
  { value: 'TEXT',     label: 'Text',      icon: FiType        },
  { value: 'NUMBER',   label: 'Number',    icon: FiHash        },
  { value: 'DATE',     label: 'Date',      icon: FiCalendar    },
  { value: 'EMAIL',    label: 'Email',     icon: FiMail        },
  { value: 'PHONE',    label: 'Phone',     icon: FiPhone       },
  { value: 'SELECT',   label: 'Dropdown',  icon: FiChevronDown },
  { value: 'RADIO',    label: 'Radio',     icon: FiList        },
  { value: 'CHECKBOX', label: 'Checkbox',  icon: FiCheckSquare },
  { value: 'TEXTAREA', label: 'Textarea',  icon: FiAlignLeft   },
];

const FIELD_TYPE_BADGE: Record<CustomFieldType, string> = {
  TEXT:     'bg-blue-50 text-blue-600 border-blue-100',
  NUMBER:   'bg-purple-50 text-purple-600 border-purple-100',
  DATE:     'bg-orange-50 text-orange-600 border-orange-100',
  EMAIL:    'bg-pink-50 text-pink-600 border-pink-100',
  PHONE:    'bg-teal-50 text-teal-600 border-teal-100',
  SELECT:   'bg-violet-50 text-violet-600 border-violet-100',
  RADIO:    'bg-indigo-50 text-indigo-600 border-indigo-100',
  CHECKBOX: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  TEXTAREA: 'bg-amber-50 text-amber-600 border-amber-100',
};

const HAS_OPTIONS: CustomFieldType[] = ['SELECT', 'RADIO'];

// ── form state ────────────────────────────────────────────────────────────────

interface OptionRow { option_label: string; option_value: string }

interface FieldForm {
  label: string;
  field_type: CustomFieldType;
  is_required: boolean;
  placeholder: string;
  is_active: boolean;
  options: OptionRow[];
}

const DEFAULT_FORM: FieldForm = {
  label: '', field_type: 'TEXT', is_required: false,
  placeholder: '', is_active: true, options: [],
};

// ── component ─────────────────────────────────────────────────────────────────

export default function StudentFieldsPage() {
  const { user } = useAuth();

  const [fields,  setFields]  = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // modal
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [form,         setForm]         = useState<FieldForm>(DEFAULT_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState<CustomField | null>(null);

  const college = user?.college ?? '';

  // ── data ──

  useEffect(() => {
    if (!college) return;
    getAllCustomFields(college).then(f => { setFields(f); setLoading(false); });
  }, [college]);

  function showToast(text: string, type: 'success' | 'error') {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3000);
  }

  // ── open modal ──

  function openCreate() {
    setEditingField(null);
    setForm(DEFAULT_FORM);
    setModalOpen(true);
  }

  function openEdit(f: CustomField) {
    setEditingField(f);
    setForm({
      label:       f.label,
      field_type:  f.field_type,
      is_required: f.is_required,
      placeholder: f.placeholder ?? '',
      is_active:   f.is_active,
      options:     (f.options ?? []).map(o => ({ option_label: o.option_label, option_value: o.option_value })),
    });
    setModalOpen(true);
  }

  // ── save modal ──

  async function handleSave() {
    if (!form.label.trim()) { showToast('Label is required.', 'error'); return; }
    if (HAS_OPTIONS.includes(form.field_type) && form.options.filter(o => o.option_label.trim()).length === 0) {
      showToast('At least one option is required for this field type.', 'error');
      return;
    }
    setSaving(true);

    if (editingField) {
      const res = await updateCustomField({
        id:          editingField.id,
        college,
        label:       form.label,
        field_type:  form.field_type,
        is_required: form.is_required,
        placeholder: form.placeholder,
        is_active:   form.is_active,
        options:     form.options,
      });
      setSaving(false);
      if (res.success) {
        showToast(res.message, 'success');
        setModalOpen(false);
        const updated = await getAllCustomFields(college);
        setFields(updated);
      } else {
        showToast(res.message, 'error');
      }
    } else {
      const res = await createCustomField({
        college,
        label:       form.label,
        field_type:  form.field_type,
        is_required: form.is_required,
        placeholder: form.placeholder,
        options:     form.options,
      });
      setSaving(false);
      if (res.success) {
        showToast(res.message, 'success');
        setModalOpen(false);
        const updated = await getAllCustomFields(college);
        setFields(updated);
      } else {
        showToast(res.message, 'error');
      }
    }
  }

  // ── delete ──

  async function handleDelete(f: CustomField) {
    const res = await deleteCustomField(f.id, college);
    setDeleteConfirm(null);
    if (res.success) {
      showToast(res.message, 'success');
      setFields(prev => prev.filter(x => x.id !== f.id));
    } else {
      showToast(res.message, 'error');
    }
  }

  // ── reorder ──

  async function moveField(index: number, dir: 'up' | 'down') {
    const next = [...fields];
    const swap = dir === 'up' ? index - 1 : index + 1;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    setFields(next);
    await reorderCustomFields(college, next.map(f => f.id));
  }

  // ── options editor helpers ──

  function addOption() {
    setForm(f => ({ ...f, options: [...f.options, { option_label: '', option_value: '' }] }));
  }

  function updateOption(i: number, key: keyof OptionRow, val: string) {
    setForm(f => {
      const opts = [...f.options];
      opts[i] = { ...opts[i], [key]: val };
      // auto-fill option_value from label if value is still empty or same as old label
      if (key === 'option_label' && (!opts[i].option_value || opts[i].option_value === f.options[i]?.option_label)) {
        opts[i].option_value = val;
      }
      return { ...f, options: opts };
    });
  }

  function removeOption(i: number) {
    setForm(f => ({ ...f, options: f.options.filter((_, idx) => idx !== i) }));
  }

  // ── render ──

  const activeFields   = fields.filter(f => f.is_active);
  const inactiveFields = fields.filter(f => !f.is_active);

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">Student Fields</h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            Define custom data fields collected from students at your institution
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded font-black text-sm hover:bg-violet-600 transition shadow-sm active:scale-95 shrink-0"
        >
          <FiPlus className="w-4 h-4" />
          Add Field
        </button>
      </div>

      {/* Info banner */}
      <div className="bg-violet-50 border border-violet-100 rounded p-4 text-xs font-medium text-violet-700 leading-relaxed">
        These fields appear in the student registration form and Excel upload. Fields marked <strong>Required</strong> must be filled before a student record is saved.
      </div>

      {/* Field list */}
      {loading ? (
        <div className="space-y-3">
          {[0,1,2].map(i => (
            <div key={i} className="bg-white rounded border border-slate-200 p-4 animate-pulse h-16" />
          ))}
        </div>
      ) : activeFields.length === 0 ? (
        <div className="bg-white rounded border border-slate-200 p-10 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <FiList className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-sm font-black text-slate-600">No custom fields yet</p>
          <p className="text-xs text-slate-400 font-medium mt-1">
            Click <strong>Add Field</strong> to define the first custom field for your institution.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded border border-slate-200 shadow-sm divide-y divide-slate-100">
          {activeFields.map((f, i) => {
            const TypeIcon = FIELD_TYPES.find(t => t.value === f.field_type)?.icon ?? FiType;
            return (
              <div key={f.id} className="flex items-center gap-3 px-4 py-3">

                {/* Reorder buttons */}
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button
                    onClick={() => moveField(fields.indexOf(f), 'up')}
                    disabled={i === 0}
                    className="p-0.5 rounded text-slate-300 hover:text-slate-600 disabled:opacity-20 transition"
                  >
                    <FiChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => moveField(fields.indexOf(f), 'down')}
                    disabled={i === activeFields.length - 1}
                    className="p-0.5 rounded text-slate-300 hover:text-slate-600 disabled:opacity-20 transition"
                  >
                    <FiChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Type icon */}
                <div className="w-8 h-8 rounded bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                  <TypeIcon className="w-3.5 h-3.5 text-slate-500" />
                </div>

                {/* Label + badges */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-black text-slate-900">{f.label}</span>
                    {f.is_required && (
                      <span className="text-[0.6rem] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-500 border border-rose-100">
                        Required
                      </span>
                    )}
                    <span className={`text-[0.6rem] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full border ${FIELD_TYPE_BADGE[f.field_type]}`}>
                      {FIELD_TYPES.find(t => t.value === f.field_type)?.label}
                    </span>
                  </div>
                  {f.options && f.options.length > 0 && (
                    <p className="text-[0.65rem] text-slate-400 font-medium mt-0.5 truncate">
                      Options: {f.options.map(o => o.option_label).join(' · ')}
                    </p>
                  )}
                  {f.placeholder && (
                    <p className="text-[0.65rem] text-slate-400 font-medium mt-0.5 italic truncate">
                      Placeholder: {f.placeholder}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => openEdit(f)}
                    className="p-2 rounded text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition"
                    title="Edit"
                  >
                    <FiEdit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(f)}
                    className="p-2 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition"
                    title="Remove"
                  >
                    <FiTrash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Inactive fields */}
      {inactiveFields.length > 0 && (
        <div>
          <p className="text-[0.65rem] font-black uppercase tracking-widest text-slate-400 mb-2">
            Inactive Fields
          </p>
          <div className="bg-white rounded border border-slate-200 divide-y divide-slate-100 opacity-60">
            {inactiveFields.map(f => (
              <div key={f.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-sm font-bold text-slate-500 flex-1">{f.label}</span>
                <span className="text-[0.6rem] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400 border border-slate-200">
                  Inactive
                </span>
                <button
                  onClick={() => openEdit(f)}
                  className="p-2 rounded text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition"
                  title="Edit / Restore"
                >
                  <FiToggleLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-slate-900">
                  {editingField ? 'Edit Field' : 'Add Custom Field'}
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {editingField ? `Editing: ${editingField.label}` : 'Define a new data field for students'}
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5">

              {/* Label */}
              <label className="block">
                <span className="mb-1.5 block text-xs font-black uppercase tracking-widest text-slate-400">
                  Field Label <span className="text-rose-500">*</span>
                </span>
                <input
                  type="text"
                  value={form.label}
                  onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                  placeholder="e.g. Blood Group"
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 text-slate-900 text-sm placeholder-slate-300 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-400/10 transition font-bold"
                />
              </label>

              {/* Field Type */}
              <div>
                <span className="mb-1.5 block text-xs font-black uppercase tracking-widest text-slate-400">
                  Field Type <span className="text-rose-500">*</span>
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {FIELD_TYPES.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, field_type: value, options: HAS_OPTIONS.includes(value) ? f.options : [] }))}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-black transition ${
                        form.field_type === value
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Options (SELECT / RADIO) */}
              {HAS_OPTIONS.includes(form.field_type) && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                      Options <span className="text-rose-500">*</span>
                    </span>
                    <button
                      type="button"
                      onClick={addOption}
                      className="flex items-center gap-1 text-xs font-black text-violet-600 hover:text-violet-800 transition"
                    >
                      <FiPlus className="w-3 h-3" /> Add Option
                    </button>
                  </div>
                  <div className="space-y-2">
                    {form.options.map((opt, i) => (
                      <div key={i} className="flex gap-2">
                        <input
                          type="text"
                          value={opt.option_label}
                          onChange={e => updateOption(i, 'option_label', e.target.value)}
                          placeholder={`Option ${i + 1}`}
                          className="flex-1 px-3 py-2 rounded border border-slate-200 text-sm font-bold text-slate-900 placeholder-slate-300 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/10 transition"
                        />
                        <button
                          type="button"
                          onClick={() => removeOption(i)}
                          className="p-2 rounded border border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-100 transition"
                        >
                          <FiX className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {form.options.length === 0 && (
                      <button
                        type="button"
                        onClick={addOption}
                        className="w-full py-3 rounded-lg border-2 border-dashed border-slate-200 text-xs font-black text-slate-400 hover:border-violet-300 hover:text-violet-500 transition"
                      >
                        + Add first option
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Placeholder */}
              {!HAS_OPTIONS.includes(form.field_type) && form.field_type !== 'CHECKBOX' && (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-black uppercase tracking-widest text-slate-400">
                    Placeholder Text
                  </span>
                  <input
                    type="text"
                    value={form.placeholder}
                    onChange={e => setForm(f => ({ ...f, placeholder: e.target.value }))}
                    placeholder="e.g. Enter blood group"
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 text-slate-900 text-sm placeholder-slate-300 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-400/10 transition font-bold"
                  />
                </label>
              )}

              {/* Toggles */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, is_required: !f.is_required }))}
                  className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-lg border transition ${
                    form.is_required ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  {form.is_required
                    ? <FiToggleRight className="w-5 h-5 text-rose-500 shrink-0" />
                    : <FiToggleLeft  className="w-5 h-5 text-slate-400 shrink-0" />}
                  <div className="text-left">
                    <p className={`text-xs font-black ${form.is_required ? 'text-rose-700' : 'text-slate-600'}`}>
                      Required Field
                    </p>
                    <p className="text-[0.6rem] text-slate-400 font-medium">Must be filled on registration</p>
                  </div>
                </button>

                {editingField && (
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                    className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-lg border transition ${
                      form.is_active ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    {form.is_active
                      ? <FiToggleRight className="w-5 h-5 text-emerald-500 shrink-0" />
                      : <FiToggleLeft  className="w-5 h-5 text-slate-400 shrink-0" />}
                    <div className="text-left">
                      <p className={`text-xs font-black ${form.is_active ? 'text-emerald-700' : 'text-slate-600'}`}>
                        Active
                      </p>
                      <p className="text-[0.6rem] text-slate-400 font-medium">Visible in student form</p>
                    </div>
                  </button>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 bg-slate-900 text-white font-black px-5 py-2.5 rounded hover:bg-violet-600 transition shadow-sm active:scale-95 text-sm disabled:opacity-60"
                >
                  <FiSave className="w-3.5 h-3.5" />
                  {saving ? 'Saving…' : editingField ? 'Update Field' : 'Create Field'}
                </button>
                <button
                  onClick={() => setModalOpen(false)}
                  className="px-5 py-2.5 rounded border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full max-w-sm p-5 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <FiTrash2 className="w-4 h-4 text-rose-500" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">Remove Field?</h3>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  <strong>{deleteConfirm.label}</strong> will be hidden from the student form.
                  Existing student data for this field is preserved.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 bg-rose-500 text-white font-black py-2.5 rounded hover:bg-rose-600 transition text-sm"
              >
                Remove
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 border border-slate-200 text-slate-600 font-black py-2.5 rounded hover:bg-slate-50 transition text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
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
