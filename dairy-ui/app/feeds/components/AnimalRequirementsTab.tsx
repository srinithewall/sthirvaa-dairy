import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Activity, Droplet, ListPlus } from 'lucide-react';

export default function AnimalRequirementsTab() {
  const [requirements, setRequirements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReqs();
  }, []);

  const fetchReqs = async () => {
    try {
      const res = await api.get('/animal-requirements');
      setRequirements(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-text">Animal Nutritional Requirements</h2>
        <p className="text-[13px] text-text3">Baseline standard requirements per stage based on NDDB/ICAR guidelines.</p>
      </div>
      
      {loading ? (
        <div className="p-8 text-center text-text3 text-[13px]">Loading requirements...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
          {requirements.map((req, i) => (
            <div key={i} className="bg-surface rounded-xl border border-border-custom p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#E8F5EE] flex items-center justify-center text-brand">
                  <ListPlus size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-[15px]">{req.animalStage}</h3>
                  <p className="text-[11px] text-text3">Requirement Profile</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center text-[13px]">
                  <span className="flex items-center gap-2 text-text2"><Activity size={14} className="text-brand"/> DMI</span>
                  <span className="font-bold font-mono">{req.dryMatterIntake || '-'} kg</span>
                </div>
                <div className="flex justify-between items-center text-[13px]">
                  <span className="flex items-center gap-2 text-text2"><Activity size={14} className="text-accent"/> Crude Protein</span>
                  <span className="font-bold font-mono">{req.crudeProteinReq || '-'} kg</span>
                </div>
                <div className="flex justify-between items-center text-[13px]">
                  <span className="flex items-center gap-2 text-text2"><Activity size={14} className="text-green-600"/> TDN</span>
                  <span className="font-bold font-mono">{req.tdnReq || '-'} kg</span>
                </div>
                <div className="flex justify-between items-center text-[13px]">
                  <span className="flex items-center gap-2 text-text2"><Droplet size={14} className="text-blue-500"/> Calcium</span>
                  <span className="font-bold font-mono">{req.calciumReq || '-'} g</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
