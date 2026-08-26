import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Calculator, Plus, Trash2, AlertCircle } from 'lucide-react';

export default function FeedOptimizerTab() {
  const [animalStage, setAnimalStage] = useState('');
  const [stages, setStages] = useState<string[]>([]);
  const [feeds, setFeeds] = useState<any[]>([]);
  
  const [entries, setEntries] = useState([{ feedId: '', quantityKg: '' }]);
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const reqRes = await api.get('/animal-requirements');
      setStages(reqRes.data.map((r: any) => r.animalStage));
      
      const feedRes = await api.get('/feeds');
      setFeeds(feedRes.data.map((d: any) => d.feed || d));
    } catch (err) {
      console.error(err);
    }
  };

  const handleCalculate = async () => {
    if (!animalStage) return alert('Select an animal stage');
    
    setLoading(true);
    try {
      const payload = {
        animalStage,
        feedEntries: entries.map(e => ({
          feedId: e.feedId ? parseInt(e.feedId) : null,
          quantityKg: e.quantityKg ? parseFloat(e.quantityKg) : null
        })).filter(e => e.feedId && e.quantityKg)
      };
      
      const res = await api.post('/feeds/optimize', payload);
      setResults(res.data);
    } catch (err) {
      console.error(err);
      alert('Error calculating ration.');
    } finally {
      setLoading(false);
    }
  };

  const updateEntry = (index: number, field: string, value: string) => {
    const newEntries = [...entries];
    newEntries[index] = { ...newEntries[index], [field]: value };
    setEntries(newEntries);
  };

  const addEntry = () => {
    if (entries.length < 20) {
      setEntries([...entries, { feedId: '', quantityKg: '' }]);
    }
  };

  const removeEntry = (index: number) => {
    const newEntries = [...entries];
    newEntries.splice(index, 1);
    setEntries(newEntries);
  };

  return (
    <div className="flex flex-col h-full lg:flex-row gap-6">
      {/* Left Panel - Inputs */}
      <div className="flex-1 space-y-6">
        <div className="bg-surface rounded-xl border border-border-custom p-5 shadow-sm">
          <h3 className="text-[14px] font-bold mb-4 flex items-center gap-2">
            <CowIcon /> Animal Profile
          </h3>
          <div>
            <label className="block text-[11px] font-bold text-text2 uppercase tracking-wide mb-1">
              Target Stage
            </label>
            <select 
              value={animalStage}
              onChange={(e) => setAnimalStage(e.target.value)}
              className="w-full border border-border-custom rounded-xl p-2.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-brand bg-white"
            >
              <option value="">Select Stage...</option>
              {stages.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="bg-surface rounded-xl border border-border-custom p-5 shadow-sm">
          <h3 className="text-[14px] font-bold mb-4 flex items-center justify-between">
            <span className="flex items-center gap-2"><LeafIcon /> Feed Selection</span>
            <span className="text-[11px] font-normal text-text3">{entries.length}/20 Slots</span>
          </h3>
          
          <div className="space-y-3 mb-4">
            {entries.map((entry, i) => (
              <div key={i} className="flex items-center gap-2">
                <select 
                  value={entry.feedId}
                  onChange={(e) => updateEntry(i, 'feedId', e.target.value)}
                  className="flex-1 border border-border-custom rounded-xl p-2 text-[12px] focus:outline-none focus:ring-1 focus:ring-brand bg-white"
                >
                  <option value="">Select Feed...</option>
                  {feeds.map(f => <option key={f.id} value={f.id}>{f.feedName} ({f.category})</option>)}
                </select>
                <input 
                  type="number"
                  placeholder="kg"
                  value={entry.quantityKg}
                  onChange={(e) => updateEntry(i, 'quantityKg', e.target.value)}
                  className="w-20 border border-border-custom rounded-xl p-2 text-[12px] focus:outline-none focus:ring-1 focus:ring-brand"
                />
                <button 
                  onClick={() => removeEntry(i)}
                  className="p-2 text-danger hover:bg-danger/10 rounded-lg transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button 
              onClick={addEntry}
              className="flex-1 flex items-center justify-center gap-2 border border-dashed border-border-custom text-brand font-semibold py-2 rounded-xl hover:bg-surface2 transition-colors text-[12px]"
            >
              <Plus size={16} /> Add Feed
            </button>
            <button 
              onClick={handleCalculate}
              disabled={loading}
              className="flex-1 bg-brand text-white font-bold py-2 rounded-xl hover:bg-brand-dark transition-colors flex items-center justify-center gap-2 text-[12px]"
            >
              <Calculator size={16} /> 
              {loading ? 'Calculating...' : 'Calculate Ration'}
            </button>
          </div>
        </div>
      </div>

      {/* Right Panel - Results */}
      <div className="flex-[1.2] bg-surface rounded-xl border border-border-custom p-5 shadow-sm h-full overflow-y-auto">
        <h3 className="text-[15px] font-bold mb-4">Optimization Results</h3>
        
        {!results ? (
          <div className="h-48 flex flex-col items-center justify-center text-text3 italic gap-2 text-[13px]">
            <Calculator size={32} className="opacity-20" />
            <p>Select feeds and calculate to view results.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <ResultCard label="Dry Matter" actual={results.totals.DryMatter} req={results.requirements.dryMatterIntake} unit="kg" status={results.status.DryMatter} />
              <ResultCard label="Crude Protein" actual={results.totals.CrudeProtein} req={results.requirements.crudeProteinReq} unit="kg" status={results.status.CrudeProtein} />
              <ResultCard label="TDN" actual={results.totals.TDN} req={results.requirements.tdnReq} unit="kg" status={results.status.TDN} />
              <ResultCard label="Calcium" actual={results.totals.Calcium} req={results.requirements.calciumReq} unit="g" status={results.status.Calcium} />
            </div>

            {results.recommendations.length > 0 && (
              <div className="bg-[#FFF8E6] border border-accent/30 rounded-xl p-4">
                <h4 className="font-bold text-[13px] flex items-center gap-2 text-accent-dark mb-2">
                  <AlertCircle size={16} /> Recommendations
                </h4>
                <ul className="space-y-1.5 pl-5 list-disc text-[12px] text-text2">
                  {results.recommendations.map((rec: string, idx: number) => (
                    <li key={idx}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const ResultCard = ({label, actual, req, unit, status}: any) => {
  const isOk = status === 'OK';
  const isDef = status === 'DEFICIENT';
  return (
    <div className={`border rounded-xl p-3 ${isOk ? 'bg-[#F5F9F6] border-green-200' : isDef ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
      <div className="text-[11px] font-bold text-text2 uppercase tracking-wide mb-2 flex justify-between">
        {label}
        <span className={isOk ? 'text-green-600' : isDef ? 'text-red-600' : 'text-amber-600'}>{status}</span>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <span className="text-xl font-bold font-mono">{Math.round(actual*100)/100}</span>
          <span className="text-[11px] text-text3 ml-1">{unit}</span>
        </div>
        <div className="text-[11px] text-text3 mb-1">
          Req: {req || '-'} {unit}
        </div>
      </div>
    </div>
  );
};

const CowIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 10v4c0 3.3 2.7 6 6 6h6c3.3 0 6-2.7 6-6v-4m-18 0l2-4m16 4l-2-4m-7 4v4"></path></svg>;
const LeafIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"></path><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"></path></svg>;
