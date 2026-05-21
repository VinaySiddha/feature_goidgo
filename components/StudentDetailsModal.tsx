'use client';

import { useState, useEffect, useRef } from 'react';
import { StudentRecord, CustomField } from '@/lib/types';
import { FiX, FiEdit2, FiTrash2, FiCheck, FiCamera, FiUpload } from 'react-icons/fi';
import { MdFlipCameraAndroid } from 'react-icons/md';
import { formatISTDate } from '@/lib/formatDate';
import CropModal from './CropModal';
import { getStudentCustomValues, saveStudentCustomValues } from '@/lib/services/custom-fields.service';

interface StudentDetailsModalProps {
  student: StudentRecord | null;
  onClose: () => void;
  onSave?: (updated: StudentRecord) => Promise<void>;
  onDelete?: (id: string) => void;
  initialEditMode?: boolean;
  customFields?: CustomField[];  // passed from parent so we don't re-fetch
}

const EMPTY_FORM = {
  name: '', parentage: '', phone: '', address: '',
};

export default function StudentDetailsModal({
  student, onClose, onSave, onDelete, initialEditMode = false, customFields = [],
}: StudentDetailsModalProps) {
  const [editing,        setEditing]        = useState(initialEditMode);
  const [form,           setForm]           = useState(EMPTY_FORM);
  const [photo,          setPhoto]          = useState<string | null>(null);
  const [saving,         setSaving]         = useState(false);
  const [saved,          setSaved]          = useState(false);
  const [msg,            setMsg]            = useState<{ text: string; type: 'error' } | null>(null);
  const [cropSource,     setCropSource]     = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState<'close' | 'cancel' | false>(false);
  const [cameraOpen,     setCameraOpen]     = useState(false);
  const [cameraError,    setCameraError]    = useState<string | null>(null);
  const [customValues,   setCustomValues]   = useState<Record<number, string>>({});

  const videoRef      = useRef<HTMLVideoElement>(null);
  const streamRef     = useRef<MediaStream | null>(null);
  const facingModeRef = useRef<'user' | 'environment'>('user');

  useEffect(() => {
    if (!student) return;
    setEditing(initialEditMode);
    setMsg(null);
    setSaved(false);
    setForm({
      name:      student.name,
      parentage: student.parentage ?? '',
      phone:     student.phone,
      address:   student.address ?? '',
    });
    setPhoto(student.photo ?? null);
    // Load custom values for this student
    getStudentCustomValues(student.id).then(vals => {
      const map: Record<number, string> = {};
      vals.forEach(v => { map[v.custom_field_id] = v.value ?? ''; });
      setCustomValues(map);
    });
  }, [student, initialEditMode]);

  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraOpen]);

  const startCamera = async (mode: 'user' | 'environment' = facingModeRef.current) => {
    setCameraError(null);
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      let s: MediaStream;
      try {
        s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: mode }, width: { ideal: 640 }, height: { ideal: 640 } } });
      } catch {
        s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode, width: { ideal: 640 }, height: { ideal: 640 } } });
      }
      streamRef.current = s;
      facingModeRef.current = mode;
      setCameraOpen(true);
    } catch {
      setCameraError('Camera access denied or unavailable.');
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
    setCameraError(null);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    stopCamera();
    setCropSource(canvas.toDataURL('image/png'));
  };

  if (!student) return null;

  const isDirty =
    editing && (
      form.name         !== (student.name         ?? '')  ||
      form.parentage    !== (student.parentage    ?? '')  ||
      form.phone        !== (student.phone        ?? '')  ||
      photo             !== (student.photo        ?? null)
    );

  const tryClose = () => {
    if (isDirty) { setConfirmDiscard('close'); return; }
    onClose();
  };

  const handlePhotoFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => setCropSource(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setMsg({ text: 'Student name is required.', type: 'error' }); return; }
    if (!form.phone.trim()) { setMsg({ text: 'Contact number is required.', type: 'error' }); return; }
    setSaving(true);
    const updated: StudentRecord = {
      ...student,
      name:         form.name,
      parentage:    form.parentage    || undefined,
      phone:        form.phone,
      photo:        photo             ?? undefined,
    };
    await onSave?.(updated);
    // Persist custom values
    const cvEntries = Object.entries(customValues)
      .map(([id, value]) => ({ custom_field_id: Number(id), value: value || null }));
    if (cvEntries.length > 0) {
      await saveStudentCustomValues(student.id, cvEntries).catch(() => {});
    }
    setSaving(false);
    setSaved(true);
    setMsg(null);
    setTimeout(() => {
      setSaved(false);
      setEditing(false);
    }, 1400);
  };

  const discardAndClose = (closeModal = false) => {
    setConfirmDiscard(false);
    setEditing(false);
    setMsg(null);
    setSaved(false);
    setForm({
      name:      student.name,
      parentage: student.parentage ?? '',
      phone:     student.phone,
      address:   student.address ?? '',
    });
    setPhoto(student.photo ?? null);
    if (closeModal) onClose();
  };

  const L = ({ text, optional }: { text: string; optional?: boolean }) => (
    <p className="text-[0.58rem] font-black uppercase tracking-widest text-slate-400 mb-1">
      {text}{optional && <span className="ml-1 normal-case tracking-normal font-medium text-slate-300">(optional)</span>}
    </p>
  );

  const Field = ({ label, value }: { label: string; value?: string | null }) => (
    <div className="bg-slate-50 rounded border border-slate-100 px-3 py-2.5">
      <L text={label} />
      <p className="text-sm font-bold text-slate-800 break-words">{value || <span className="text-slate-300 font-medium">—</span>}</p>
    </div>
  );

  const Input = ({ label, fkey, type = 'text', placeholder = '', optional = true, colSpan = false }: {
    label: string; fkey: keyof typeof form; type?: string; placeholder?: string; optional?: boolean; colSpan?: boolean;
  }) => (
    <label className={`block${colSpan ? ' col-span-2' : ''}`}>
      <L text={label} optional={optional} />
      {fkey === 'address'
        ? <textarea rows={2} value={form[fkey]} onChange={e => setForm(f => ({ ...f, [fkey]: e.target.value }))} placeholder={placeholder} className="input-field text-sm resize-none w-full" />
        : <input type={type} value={form[fkey]} onChange={e => setForm(f => ({ ...f, [fkey]: e.target.value }))} placeholder={placeholder} className="input-field text-sm w-full" />}
    </label>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-0 sm:p-4 animate-fade-in"
      onClick={e => { if (e.target === e.currentTarget) tryClose(); }}
    >
      <div className="relative w-full sm:max-w-2xl max-h-[92vh] bg-white sm:rounded-xl shadow-2xl border border-slate-200 flex flex-col animate-scale-up rounded-t-2xl">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {!editing && (
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                {photo
                  ? <img src={photo} alt={student.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><FiCamera className="w-4 h-4 text-slate-300" /></div>}
              </div>
            )}
            <div className="min-w-0">
              {editing
                ? <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Edit Student</p>
                : <>
                    <h2 className="text-base font-black text-slate-900 truncate">{student.name}</h2>
                    <p className="text-xs text-slate-400 font-medium truncate">{student.college}</p>
                  </>}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {onSave && !editing && (
              <button onClick={() => setEditing(true)} className="w-8 h-8 rounded flex items-center justify-center text-slate-500 bg-slate-100 hover:bg-slate-900 hover:text-white transition" title="Edit">
                <FiEdit2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button onClick={tryClose} className="w-8 h-8 rounded flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition">
              <FiX className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="overflow-y-auto flex-1 p-5">
          {editing ? (
            <div className="space-y-4">

              {/* ── Photo row ── */}
              <div className="flex items-center gap-4 p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-200 border border-slate-300 shrink-0 flex items-center justify-center">
                  {photo
                    ? <img src={photo} alt="Preview" className="w-full h-full object-cover" />
                    : <FiCamera className="w-5 h-5 text-slate-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[0.58rem] font-black uppercase tracking-widest text-slate-400 mb-2">
                    Student Photo <span className="normal-case tracking-normal font-medium text-slate-300">(optional)</span>
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Upload — all devices */}
                    <label className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 cursor-pointer transition text-xs font-black text-slate-700 shrink-0">
                      <FiUpload className="w-3.5 h-3.5" />
                      {photo ? 'Change' : 'Upload'}
                      <input type="file" accept="image/*" className="hidden" onChange={e => handlePhotoFile(e.target.files?.[0] ?? null)} />
                    </label>
                    {/* Desktop: WebRTC webcam */}
                    <button
                      type="button"
                      onClick={() => startCamera('user')}
                      className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-green-50 hover:border-green-400 hover:text-green-700 transition text-xs font-black text-slate-700 shrink-0"
                    >
                      <FiCamera className="w-3.5 h-3.5" /> Capture
                    </button>
                    {/* Mobile: native camera → crop */}
                    <label className="flex sm:hidden items-center gap-1.5 px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-green-50 hover:border-green-400 hover:text-green-700 cursor-pointer transition text-xs font-black text-slate-700 shrink-0">
                      <FiCamera className="w-3.5 h-3.5" /> Capture
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handlePhotoFile(e.target.files?.[0] ?? null)} />
                    </label>
                    {photo && (
                      <button type="button" onClick={() => setPhoto(null)} className="text-xs font-bold text-rose-500 hover:text-rose-700 transition">
                        Remove
                      </button>
                    )}
                  </div>
                  {cameraError && <p className="text-[0.6rem] font-bold text-rose-500 mt-1">{cameraError}</p>}
                  <p className="text-[0.6rem] text-slate-400 font-medium mt-1.5">JPG, PNG, WEBP · max 10 MB</p>
                </div>
              </div>

              {/* ── Name (full width) ── */}
              <label className="block">
                <L text="Student Name" optional={false} />
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Full name"
                  className="input-field text-sm w-full"
                />
              </label>

              {/* ── Fields ── */}
              <div className="grid grid-cols-2 gap-3">
                <Input label="Father / Mother Name" fkey="parentage" placeholder="Parent's name" colSpan />
                <Input label="Contact Number *"     fkey="phone"     type="tel" placeholder="10-digit number" optional={false} />

                {customFields.map(cf => (
                      <div key={cf.id} className={cf.field_type === 'TEXTAREA' ? 'col-span-2' : ''}>
                        <L text={cf.label} optional={!cf.is_required} />
                        {cf.field_type === 'SELECT' ? (
                          <select
                            value={customValues[cf.id] ?? ''}
                            onChange={e => setCustomValues(v => ({ ...v, [cf.id]: e.target.value }))}
                            className="input-field text-sm appearance-none w-full"
                          >
                            <option value="">— Select —</option>
                            {(cf.options ?? []).map(o => (
                              <option key={o.id} value={o.option_value}>{o.option_label}</option>
                            ))}
                          </select>
                        ) : cf.field_type === 'RADIO' ? (
                          <div className="flex flex-wrap gap-3 pt-1">
                            {(cf.options ?? []).map(o => (
                              <label key={o.id} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`edit_cf_${cf.id}`}
                                  value={o.option_value}
                                  checked={customValues[cf.id] === o.option_value}
                                  onChange={() => setCustomValues(v => ({ ...v, [cf.id]: o.option_value }))}
                                  className="accent-violet-600"
                                />
                                <span className="text-sm font-bold text-slate-700">{o.option_label}</span>
                              </label>
                            ))}
                          </div>
                        ) : cf.field_type === 'CHECKBOX' ? (
                          <label className="flex items-center gap-2 cursor-pointer pt-1">
                            <input
                              type="checkbox"
                              checked={customValues[cf.id] === 'true'}
                              onChange={e => setCustomValues(v => ({ ...v, [cf.id]: e.target.checked ? 'true' : 'false' }))}
                              className="accent-violet-600 w-4 h-4"
                            />
                            <span className="text-sm font-bold text-slate-700">{cf.label}</span>
                          </label>
                        ) : cf.field_type === 'TEXTAREA' ? (
                          <textarea
                            value={customValues[cf.id] ?? ''}
                            onChange={e => setCustomValues(v => ({ ...v, [cf.id]: e.target.value }))}
                            placeholder={cf.placeholder ?? ''}
                            rows={2}
                            className="input-field text-sm resize-none w-full"
                          />
                        ) : (
                          <input
                            type={cf.field_type === 'NUMBER' ? 'number' : cf.field_type === 'DATE' ? 'date' : cf.field_type === 'EMAIL' ? 'email' : cf.field_type === 'PHONE' ? 'tel' : 'text'}
                            value={customValues[cf.id] ?? ''}
                            onChange={e => setCustomValues(v => ({ ...v, [cf.id]: e.target.value }))}
                            placeholder={cf.placeholder ?? ''}
                            className="input-field text-sm w-full"
                          />
                        )}
                      </div>
                    ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="Student Name"         value={student.name} />
                <Field label="Father / Mother Name" value={student.parentage} />
                <Field label="Contact Number"       value={student.phone} />
                <Field label="Added By"             value={student.createdBy} />
                <Field label="Created At"           value={formatISTDate(student.createdAt)} />
                {customFields.map(cf => {
                  const val = customValues[cf.id];
                  if (!val) return null;
                  return <Field key={cf.id} label={cf.label} value={val === 'true' ? 'Yes' : val === 'false' ? 'No' : val} />;
                })}
              </div>
            </div>
          )}

          {msg && (
            <p className="mt-3 text-sm font-bold p-3 rounded bg-rose-50 text-rose-600 border border-rose-100">
              {msg.text}
            </p>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex gap-2.5 px-5 py-4 border-t border-slate-100 shrink-0">
          {editing ? (
            confirmDiscard !== false ? (
              <div className="flex-1 flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                <p className="text-sm font-black text-amber-700">Discard unsaved changes?</p>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setConfirmDiscard(false)} className="px-3 py-1.5 text-xs font-black rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 transition">
                    Keep editing
                  </button>
                  <button onClick={() => discardAndClose(confirmDiscard === 'close')} className="px-3 py-1.5 text-xs font-black rounded bg-rose-600 text-white hover:bg-rose-700 transition">
                    Discard
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  onClick={() => { if (isDirty) { setConfirmDiscard('cancel'); } else { discardAndClose(false); } }}
                  className="px-4 py-2.5 rounded border border-slate-200 text-slate-600 font-black text-sm hover:bg-slate-100 transition active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || saved}
                  className={`flex-1 flex items-center justify-center gap-2 font-black py-2.5 rounded text-sm transition active:scale-95 disabled:cursor-not-allowed
                    ${saved ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-60'}`}
                >
                  {saved
                    ? <><FiCheck className="w-4 h-4" /> Saved!</>
                    : saving
                      ? <><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Saving…</>
                      : <><FiCheck className="w-4 h-4" /> Save Changes</>}
                </button>
              </>
            )
          ) : (
            <>
              {onSave && (
                <button
                  onClick={() => setEditing(true)}
                  className="flex-1 flex items-center justify-center gap-2 bg-slate-900 text-white font-black py-2.5 rounded hover:bg-slate-700 transition text-sm active:scale-95"
                >
                  <FiEdit2 className="w-4 h-4" /> Edit Student
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => { onClose(); onDelete(student.id); }}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-rose-50 text-rose-600 border border-rose-100 font-black text-sm hover:bg-rose-600 hover:text-white transition active:scale-95"
                >
                  <FiTrash2 className="w-4 h-4" /> Delete
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Desktop WebRTC camera modal */}
      {cameraOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-sm">Capture Photo</h3>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => startCamera(facingModeRef.current === 'user' ? 'environment' : 'user')}
                  className="w-8 h-8 rounded flex items-center justify-center text-slate-500 hover:bg-slate-100 transition"
                  title="Flip camera"
                >
                  <MdFlipCameraAndroid className="w-5 h-5" />
                </button>
                <button type="button" onClick={stopCamera} className="w-8 h-8 rounded flex items-center justify-center text-slate-400 hover:bg-slate-100 transition">
                  <FiX className="w-4 h-4" />
                </button>
              </div>
            </div>
            <video ref={videoRef} autoPlay playsInline muted className="w-full aspect-square object-cover bg-black" />
            <div className="p-4">
              <button
                type="button"
                onClick={capturePhoto}
                className="w-full py-2.5 rounded bg-slate-900 text-white text-sm font-black hover:bg-slate-700 transition flex items-center justify-center gap-2 active:scale-95"
              >
                <FiCamera className="w-4 h-4" /> Take Photo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Crop modal — for both upload and capture */}
      {cropSource && (
        <CropModal
          src={cropSource}
          onConfirm={cropped => { setCropSource(null); setPhoto(cropped); }}
          onCancel={() => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const MAX = 400;
              let { width, height } = img;
              if (width > height) { if (width > MAX) { height = Math.round(height * MAX / width); width = MAX; } }
              else { if (height > MAX) { width = Math.round(width * MAX / height); height = MAX; } }
              canvas.width = width; canvas.height = height;
              canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
              setPhoto(canvas.toDataURL('image/png'));
            };
            img.src = cropSource;
            setCropSource(null);
          }}
        />
      )}

      <style jsx global>{`
        @keyframes scaleUp {
          from { opacity: 0; transform: scale(0.98) translateY(10px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
        .animate-scale-up { animation: scaleUp 0.3s cubic-bezier(0.16,1,0.3,1) forwards; }
        @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in   { animation: fadeIn 0.2s ease-out forwards; }
      `}</style>
    </div>
  );
}
