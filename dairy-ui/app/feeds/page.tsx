'use client';

import React, { useState } from 'react';
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
    { id: 'master', label: 'Feed Master', icon: Leaf },
    { id: 'nutrition', label: 'Nutrition', icon: FlaskConical },
    { id: 'requirements', label: 'Animal Requirements', icon: Activity },
    { id: 'optimizer', label: 'Feed Optimizer', icon: Calculator },
    { id: 'knowledge', label: 'Knowledge Base', icon: BookOpen },
  ];

  return (
    <AppLayout>
      <div className="flex flex-col h-full gap-4">
        <div className="bg-white rounded-radius-custom-lg p-2 border border-border-custom flex gap-2 overflow-x-auto shadow-sm">
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

        <div className="flex-1 bg-white rounded-radius-custom-lg border border-border-custom shadow-sm p-3 overflow-y-auto">
          {activeTab === 'master' && <FeedMasterTab />}
          {activeTab === 'nutrition' && <NutritionTab />}
          {activeTab === 'requirements' && <AnimalRequirementsTab />}
          {activeTab === 'optimizer' && <FeedOptimizerTab />}
          {activeTab === 'knowledge' && <KnowledgeBaseTab />}
        </div>
      </div>
    </AppLayout>
  );
}
