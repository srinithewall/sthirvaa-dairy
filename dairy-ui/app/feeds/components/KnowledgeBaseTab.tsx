import React, { useMemo } from 'react';

interface Props {
  /** Raw { feed, nutrition, knowledge } rows, owned by the page and shared across tabs. */
  feeds: any[];
  loading: boolean;
}

export default function KnowledgeBaseTab({ feeds: feedRows, loading }: Props) {
  const feeds = useMemo(() => (feedRows || []).map((d: any) => d.feed || d), [feedRows]);

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-text">Feed Knowledge Base</h2>
        <p className="text-[13px] text-text3">Agronomic notes, advantages, and usage warnings.</p>
      </div>

      <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
        {loading ? (
          <div className="col-span-full p-8 text-center text-text3 text-[13px]">Loading knowledge base...</div>
        ) : (
          feeds.map(f => (
            <div key={f.id} className="bg-surface rounded-xl border border-border-custom p-4 shadow-sm hover:shadow-md transition-all flex flex-col h-[250px]">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold text-[15px]">{f.feedName}</h3>
                  <span className="bg-brand/10 text-brand px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">
                    {f.category}
                  </span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 mt-2">
                <p className="text-[12px] text-text2 leading-relaxed italic mb-3">
                  {f.remarks || 'No detailed agronomic notes available.'}
                </p>
                <div className="space-y-2 text-[12px]">
                  <div><strong className="text-text font-bold">Source:</strong> {f.referenceSource || 'General'}</div>
                  <div><strong className="text-text font-bold">Scientific:</strong> {f.scientificName || 'N/A'}</div>
                  <div><strong className="text-text font-bold">Palatability:</strong> {f.palatabilityRating}/5</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
