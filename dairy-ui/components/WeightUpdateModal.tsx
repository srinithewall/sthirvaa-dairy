import React, { useState } from "react";
import { X, Save, SkipForward, Calculator } from "lucide-react";
import api from "@/lib/api";

export interface AnimalWeightTarget {
  herdId: number;
  animalName?: string;
  tagNumber?: string;
  breed?: string;
  animalStatus?: string;
  lastWeightKg?: number | null;
  lastRecordDate?: string | null;
  daysSinceLastRecord?: number | null;
}

interface WeightUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  animals: AnimalWeightTarget[];
  onComplete: () => void;
  logId?: string | null;
}

export default function WeightUpdateModal({ isOpen, onClose, animals, onComplete, logId }: WeightUpdateModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [girth, setGirth] = useState("");
  const [length, setLength] = useState("");
  // "tape" = heart girth (weight worked out), "scale" = net weight typed in directly
  const [mode, setMode] = useState<"tape" | "scale">("tape");
  const [netWeight, setNetWeight] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || animals.length === 0) return null;

  const currentAnimal = animals[currentIndex];
  const isLast = currentIndex === animals.length - 1;

  // Calculate weight
  const calcW = (() => {
    const g = parseFloat(girth);
    const l = length ? parseFloat(length) : null;
    if (!g || isNaN(g)) return null;
    return l ? (g * g * l) / 10838 : (g * g * (g * 0.85)) / 10838;
  })();
  const scaleW = (() => {
    const w = parseFloat(netWeight);
    return w > 0 ? w : null;
  })();
  const newWeight = mode === "scale" ? scaleW : calcW;

  // The method choice stays for the next animal; only the readings clear.
  const resetForm = () => {
    setGirth("");
    setLength("");
    setNetWeight("");
    setError("");
  };

  const handleNext = () => {
    if (isLast) {
      onComplete();
      onClose();
    } else {
      setCurrentIndex(currentIndex + 1);
      resetForm();
    }
  };

  const handleSkip = () => {
    handleNext();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "scale" ? !scaleW : (!girth || isNaN(parseFloat(girth)))) {
      setError(mode === "scale" ? "Net weight is required." : "Heart girth is required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const recordDate = new Date().toISOString().split("T")[0];

      let reading;
      if (mode === "scale") {
        reading = { measurementMethod: "SCALE", heartGirthCm: null, bodyLengthCm: null, weightKg: parseFloat(scaleW!.toFixed(2)) };
      } else {
        const g = parseFloat(girth);
        const l = length ? parseFloat(length) : null;
        const weightKg = l ? (g * g * l) / 10838 : (g * g * (g * 0.85)) / 10838;
        reading = { measurementMethod: "HEART_GIRTH_TAPE", heartGirthCm: g, bodyLengthCm: l, weightKg: parseFloat(weightKg.toFixed(2)) };
      }

      const payload = [{ herdId: currentAnimal.herdId, recordDate, ...reading }];

      const query = logId ? `?logId=${logId}&date=${recordDate}` : `?date=${recordDate}`;
      await api.post(`/herds/weight/bulk${query}`, payload);

      handleNext();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to save reading.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-full">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-surface/50">
          <div>
            <h2 className="font-bold text-text text-lg tracking-tight">Record Weight</h2>
            {animals.length > 1 && (
              <p className="text-xs font-semibold text-brand tracking-wider uppercase mt-0.5">
                Animal {currentIndex + 1} of {animals.length}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-2 text-text3 hover:text-text hover:bg-slate-200/50 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 overflow-y-auto">
          {/* Animal Info Card */}
          <div className="mb-6 text-center">
            <div className="w-16 h-16 mx-auto bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-2xl font-black mb-3">
              {(currentAnimal.animalName || currentAnimal.tagNumber || "#")[0].toUpperCase()}
            </div>
            <h3 className="text-xl font-bold text-slate-800">
              {currentAnimal.animalName || currentAnimal.tagNumber || `#${currentAnimal.herdId}`}
            </h3>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mt-1">
              {[currentAnimal.breed, currentAnimal.animalStatus].filter(Boolean).join(" · ")}
            </p>
            <div className="inline-flex items-center gap-1.5 mt-3 bg-slate-100 px-3 py-1.5 rounded-full text-xs font-semibold text-slate-600">
              <span className="opacity-70">Last Weight:</span>
              <span className="text-slate-800 font-bold">{currentAnimal.lastWeightKg ? `${currentAnimal.lastWeightKg.toFixed(1)} kg` : "--"}</span>
              <span className="opacity-70 font-normal">({currentAnimal.daysSinceLastRecord != null ? (currentAnimal.daysSinceLastRecord === 0 ? "today" : `${currentAnimal.daysSinceLastRecord}d ago`) : "never"})</span>
            </div>
          </div>

          <form id="weight-form" onSubmit={handleSave} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl font-medium">
                {error}
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
              {([["tape", "Heart girth tape"], ["scale", "Net weight (scale)"]] as const).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); setError(""); }}
                  className={`py-2 rounded-lg text-xs font-bold transition-colors ${mode === m ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === "tape" ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Heart Girth (cm) *</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    required
                    value={girth}
                    onChange={e => setGirth(e.target.value)}
                    className="w-full border-2 border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 rounded-xl p-3 text-lg font-bold text-center transition-all outline-none"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Body Length (cm)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    value={length}
                    onChange={e => setLength(e.target.value)}
                    className="w-full border-2 border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 rounded-xl p-3 text-lg font-bold text-center transition-all outline-none"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Net Weight (kg) *</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0.1"
                  required
                  value={netWeight}
                  onChange={e => setNetWeight(e.target.value)}
                  className="w-full border-2 border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 rounded-xl p-3 text-lg font-bold text-center transition-all outline-none"
                  autoFocus
                />
              </div>
            )}

            {mode === "tape" && (
              <div className={`mt-2 p-4 rounded-xl border-2 flex items-center justify-between transition-colors ${newWeight ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                 <span className={`text-sm font-bold flex items-center gap-2 ${newWeight ? 'text-emerald-800' : 'text-slate-400'}`}>
                    <Calculator size={18} />
                    New Weight
                 </span>
                 <div className={`text-2xl font-black ${newWeight ? 'text-emerald-600' : 'text-slate-300'}`}>
                    {newWeight ? newWeight.toFixed(1) : "--"} <span className="text-sm font-bold opacity-70">kg</span>
                 </div>
              </div>
            )}
          </form>
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-border bg-surface/30 flex items-center gap-3">
          {animals.length > 1 && (
            <button
              type="button"
              onClick={handleSkip}
              className="flex-1 py-3 px-4 flex items-center justify-center gap-2 font-bold text-slate-500 bg-white border-2 border-slate-200 hover:bg-slate-50 rounded-xl transition-colors"
            >
              Skip <SkipForward size={18} />
            </button>
          )}
          <button
            type="submit"
            form="weight-form"
            disabled={saving || !newWeight}
            className="flex-[2] py-3 px-4 flex items-center justify-center gap-2 font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-emerald-600 rounded-xl shadow-md shadow-emerald-600/20 transition-all"
          >
            {saving ? "Saving..." : (
              <>
                <Save size={18} /> {isLast ? "Save" : "Save & Next"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
