'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { X, Sun, Moon, Calendar, MessageSquare, Droplets } from 'lucide-react';
import api from '@/lib/api';

/* ─── Types ──────────────────────────────────────────── */
interface Herd {
  id: number;
  tagNumber: string;
  animalName: string;
  breed: string;
  animalType: string;
  animalStatus: string;
}

interface CowEntry {
  herdId: number;
  tag: string;
  name: string;
  morning: string;
  evening: string;
}

const todayStr = () => new Date().toISOString().split('T')[0];
const fmt = (n: number) => n % 1 === 0 ? `${n}` : n.toFixed(1);

interface LogYieldModalProps {
  lactatingCows: Herd[];
  onClose: () => void;
  onSave: () => void;
}

export default function LogYieldModal({
  lactatingCows,
  onClose,
  onSave,
}: LogYieldModalProps) {
  const [date, setDate] = useState(todayStr());
  const [entries, setEntries] = useState<CowEntry[]>([]);
  const [comments, setComments] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEntries(
      lactatingCows.map((h) => ({
        herdId: h.id,
        tag: h.tagNumber,
        name: h.animalName || h.tagNumber,
        morning: '',
        evening: '',
      }))
    );
  }, [lactatingCows]);

  const update = (idx: number, shift: 'morning' | 'evening', val: string) => {
    setEntries((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [shift]: val };
      return copy;
    });
  };

  const totalYield = useMemo(() => {
    return entries.reduce((sum, e) => {
      const m = parseFloat(e.morning) || 0;
      const ev = parseFloat(e.evening) || 0;
      return sum + m + ev;
    }, 0);
  }, [entries]);

  const handleSubmit = async () => {
    if (!date) return alert('Please pick a date.');
    const batch: any[] = [];
    entries.forEach((e) => {
      if (parseFloat(e.morning) > 0)
        batch.push({ herdId: e.herdId, date, shift: 'MORNING', quantity: parseFloat(e.morning) });
      if (parseFloat(e.evening) > 0)
        batch.push({ herdId: e.herdId, date, shift: 'EVENING', quantity: parseFloat(e.evening) });
    });

    if (batch.length === 0) return alert('Please enter at least one yield value.');

    setSaving(true);
    try {
      await api.post('/milk-records/batch', batch);
      onSave();
      onClose();
    } catch (err: any) {
      alert(`Failed to save: ${err.response?.data?.message || err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[2000] flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
        
        {/* Compact Header */}
        <div className="px-5 py-3.5 flex items-center justify-between"
             style={{ background: 'linear-gradient(135deg, #2d6a4f 0%, #1b4332 100%)' }}>
          <div>
            <h2 className="text-[15px] font-black text-white tracking-tight uppercase">Log Milk Yield</h2>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        {/* Action Bar: Date + Total Yield + Comment Button */}
        <div className="px-5 py-3 border-b border-border-custom bg-surface/50 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3 bg-white border border-border-custom px-3 py-1.5 rounded-xl shadow-sm">
            <Calendar size={13} className="text-brand" />
            <span className="text-[10px] font-black text-text3 uppercase tracking-widest border-r pr-3 border-border-custom">Date</span>
            <input
              type="date"
              value={date}
              max={todayStr()}
              onChange={(e) => setDate(e.target.value)}
              className="text-[12px] font-bold text-text bg-transparent focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-3">
             {/* Dynamic Total Yield Display */}
             <div className="flex items-center gap-2 bg-brand text-white px-4 py-1.5 rounded-xl shadow-md border border-brand-dark/20">
                <Droplets size={14} />
                <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Total</span>
                <span className="text-[14px] font-black tabular-nums">{fmt(totalYield)}L</span>
             </div>

             <button 
                onClick={() => setShowComments(!showComments)}
                className={`p-1.5 rounded-lg border transition-all ${showComments ? 'bg-brand text-white border-brand' : 'bg-white text-text3 border-border-custom hover:border-brand hover:text-brand'}`}
                title="Add comments"
             >
                <MessageSquare size={16} />
             </button>
          </div>
        </div>

        {/* Optional Comments Textarea (Only height needed when visible) */}
        {showComments && (
          <div className="px-5 py-3 bg-surface border-b border-border-custom animate-in slide-in-from-top-2 duration-200">
            <textarea
              rows={2}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Enter notes (medication, health, etc.)..."
              className="w-full border border-border-custom rounded-xl px-4 py-2.5 text-[12px] text-text bg-white placeholder:text-text3 focus:outline-none focus:ring-1 focus:ring-brand resize-none"
              autoFocus
            />
          </div>
        )}

        {/* High Density Table */}
        <div className="flex-1 overflow-y-auto max-h-[400px]">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-white shadow-sm z-10 border-b border-border-custom">
              <tr>
                <th className="text-left px-5 py-2.5 text-[9px] font-black text-text3 uppercase tracking-[0.15em] bg-surface/80">Cow Identity</th>
                <th className="text-center px-1 py-2.5 bg-amber-50/50">
                  <div className="flex items-center justify-center gap-1.5 text-amber-600">
                    <Sun size={10} strokeWidth={3} /> <span className="text-[9px] font-black uppercase tracking-wider">Morning</span>
                  </div>
                </th>
                <th className="text-center px-1 py-2.5 bg-indigo-50/50">
                  <div className="flex items-center justify-center gap-1.5 text-indigo-600">
                    <Moon size={10} strokeWidth={3} /> <span className="text-[9px] font-black uppercase tracking-wider">Evening</span>
                  </div>
                </th>
                <th className="text-right px-5 py-2.5 text-[9px] font-black text-brand uppercase tracking-[0.15em] bg-surface/80">Total</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-text3 text-[12px] italic">No lactating cows found.</td>
                </tr>
              ) : (
                entries.map((entry, idx) => {
                  const rowTotal = (parseFloat(entry.morning) || 0) + (parseFloat(entry.evening) || 0);
                  return (
                    <tr key={entry.herdId} className="border-b border-border-custom/30 hover:bg-surface/30 transition-colors">
                      <td className="px-5 py-2">
                        <div className="font-bold text-text text-[12px]">{entry.name}</div>
                        <div className="text-[9px] text-text3 font-mono opacity-80">{entry.tag}</div>
                      </td>
                      <td className="px-1 py-2">
                        <div className="flex items-center gap-1 justify-center">
                          <input
                            type="number" step="0.1" value={entry.morning}
                            onChange={(e) => update(idx, 'morning', e.target.value)}
                            placeholder="0.0"
                            className="w-16 text-center border border-border-custom rounded-lg px-1.5 py-1 text-[12px] font-bold text-text focus:outline-none focus:ring-1 focus:ring-amber-400"
                          />
                        </div>
                      </td>
                      <td className="px-1 py-2">
                        <div className="flex items-center gap-1 justify-center">
                          <input
                            type="number" step="0.1" value={entry.evening}
                            onChange={(e) => update(idx, 'evening', e.target.value)}
                            placeholder="0.0"
                            className="w-16 text-center border border-border-custom rounded-lg px-1.5 py-1 text-[12px] font-bold text-text focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          />
                        </div>
                      </td>
                      <td className="px-5 py-2 text-right">
                        <span className={`font-black text-[12px] ${rowTotal > 0 ? 'text-brand-dark' : 'text-text3 opacity-30'}`}>
                          {rowTotal > 0 ? `${fmt(rowTotal)}L` : '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Clean Footer */}
        <div className="px-5 py-4 border-t border-border-custom bg-surface/20 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest border border-border-custom text-text3 hover:bg-white transition-all shadow-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-2 py-3 px-10 rounded-xl font-black text-[11px] uppercase tracking-widest text-white shadow-lg hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#2d6a4f 0%,#1b4332 100%)' }}
            >
              {saving ? 'Saving Data…' : 'Log Yield Now'}
            </button>
        </div>
      </div>
    </div>
  );
}
