
"use client";

import React, { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import api from "@/lib/api";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend);

export default function ReportsPage() {
  const [herds, setHerds] = useState<any[]>([]);
  const [selectedHerd, setSelectedHerd] = useState<string>("");
  const [chartData, setChartData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchHerds();
  }, []);

  useEffect(() => {
    if (selectedHerd) fetchCorrelation(selectedHerd);
  }, [selectedHerd]);

  const fetchHerds = async () => {
    try {
      const res = await api.get("/herds");
      const list = res.data.herds || res.data;
      setHerds(list.filter((h: any) => h.animalStatus === "LACTATING" || h.status === "ACTIVE"));
      if (list.length > 0) setSelectedHerd(list[0].id.toString());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCorrelation = async (herdId: string) => {
    setLoading(true);
    try {
      // We need milk records for this herd and weight records
      // In a real app we would have a dedicated endpoint, but we can fetch both and merge in UI.
      const milkRes = await api.get(`/milk-records?herdId=${herdId}`);
      const weightRes = await api.get(`/herds/${herdId}/weight`);
      
      const milkRecords = milkRes.data;
      const weightRecords = weightRes.data;

      // Group milk by month-year
      const monthlyMilk: Record<string, number> = {};
      milkRecords.forEach((m: any) => {
        const d = new Date(m.date);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
        monthlyMilk[key] = (monthlyMilk[key] || 0) + m.quantity;
      });

      // Group weight by month-year (average)
      const monthlyWeight: Record<string, { sum: number, count: number }> = {};
      weightRecords.forEach((w: any) => {
        const d = new Date(w.recordDate);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
        if (!monthlyWeight[key]) monthlyWeight[key] = { sum: 0, count: 0 };
        monthlyWeight[key].sum += w.weightKg;
        monthlyWeight[key].count += 1;
      });

      // Get all unique keys sorted
      const allKeys = Array.from(new Set([...Object.keys(monthlyMilk), ...Object.keys(monthlyWeight)])).sort();

      const labels = allKeys.map(k => {
        const [y, m] = k.split("-");
        return `${new Date(parseInt(y), parseInt(m)-1).toLocaleString("default", { month: "short" })} ${y}`;
      });

      const milkData = allKeys.map(k => monthlyMilk[k] || 0);
      const weightData = allKeys.map(k => monthlyWeight[k] ? monthlyWeight[k].sum / monthlyWeight[k].count : null);

      setChartData({
        labels,
        datasets: [
          {
            type: "bar" as const,
            label: "Milk Production (L)",
            data: milkData,
            backgroundColor: "rgba(59, 130, 246, 0.6)",
            yAxisID: "y",
          },
          {
            type: "line" as const,
            label: "Avg Weight (kg)",
            data: weightData,
            borderColor: "#10B981",
            backgroundColor: "#10B981",
            borderWidth: 2,
            tension: 0.3,
            spanGaps: true,
            yAxisID: "y1",
          }
        ]
      });

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Analytics & Reports</h1>
          <p className="text-sm text-slate-500">Correlate animal health metrics with farm productivity.</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-bold text-slate-700">Weight vs. Milk Production</h2>
            <select
              value={selectedHerd}
              onChange={(e) => setSelectedHerd(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50"
            >
              {herds.map((h) => (
                <option key={h.id} value={h.id}>{h.tagNumber} - {h.animalName || "Unnamed"}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="h-64 flex items-center justify-center text-slate-400">Loading chart data...</div>
          ) : chartData ? (
            <div className="h-80">
              <Bar
                data={chartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: { mode: "index", intersect: false },
                  scales: {
                    x: { grid: { display: false } },
                    y: {
                      type: "linear",
                      display: true,
                      position: "left",
                      title: { display: true, text: "Milk (L)" },
                    },
                    y1: {
                      type: "linear",
                      display: true,
                      position: "right",
                      title: { display: true, text: "Weight (kg)" },
                      grid: { drawOnChartArea: false },
                    }
                  }
                }}
              />
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-400">Not enough data to display.</div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

