import React, { useState, useEffect } from 'react';
import api from '@/lib/api';

export default function NutritionTab() {
  const [feeds, setFeeds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    fetchFeeds();
  }, []);

  const fetchFeeds = async () => {
    try {
      const res = await api.get('/feeds');
      setFeeds(res.data);
    } catch (err) {
      console.error('Failed to fetch nutrition data', err);
    } finally {
      setLoading(false);
    }
  };

  const [sortField, setSortField] = useState<string>('feedName');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const getStatusColor = (val: number, type: 'CP'|'TDN'|'Ca') => {
    if (val == null) return 'text-text3';
    if (type === 'CP') {
      if (val >= 16) return 'text-green-600 font-bold';
      if (val >= 10) return 'text-amber-600 font-bold';
      return 'text-red-600 font-bold';
    }
    return 'text-text2';
  };

  const filteredFeeds = feeds.filter(f => {
    const feed = f.feed || {};
    const nut = f.nutrition || {};
    
    // Check all active filters
    for (const [key, value] of Object.entries(filters)) {
      if (!value) continue;
      
      const searchStr = value.toLowerCase();
      let itemVal = feed[key] !== undefined ? feed[key] : nut[key];
      
      if (itemVal == null) return false;
      if (String(itemVal).toLowerCase().indexOf(searchStr) === -1) {
        return false;
      }
    }
    return true;
  });

  const sortedFeeds = [...filteredFeeds].sort((a, b) => {
    let aVal = a.feed && a.feed[sortField] !== undefined ? a.feed[sortField] : (a.nutrition ? a.nutrition[sortField] : null);
    let bVal = b.feed && b.feed[sortField] !== undefined ? b.feed[sortField] : (b.nutrition ? b.nutrition[sortField] : null);
    
    if (typeof aVal === 'string') aVal = aVal.toLowerCase();
    if (typeof bVal === 'string') bVal = bVal.toLowerCase();
    
    if (aVal == null && bVal != null) return sortDir === 'asc' ? -1 : 1;
    if (aVal != null && bVal == null) return sortDir === 'asc' ? 1 : -1;
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header removed as requested */}
      
      <div className="flex-1 overflow-auto bg-surface rounded-xl border border-border-custom shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-text3 text-[13px]">Loading nutrition data...</div>
        ) : (
          <table className="w-full text-left text-[13px]">
            <thead className="bg-[#F5F9F6] text-text2 font-bold uppercase tracking-wider text-[11px] sticky top-0 shadow-sm border-b border-border-custom">
              <tr>
                {['feedName', 'category', 'primaryNutrient', 'nutritionRating', 'dryMatterPct', 'crudeProteinPct', 'tdnPct', 'calciumPct'].map(field => {
                  const labels: Record<string, string> = {
                    feedName: 'Feed Name', category: 'Category', primaryNutrient: 'Primary Nutrient',
                    nutritionRating: 'Rating', dryMatterPct: 'DM %', crudeProteinPct: 'CP %', tdnPct: 'TDN %', calciumPct: 'Calcium %'
                  };
                  return (
                    <th key={field} className="p-2 align-top">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <div className="cursor-pointer hover:bg-black/5 flex-shrink-0" onClick={() => handleSort(field)}>
                          {labels[field]} {sortField === field && (sortDir === 'asc' ? '↑' : '↓')}
                        </div>
                        <div className="relative flex-1 min-w-[50px] max-w-[80px]">
                          <select 
                            value={filters[field] || ''} 
                            onChange={(e) => handleFilterChange(field, e.target.value)} 
                            onClick={(e) => e.stopPropagation()}
                            className="w-full px-1 py-0.5 text-[10px] font-normal border border-border-custom rounded bg-white focus:outline-none focus:ring-1 focus:ring-brand appearance-none"
                          >
                            <option value="">All</option>
                            {Array.from(new Set(feeds.map(f => {
                              return f.feed && f.feed[field] !== undefined ? f.feed[field] : (f.nutrition ? f.nutrition[field] : null);
                            }).filter(Boolean))).sort().map((val: any) => (
                              <option key={val} value={String(val)}>{String(val)}</option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 text-text3">
                            <svg className="w-2 h-2 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                          </div>
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-custom/50">
              {sortedFeeds.map((f, i) => {
                const feed = f.feed || {};
                const nut = f.nutrition || {};
                return (
                  <tr key={feed.id || i} className="hover:bg-surface2 transition-colors">
                    <td className="p-3 font-bold text-text">{feed.feedName || '-'}</td>
                    <td className="p-3 text-[11px]"><span className="bg-brand/10 text-brand px-2 py-1 rounded-full font-semibold">{feed.category || '-'}</span></td>
                    <td className="p-3 font-semibold text-text2">{nut.primaryNutrient || '-'}</td>
                    <td className="p-3">
                      {nut.nutritionRating ? (
                        <span className={`px-2 py-1 rounded text-[10px] uppercase tracking-wider ${
                          nut.nutritionRating.toLowerCase().includes('very high') ? 'bg-green-100 text-green-700 font-bold' :
                          nut.nutritionRating.toLowerCase().includes('high') ? 'bg-green-50 text-green-600' :
                          nut.nutritionRating.toLowerCase().includes('low') ? 'bg-red-50 text-red-600' :
                          'bg-amber-50 text-amber-600'
                        }`}>
                          {nut.nutritionRating}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="p-3 font-mono">{nut.dryMatterPct ? nut.dryMatterPct + '%' : '-'}</td>
                    <td className={`p-3 font-mono ${getStatusColor(nut.crudeProteinPct, 'CP')}`}>{nut.crudeProteinPct ? nut.crudeProteinPct + '%' : '-'}</td>
                    <td className="p-3 font-mono">{nut.tdnPct ? nut.tdnPct + '%' : '-'}</td>
                    <td className="p-3 font-mono">{nut.calciumPct ? nut.calciumPct + '%' : '-'}</td>
                  </tr>
                );
              })}
              {sortedFeeds.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-text3 italic">No feeds found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
