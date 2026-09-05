'use client';

import React, { useCallback, useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import FeedMasterTab from './components/FeedMasterTab';
import NutritionTab from './components/NutritionTab';
import AnimalRequirementsTab from './components/AnimalRequirementsTab';
import FeedOptimizerTab from './components/FeedOptimizerTab';
import KnowledgeBaseTab from './components/KnowledgeBaseTab';
import { Leaf, FlaskConical, Activity, Calculator, BookOpen, Search, Download } from 'lucide-react';
import api from '@/lib/api';

export default function FeedsPage() {
  const [activeTab, setActiveTab] = useState('master');
  const [search, setSearch] = useState('');

  // Four of the five tabs need the same feed list, and switching tabs unmounts the old
  // one - fetching per tab meant refetching all ~110 feeds on every switch. Owned here
  // instead, so it is loaded once per visit and shared.
  const [feeds, setFeeds] = useState<any[]>([]);
  const [feedsLoading, setFeedsLoading] = useState(true);

  // Kept in the raw { feed, nutrition, knowledge } shape the API returns; each tab picks
  // out the part it renders, exactly as it did when it fetched for itself.
  const refreshFeeds = useCallback(async () => {
    setFeedsLoading(true);
    try {
      const res = await api.get('/feeds');
      setFeeds(res.data || []);
    } catch (err) {
      console.error('Failed to fetch feeds', err);
    } finally {
      setFeedsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshFeeds();
  }, [refreshFeeds]);

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

  const tabs = [
    { id: 'master',       label: 'Feed Master',        shortLabel: 'Feed',      icon: Leaf },
    { id: 'nutrition',    label: 'Nutrition',           shortLabel: 'Nutrition', icon: FlaskConical },
    { id: 'requirements', label: 'Animal Requirements', shortLabel: 'Animal',    icon: Activity },
    { id: 'optimizer',    label: 'Feed Optimizer',      shortLabel: 'Optimizer', icon: Calculator },
    { id: 'knowledge',    label: 'Knowledge Base',      shortLabel: 'Knowledge', icon: BookOpen },
  ];

  return (
    <AppLayout>
      <div className="flex flex-col h-full gap-3">

        {/* Desktop tab bar: icon + full label, horizontal */}
        <div className="hidden md:flex bg-white rounded-radius-custom-lg p-2 border border-border-custom gap-2 shadow-sm overflow-x-auto">
          <div className="flex gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-brand text-white shadow-md'
                      : 'text-text2 hover:bg-surface2 hover:text-text'
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
          {activeTab === 'master' && (
            <div className="flex items-center gap-3 px-2 flex-shrink-0 ml-auto">
              <button
                onClick={handleExport}
                className="flex items-center gap-1.5 bg-white border border-border-custom text-text2 px-3 py-1.5 rounded-lg text-[12px] font-semibold hover:border-brand hover:text-brand transition-colors shadow-sm"
              >
                <Download size={14} />
                Export
              </button>
            </div>
          )}
        </div>

        {/* Mobile tab bar: icon stacked over short label, equal-width tiles */}
        <div className="md:hidden bg-white border border-border-custom rounded-2xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-5">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-col items-center justify-center gap-1 py-3 text-[10px] font-bold transition-all border-b-2 ${
                    isActive
                      ? 'border-brand text-brand bg-brand/5'
                      : 'border-transparent text-text3 hover:text-text hover:bg-surface2'
                  }`}
                >
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                  <span className="leading-tight text-center px-0.5">{tab.shortLabel}</span>
                </button>
              );
            })}
          </div>
          {activeTab === 'master' && (
            <div className="flex justify-end px-3 py-2 border-t border-border-custom/50 bg-surface">
              <button
                onClick={handleExport}
                className="flex items-center gap-1.5 bg-white border border-border-custom text-text2 px-3 py-1.5 rounded-lg text-[12px] font-semibold hover:border-brand hover:text-brand transition-colors shadow-sm"
              >
                <Download size={13} />
                Export CSV
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 bg-white rounded-radius-custom-lg border border-border-custom shadow-sm p-3 overflow-y-auto">
          {activeTab === 'master' && <FeedMasterTab feeds={feeds} loading={feedsLoading} onRefresh={refreshFeeds} />}
          {activeTab === 'nutrition' && <NutritionTab feeds={feeds} loading={feedsLoading} />}
          {activeTab === 'requirements' && <AnimalRequirementsTab />}
          {activeTab === 'optimizer' && <FeedOptimizerTab feeds={feeds} />}
          {activeTab === 'knowledge' && <KnowledgeBaseTab feeds={feeds} loading={feedsLoading} />}
        </div>
      </div>
    </AppLayout>
  );
}
