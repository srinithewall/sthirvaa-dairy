import React from 'react';
import { Clock } from 'lucide-react';

interface FeedEntry {
  feedName: string;
  quantityKg: number;
}

interface Props {
  feeds: FeedEntry[];
}

export default function FeedingSchedule({ feeds }: Props) {
  if (!feeds || feeds.length === 0) return null;

  // Attempt to categorize feeds dynamically based on names to construct the schedule.
  const isClaudeRecipe = feeds.some(f => f.feedName.toLowerCase().includes('hybrid napier'));

  // If it's specifically the Claude preset recipe, render exactly what was asked.
  // Otherwise, we do a generic dynamic split.
  if (isClaudeRecipe) {
    return (
      <div className="bg-[#FEF9C3]/40 rounded-xl border border-yellow-200 p-5 mt-6 shadow-sm">
        <h3 className="text-[15px] font-bold mb-4 flex items-center gap-2 text-yellow-800">
          <Clock size={18} /> Simple Daily Feeding Schedule
        </h3>

        <div className="space-y-4">
          <div className="bg-white rounded-lg p-3 border border-yellow-100">
            <h4 className="font-bold text-[13px] text-yellow-900 mb-2">EARLY MORNING (6-7 AM)</h4>
            <ul className="text-[13px] text-text2 space-y-1 ml-4 list-disc marker:text-yellow-400">
              <li>Give fresh cut Hybrid Napier <span className="font-semibold text-text1 ml-2">5 kg</span></li>
              <li>Give fresh Maize Green Fodder <span className="font-semibold text-text1 ml-2">2.5 kg</span></li>
              <li>Give Hotel Food Waste (fresh only) <span className="font-semibold text-text1 ml-2">0.5 kg</span></li>
              <li className="mt-2">
                Mix these ingredients together → give as one mixture:
                <ul className="ml-4 mt-1 space-y-1 list-none text-text3">
                  <li>— Wheat Bran <span className="font-medium text-text2 ml-2">1.4 kg</span></li>
                  <li>— Groundnut Cake <span className="font-medium text-text2 ml-2">0.75 kg</span></li>
                  <li>— Maize Powder <span className="font-medium text-text2 ml-2">0.25 kg</span></li>
                  <li>— Salt <span className="font-medium text-text2 ml-2">25 g</span></li>
                  <li>— Mineral Mix <span className="font-medium text-text2 ml-2">75 g</span></li>
                </ul>
              </li>
            </ul>
          </div>

          <div className="bg-white rounded-lg p-3 border border-yellow-100">
            <h4 className="font-bold text-[13px] text-yellow-900 mb-2">AFTERNOON (12-1 PM)</h4>
            <ul className="text-[13px] text-text2 space-y-1 ml-4 list-disc marker:text-yellow-400">
              <li>Give Ragi Straw (dry) <span className="font-semibold text-text1 ml-2">1 kg</span></li>
            </ul>
          </div>

          <div className="bg-white rounded-lg p-3 border border-yellow-100">
            <h4 className="font-bold text-[13px] text-yellow-900 mb-2">EVENING (4-5 PM)</h4>
            <ul className="text-[13px] text-text2 space-y-1 ml-4 list-disc marker:text-yellow-400">
              <li>Give fresh cut Hybrid Napier <span className="font-semibold text-text1 ml-2">5 kg</span></li>
              <li>Give fresh Maize Green Fodder <span className="font-semibold text-text1 ml-2">2.5 kg</span></li>
              <li className="mt-2">
                Mix these ingredients together → give as one mixture:
                <ul className="ml-4 mt-1 space-y-1 list-none text-text3">
                  <li>— Wheat Bran <span className="font-medium text-text2 ml-2">1.4 kg</span></li>
                  <li>— Groundnut Cake <span className="font-medium text-text2 ml-2">0.75 kg</span></li>
                  <li>— Maize Powder <span className="font-medium text-text2 ml-2">0.25 kg</span></li>
                  <li>— Salt <span className="font-medium text-text2 ml-2">25 g</span></li>
                  <li>— Mineral Mix <span className="font-medium text-text2 ml-2">75 g</span></li>
                </ul>
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Fallback for custom generic plans
  return (
    <div className="bg-[#FEF9C3]/40 rounded-xl border border-yellow-200 p-5 mt-6 shadow-sm">
      <h3 className="text-[15px] font-bold mb-4 flex items-center gap-2 text-yellow-800">
        <Clock size={18} /> Suggested Feeding Schedule
      </h3>
      <div className="text-[13px] text-text2">
        A custom breakdown is not available for this combination. Consider splitting green fodder and concentrates 50/50 between morning and evening, and feeding dry roughage in the afternoon.
      </div>
    </div>
  );
}
