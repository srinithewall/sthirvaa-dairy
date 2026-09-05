import React, { useState, useEffect } from "react";
import api from "@/lib/api";
import { Activity, Plus, Calculator, Calendar } from "lucide-react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface WeightTrackerProps {
  herdId: number;
}

export default function WeightTracker({ herdId }: WeightTrackerProps) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  const [girth, setGirth] = useState<string>("");
  const [length, setLength] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    fetchHistory();
  }, [herdId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/herds/${herdId}/weight`);
      setHistory(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const g = parseFloat(girth);
      const l = parseFloat(length || "0");
      // Calculate weight locally for preview or just send to server if server does it.
      // Wait, server expects weightKg in HerdWeightRecord. Let's do Schaeffer here:
      const weightKg = (g * g * l) / 10830.0;

      await api.post(`/herds/${herdId}/weight`, {
        recordDate: date,
        measurementMethod: "HEART_GIRTH_TAPE",
        heartGirthCm: g,
        bodyLengthCm: l,
        weightKg: Math.round(weightKg * 10) / 10
      });
      setShowForm(false);
      setGirth("");
      setLength("");
      fetchHistory();
    } catch (err) {
      alert("Failed to save weight record");
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading weight history...</div>;

  const chartData = {
    labels: [...history].reverse().map(h => new Date(h.recordDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })),
    datasets: [
      {
        label: "Weight (kg)",
        data: [...history].reverse().map(h => h.weightKg),
        borderColor: "#059669",
        backgroundColor: "#059669",
        tension: 0.3,
      }
    ]
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Activity className="text-emerald-600" /> 15-Day Weight Tracking
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1 hover:bg-emerald-700"
        >
          <Plus size={16} /> Record Weight
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Date</label>
              <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full border border-slate-200 rounded-lg p-2 text-sm bg-slate-50" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Heart Girth (cm)</label>
              <input type="number" step="0.1" required value={girth} onChange={e => setGirth(e.target.value)} placeholder="e.g. 150" className="w-full border border-slate-200 rounded-lg p-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Body Length (cm)</label>
              <input type="number" step="0.1" required value={length} onChange={e => setLength(e.target.value)} placeholder="e.g. 130" className="w-full border border-slate-200 rounded-lg p-2 text-sm" />
            </div>
          </div>
          
          {girth && length && (
            <div className="bg-emerald-50 p-3 rounded-lg flex items-center justify-between border border-emerald-100">
              <span className="text-emerald-800 text-sm flex items-center gap-2"><Calculator size={16} /> Estimated Weight (Schaeffer)</span>
              <span className="font-bold text-emerald-700">{Math.round((parseFloat(girth) * parseFloat(girth) * parseFloat(length)) / 10830.0 * 10) / 10} kg</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-semibold text-slate-500">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700">Save Record</button>
          </div>
        </form>
      )}

      {history.length > 0 && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm h-64">
          <Line
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: { y: { min: 0 } }
            }}
          />
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider">History</h3>
        {history.map((h, i) => (
          <div key={h.id} className="bg-white p-3 md:p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-slate-100 p-2 rounded-lg text-slate-500">
                <Calendar size={18} />
              </div>
              <div>
                <div className="font-semibold text-slate-800 text-sm">
                  {new Date(h.recordDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </div>
                <div className="text-xs text-slate-500">Tape Method: {h.heartGirthCm}cm Girth</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold text-emerald-600">{h.weightKg} kg</div>
              {h.weightChangeKg !== null && h.weightChangeKg !== 0 && (
                <div className={`text-xs font-semibold ${h.weightChangeKg > 0 ? "text-emerald-500" : "text-red-500"}`}>
                  {h.weightChangeKg > 0 ? "+" : ""}{h.weightChangeKg} kg
                </div>
              )}
            </div>
          </div>
        ))}
        {history.length === 0 && <p className="text-sm text-slate-500">No weight records found.</p>}
      </div>
    </div>
  );
}
