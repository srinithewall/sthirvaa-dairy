import React, { useState, useMemo } from 'react';
import api from '@/lib/api';
import { Search, Download, Image as ImageIcon, Check } from 'lucide-react';

interface Props {
  /** Raw { feed, nutrition, knowledge } rows, owned by the page and shared across tabs. */
  feeds: any[];
  loading: boolean;
  onRefresh: () => void | Promise<void>;
}

export default function FeedMasterTab({ feeds: feedRows, loading, onRefresh }: Props) {
  const [search, setSearch] = useState('');
  const [selectedFeedId, setSelectedFeedId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState<any>(null);

  const feeds = useMemo(() => (feedRows || []).map((d: any) => d.feed || d), [feedRows]);

  const handleExport = async () => {
    try {
      const res = await api.get('/feeds/export/csv', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'feeds.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to export CSV', err);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, feedId: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fd = new FormData();
    fd.append('file', file);

    try {
      await api.post(`/feeds/${feedId}/image`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      alert('Image uploaded successfully!');
      onRefresh();
    } catch (err) {
      console.error('Failed to upload image', err);
      alert('Failed to upload image.');
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

  const filteredFeeds = feeds.filter(f => 
    f && (f.feedName?.toLowerCase().includes(search.toLowerCase()) || 
    f.category?.toLowerCase().includes(search.toLowerCase()))
  ).sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];
    if (typeof aVal === 'string') aVal = aVal.toLowerCase();
    if (typeof bVal === 'string') bVal = bVal.toLowerCase();
    
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto bg-surface rounded-xl border border-border-custom shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-text3 text-[13px]">Loading feeds...</div>
        ) : (
          <>
            {/* Desktop Table View */}
            <table className="hidden md:table w-full text-left text-[13px]">
              <thead className="bg-[#F5F9F6] text-text2 font-bold uppercase tracking-wider text-[11px] sticky top-0 z-10 shadow-sm border-b border-border-custom">
                <tr>
                  <th className="p-2 w-64 align-top">
                    <div className="flex items-center justify-between gap-2">
                      <div className="cursor-pointer hover:bg-black/5 flex-shrink-0" onClick={() => handleSort('feedName')}>
                        Feed Name {sortField === 'feedName' && (sortDir === 'asc' ? '↑' : '↓')}
                      </div>
                      <div className="relative flex-1 max-w-[120px]">
                        <Search size={12} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-text3" />
                        <input 
                          type="text" 
                          placeholder="Search..." 
                          value={search} 
                          onChange={(e) => setSearch(e.target.value)} 
                          onClick={(e) => e.stopPropagation()}
                          className="w-full pl-5 pr-1 py-0.5 text-[10px] font-normal border border-border-custom rounded bg-white focus:outline-none focus:ring-1 focus:ring-brand"
                        />
                      </div>
                    </div>
                  </th>
                  <th className="p-2 cursor-pointer hover:bg-black/5 align-top" onClick={() => handleSort('category')}>
                    Category {sortField === 'category' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="p-2 cursor-pointer hover:bg-black/5 align-top" onClick={() => handleSort('scientificName')}>
                    Scientific Name {sortField === 'scientificName' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="p-2 cursor-pointer hover:bg-black/5 align-top" onClick={() => handleSort('costRating')}>
                    Growing Cost {sortField === 'costRating' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="p-2 cursor-pointer hover:bg-black/5 align-top" onClick={() => handleSort('palatabilityRating')}>
                    Palatability {sortField === 'palatabilityRating' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="p-2 align-top">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-custom/50">
                {filteredFeeds.map(feed => (
                  <tr key={feed.id} className="hover:bg-surface2 transition-colors group">
                    <td className="p-2 py-1.5">
                      <div className="font-bold text-text">{feed.feedName}</div>
                    </td>
                    <td className="p-2 py-1.5">
                      <span className="bg-brand/10 text-brand font-semibold px-2 py-0.5 rounded-full text-[11px]">
                        {feed.category}
                      </span>
                    </td>
                    <td className="p-2 py-1.5 italic text-text2">
                      {feed.scientificName || '-'}
                    </td>
                    <td className="p-2 py-1.5 font-semibold">
                      {feed.costRating ? (
                        <span className={`px-2 py-1 rounded text-[10px] uppercase tracking-wider ${
                          feed.costRating.toLowerCase().includes('high') ? 'bg-red-50 text-red-600' :
                          feed.costRating.toLowerCase().includes('low') ? 'bg-green-50 text-green-600' :
                          'bg-amber-50 text-amber-600'
                        }`}>
                          {feed.costRating}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="p-2 py-1.5">
                      <div className="flex gap-1">
                        {[1,2,3,4,5].map(star => (
                          <span key={star} className={`text-[14px] ${star <= (feed.palatabilityRating || 0) ? 'text-accent' : 'text-gray-300'}`}>
                            ★
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-2 py-1.5">
                      <button onClick={() => setShowModal(feed)} className="text-brand font-semibold hover:underline text-[12px]">View Details</button>
                    </td>
                  </tr>
                ))}
                {filteredFeeds.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-text3 italic">No feeds found.</td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Mobile Card View */}
            <div className="md:hidden flex flex-col p-3 space-y-3 bg-surface">
              <div className="relative w-full">
                <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text3" />
                <input 
                  type="text" 
                  placeholder="Search feeds by name or category..." 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)} 
                  className="w-full pl-9 pr-3 py-2.5 text-[13px] font-normal border border-border-custom rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredFeeds.map(feed => (
                  <div key={feed.id} className="bg-white border border-border-custom rounded-xl p-3 shadow-sm flex flex-col gap-2 transition-shadow hover:shadow-md">
                    <div className="flex justify-between items-start">
                      <div className="font-bold text-text text-[14px] leading-tight">{feed.feedName}</div>
                      <span className="bg-brand/10 text-brand font-bold px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wide">
                        {feed.category}
                      </span>
                    </div>
                    <div className="text-[11px] text-text3 italic -mt-1">{feed.scientificName || 'No scientific name'}</div>
                    <div className="flex justify-between items-center mt-2 border-t border-border-custom/50 pt-2">
                      <div className="font-semibold">
                        {feed.costRating ? (
                          <span className={`px-2 py-1 rounded text-[9px] uppercase tracking-wider ${
                            feed.costRating.toLowerCase().includes('high') ? 'bg-red-50 text-red-700' :
                            feed.costRating.toLowerCase().includes('low') ? 'bg-green-50 text-green-700' :
                            'bg-amber-50 text-amber-700'
                          }`}>
                            Cost: {feed.costRating}
                          </span>
                        ) : '-'}
                      </div>
                      <div className="flex gap-0.5">
                        {[1,2,3,4,5].map(star => (
                          <span key={star} className={`text-[12px] ${star <= (feed.palatabilityRating || 0) ? 'text-accent drop-shadow-sm' : 'text-gray-200'}`}>
                            ★
                          </span>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => setShowModal(feed)} className="mt-1 w-full text-center bg-surface2 text-brand font-semibold py-2 rounded-lg hover:bg-black/5 text-[13px] border border-border-custom transition-colors">
                      View Details
                    </button>
                  </div>
                ))}
                {filteredFeeds.length === 0 && (
                  <div className="p-6 text-center text-text3 italic text-[13px] bg-white rounded-xl border border-border-custom">No feeds found matching your search.</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-border-custom flex justify-between items-center bg-[#F5F9F6]">
              <h2 className="font-bold text-text text-lg">{showModal.feedName}</h2>
              <button onClick={() => setShowModal(null)} className="text-text3 hover:text-text font-bold text-xl">&times;</button>
            </div>
            <div className="p-4 space-y-4 text-[13px]">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-lg bg-surface2 border border-border-custom overflow-hidden flex items-center justify-center flex-shrink-0 relative group">
                  {showModal.imageUrl ? (
                    <img src={showModal.imageUrl} alt={showModal.feedName} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon size={32} className="text-text3 opacity-50" />
                  )}
                  <label className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity text-[11px] font-bold">
                    Upload
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*" 
                      onChange={(e) => handleImageUpload(e, showModal.id)} 
                    />
                  </label>
                </div>
                <div>
                  <p><span className="text-text3 font-semibold">Category:</span> {showModal.category}</p>
                  <p><span className="text-text3 font-semibold">Scientific:</span> {showModal.scientificName || '-'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 bg-surface2 p-3 rounded-lg border border-border-custom">
                <div>
                  <p className="text-text3 font-semibold text-[11px] uppercase tracking-wide">Kannada Name</p>
                  <p className="font-semibold">{showModal.kannadaName || '-'}</p>
                </div>
                <div>
                  <p className="text-text3 font-semibold text-[11px] uppercase tracking-wide">Tamil Name</p>
                  <p className="font-semibold">{showModal.tamilName || '-'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
