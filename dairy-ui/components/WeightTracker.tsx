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
import WeightUpdateModal from "./WeightUpdateModal";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface WeightTrackerProps {
  herdId: number;
}

export default function WeightTracker({ herdId }: WeightTrackerProps) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

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

  // Mock basic animal details since this component only gets herdId right now.
  // The backend might return basic details in history, or we just pass the herdId.
  const animalDetails = {
    herdId: herdId,
    lastWeightKg: history.length > 0 ? history[0].weightKg : null,
    // Calculate days since last record
    daysSinceLastRecord: history.length > 0 ? 
      Math.floor((new Date().getTime() - new Date(history[0].recordDate).getTime()) / (1000 * 3600 * 24)) : null
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Activity className="text-emerald-600" /> 15-Day Weight Tracking
        </h2>
        <button
          onClick={() => setShowForm(true)}
          className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1 hover:bg-emerald-700"
        >
          <Plus size={16} /> Record Weight
        </button>
      </div>

      <WeightUpdateModal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        animals={[animalDetails]}
        onComplete={() => {
          setShowForm(false);
          fetchHistory();
        }}
      />

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
