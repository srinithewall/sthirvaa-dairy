'use client';

import React, { useState } from 'react';
import { X, Camera, ChevronDown } from 'lucide-react';
import api from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────
interface FormData {
  tagNumber: string;
  animalType: string;
  animalName: string;
  breed: string;
  milkType: string;
  healthStatus: string;
  source: string;
  birthDate: string;
  procuredDate: string;
  age: string;
  animalStatus: string;
  imageUrl: string;
}

// ─── Reusable styled select dropdown ────────
function CustomSelect({
  label,
  value,
  onChange,
  options,
  fullWidth = false,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  fullWidth?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <div className={fullWidth ? 'col-span-2' : 'col-span-1'}>
      <label className="text-[11px] font-bold text-text3 uppercase mb-2 block tracking-wider">
        {label}
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full bg-white border border-border-custom rounded-lg px-4 py-2.5 text-sm font-semibold text-left flex items-center justify-between outline-none hover:border-brand transition-colors"
        >
          <span>{selected?.label ?? 'Select…'}</span>
          <ChevronDown
            size={14}
            className={`text-text3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open && (
          <>
            {/* Backdrop to close on click-away */}
            <div
              className="fixed inset-0 z-[10]"
              onClick={() => setOpen(false)}
            />
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border-custom rounded-xl shadow-2xl z-[20] overflow-hidden">
              {options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 text-sm font-semibold transition-colors ${
                    value === opt.value
                      ? 'bg-brand text-white'
                      : 'hover:bg-surface text-text'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Field wrapper for uniform label + input ──────────────────────────────────
function Field({
  label,
  required,
  children,
  fullWidth = false,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? 'col-span-2' : 'col-span-1'}>
      <label className="text-[11px] font-bold text-text3 uppercase mb-2 block tracking-wider flex items-center gap-1">
        {label} {required && <span className="text-red-500 text-[14px] leading-none">*</span>}
      </label>
      {children}
    </div>
  );
}

const INPUT_CLS =
  'w-full bg-white border border-border-custom rounded-lg px-3 py-2.5 text-sm font-semibold outline-none focus:border-brand focus:ring-1 focus:ring-brand/10 transition-all placeholder:text-text3/50';

// ─── Main modal ───────────────────────────────────────────────────────────────
export default function RegisterAnimalModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [registering, setRegistering] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [ageYears, setAgeYears] = useState('');
  const [ageMonths, setAgeMonths] = useState('');

  const [formData, setFormData] = useState<FormData>({
    tagNumber: '',
    animalType: 'COW',
    animalName: '',
    breed: '',
    milkType: 'A2',
    healthStatus: 'HEALTHY',
    source: '',
    birthDate: '',
    procuredDate: '',
    age: '',
    animalStatus: 'HEIFER',
    imageUrl: '',
  });

  const set = (key: keyof FormData, value: string) =>
    setFormData((p) => ({ ...p, [key]: value }));

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Set immediate local preview
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);

    // Upload immediately
    setUploadingImage(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await api.post('/files/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      set('imageUrl', res.data.url);
    } catch {
      alert('Image upload failed. You can still register without the photo.');
      setImagePreview(null); // Revert preview if upload fails
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegistering(true);

    try {
      const computedAge =
        ageYears || ageMonths
          ? `${ageYears || '0'}y ${ageMonths || '0'}m`
          : formData.age;

      await api.post('/herds', {
        ...formData,
        age: computedAge,
        age: computedAge,
        birthDate: formData.birthDate || null,
        procuredDate: formData.procuredDate || null,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      
      // Handle the generic 500 error gracefully and explicitly address the likely duplicate tag situation
      const errorMsg = err.response?.data?.message || err.message;
      alert(`Registration failed.\n\nBackend Error: ${errorMsg}\n\nMost likely cause: The Tag Number you entered might already exist in the system. Try using a unique Tag Number.`);
    } finally {
      setRegistering(false);
    }
  };

  const busy = registering || uploadingImage;

  return (
    /* ── Overlay ── */
    <div
      className="fixed inset-0 z-[3000] flex items-center justify-center p-4"
      style={{ background: 'rgba(10,27,20,0.55)', backdropFilter: 'blur(6px)' }}
    >
      {/* ── Modal card: flex-col with fixed height so header stays sticky ── */}
      <div
        className="bg-white rounded-2xl shadow-2xl w-full flex flex-col"
        style={{ maxWidth: 520, maxHeight: '92vh' }}
      >
        {/* ── Sticky gradient header ── */}
        <div
          className="flex-shrink-0 flex items-start justify-between px-6 py-5 rounded-t-2xl"
          style={{ background: 'linear-gradient(135deg,#2d6a4f 0%,#1b4332 100%)' }}
        >
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight leading-tight">
              Register new animal
            </h2>
            <p className="text-xs text-white/70 mt-0.5 italic">
              Add to Sthirvaa inventory
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/25 flex items-center justify-center transition-colors text-white ml-4 flex-shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Scrollable form body ── */}
        <form
          onSubmit={handleRegisterSubmit}
          className="flex-1 overflow-y-auto px-6 py-5"
          style={{ overscrollBehavior: 'contain' }}
        >
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">

            {/* Tag Number */}
            <Field label="Tag Number" required>
              <input
                required
                value={formData.tagNumber}
                onChange={(e) => set('tagNumber', e.target.value)}
                placeholder="COW-101"
                className={INPUT_CLS}
              />
            </Field>

            {/* Animal Name */}
            <Field label="Animal Name">
              <input
                value={formData.animalName}
                onChange={(e) => set('animalName', e.target.value)}
                placeholder="e.g., Bessie"
                className={INPUT_CLS}
              />
            </Field>

            {/* Type */}
            <CustomSelect
              label="Type"
              value={formData.animalType}
              onChange={(v) => set('animalType', v)}
              options={[
                { value: 'COW', label: 'Cow' },
                { value: 'BUFFALO', label: 'Buffalo' },
                { value: 'GOAT', label: 'Goat' },
              ]}
            />

            {/* Breed */}
            <Field label="Breed">
              <input
                value={formData.breed}
                onChange={(e) => set('breed', e.target.value)}
                placeholder="e.g., Gir, Holstein"
                className={INPUT_CLS}
              />
            </Field>

            {/* Milk Type */}
            <CustomSelect
              label="Milk Type"
              value={formData.milkType}
              onChange={(v) => set('milkType', v)}
              options={[
                { value: 'A2', label: 'A2' },
                { value: 'A1', label: 'A1' },
                { value: 'Mixed', label: 'Mixed' },
              ]}
            />

            {/* Photo */}
            <Field label="Photo">
              <label 
                className={`flex items-center justify-center min-h-[50px] gap-3 border-2 border-dashed border-border-custom rounded-xl px-3 py-2 cursor-pointer hover:border-brand hover:bg-surface transition-all ${uploadingImage ? 'opacity-50 cursor-wait pointer-events-none' : ''}`}
              >
                {uploadingImage ? (
                  <div className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-brand" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-[11px] font-bold text-brand uppercase tracking-wide">Uploading...</span>
                  </div>
                ) : imagePreview ? (
                  <>
                    <img
                      src={imagePreview}
                      className="w-10 h-10 rounded-lg object-cover shadow-sm"
                      alt="preview"
                    />
                    <span className="text-[11px] font-bold text-brand uppercase tracking-wide">
                      Select Another
                    </span>
                  </>
                ) : (
                  <>
                    <Camera size={18} className="text-text3 flex-shrink-0" />
                    <span className="text-[11px] font-bold text-text3 uppercase tracking-wide">
                      Upload photo
                    </span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            </Field>

            {/* Birth Date */}
            <Field label="Birth Date">
              <input
                type="date"
                value={formData.birthDate}
                onChange={(e) => set('birthDate', e.target.value)}
                className={INPUT_CLS}
              />
            </Field>

            {/* Age — split years/months */}
            <Field label="Age">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={0}
                  max={30}
                  placeholder="Years"
                  value={ageYears}
                  className={INPUT_CLS}
                  onChange={(e) => setAgeYears(e.target.value)}
                />
                <input
                  type="number"
                  min={0}
                  max={11}
                  placeholder="Months"
                  value={ageMonths}
                  className={INPUT_CLS}
                  onChange={(e) => setAgeMonths(e.target.value)}
                />
              </div>
            </Field>

            {/* Procured Date */}
            <Field label="Procured Date">
              <input
                type="date"
                value={formData.procuredDate}
                onChange={(e) => set('procuredDate', e.target.value)}
                className={INPUT_CLS}
              />
            </Field>

            {/* Health Status */}
            <CustomSelect
              label="Health Status"
              value={formData.healthStatus}
              onChange={(v) => set('healthStatus', v)}
              options={[
                { value: 'HEALTHY', label: 'Healthy' },
                { value: 'SICK', label: 'Sick / Observation' },
              ]}
            />

            {/* Animal Status — full width, custom picker */}
            <div className="col-span-2">
              <label className="text-[11px] font-bold text-text3 uppercase mb-2 block tracking-wider">
                Animal Status
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'CALF', label: 'Calf' },
                  { value: 'HEIFER', label: 'Heifer' },
                  { value: 'PREGNANT', label: 'Pregnant' },
                  { value: 'LACTATING', label: 'Lactating' },
                  { value: 'DRY', label: 'Dry' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => set('animalStatus', opt.value)}
                    className={`px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all border ${
                      formData.animalStatus === opt.value
                        ? 'bg-brand text-white border-brand shadow-md'
                        : 'bg-white text-text3 border-border-custom hover:border-brand hover:text-brand'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="mt-6 pt-4 border-t border-border-custom">
            <button
              type="submit"
              disabled={registering || uploadingImage}
              className="w-full py-4 rounded-xl text-sm font-black uppercase tracking-widest text-white transition-all shadow-lg hover:shadow-xl hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
              style={{
                background: (registering || uploadingImage)
                  ? '#6b7280'
                  : 'linear-gradient(135deg,#2d6a4f 0%,#1b4332 100%)',
              }}
            >
              {registering ? 'Processing Data…' : uploadingImage ? 'Finishing Upload…' : 'Register Animal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
