'use client';

import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { UserPlus, MessageCircle, Search, User, ArrowLeft } from 'lucide-react';

interface Staff {
  id: number;
  name: string;
  role: string;
  type: string;
  description: string;
  phone: string;
  employeeId: string;
  profilePic: string;
  joinDate: string;
}

export default function StaffPage() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
  
  // Mobile UX: toggle between list and detail view
  const [showMobileList, setShowMobileList] = useState(true);

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      const res = await api.get('/staff');
      setStaffList(res.data);
      if (res.data.length > 0) {
        setSelectedStaffId(res.data[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getEmpId = (s: Staff) => s.employeeId || 'N/A';

  const filteredStaff = staffList.filter(s => {
    return s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
           getEmpId(s).toLowerCase().includes(searchQuery.toLowerCase());
  }).sort((a, b) => {
    const idA = a.employeeId || '';
    const idB = b.employeeId || '';
    return idA.localeCompare(idB);
  });

  const selectedStaff = staffList.find(s => s.id === selectedStaffId);

  const handleSelectStaff = (id: number) => {
    setSelectedStaffId(id);
    setShowMobileList(false); // Hide list on mobile when selected
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-black text-text tracking-tight uppercase">Staff Management</h1>
            <p className="text-[13px] text-text3 mt-1 font-medium">Directory and profiles of all team members</p>
          </div>
          <button className="bg-brand text-white flex items-center gap-1.5 py-2 px-4 rounded-radius-custom font-black text-[12px] uppercase tracking-wider hover:bg-brand-dark transition-all shadow-sm">
            <UserPlus size={14} />
            <span>Add Member</span>
          </button>
        </div>

        <div className="flex flex-col md:flex-row bg-white rounded-radius-custom-lg border border-border-custom card-shadow h-[360px] overflow-hidden">
          
          {/* Left Sidebar - Staff List */}
          <div className={`w-full md:w-[280px] border-r border-border-custom flex-col bg-surface flex-shrink-0 ${!showMobileList ? 'hidden md:flex' : 'flex'}`}>
            
            {/* Tabs */}
            <div className="flex border-b border-border-custom px-3 pt-2 gap-4 bg-white">
              <button className="pb-1.5 text-[12px] font-black tracking-widest text-brand border-b-2 border-brand transition-colors">
                Everyone
              </button>
            </div>

            {/* Search */}
            <div className="p-2.5 bg-white border-b border-border-custom">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text3" size={12} />
                <input 
                  type="text" 
                  placeholder="Enter Emp. Name or ID" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-7 pr-2.5 py-1.5 text-[12px] border border-border-custom rounded-radius-custom focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </div>
            </div>

            {/* List - max height constrains it to ~5 items visible at a time with scroll */}
            <div className="flex-1 overflow-y-auto">
              {filteredStaff.length === 0 ? (
                <div className="text-center text-text3 text-[12px] py-6">No staff found.</div>
              ) : (
                filteredStaff.map(s => (
                  <div 
                    key={s.id} 
                    onClick={() => handleSelectStaff(s.id)}
                    className={`flex items-center gap-2.5 py-2.5 px-3 cursor-pointer border-b border-border-custom/50 transition-colors ${
                      selectedStaffId === s.id ? 'bg-brand/5 border-l-4 border-l-brand' : 'hover:bg-surface2 bg-white border-l-4 border-l-transparent'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-surface2 text-text3 flex flex-shrink-0 items-center justify-center overflow-hidden border border-border-custom shadow-sm">
                      {s.profilePic ? (
                        <img src={s.profilePic} alt={s.name} className="w-full h-full object-cover" />
                      ) : (
                        <User size={15} className="text-text3" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-black text-text truncate">
                        {s.name} {s.employeeId && <span className="text-text3 font-semibold ml-1">({s.employeeId})</span>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Detail Pane */}
          <div className={`flex-1 bg-white p-5 overflow-y-auto ${showMobileList ? 'hidden md:block' : 'block'}`}>
            
            {/* Mobile Back Button */}
            <button 
              onClick={() => setShowMobileList(true)} 
              className="md:hidden flex items-center gap-1.5 mb-3 text-brand font-bold text-[12px]"
            >
              <ArrowLeft size={12} /> Back to Directory
            </button>

            {selectedStaff ? (
              <div className="max-w-lg">
                {/* Header section */}
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 mb-5 text-center sm:text-left">
                  <div className="w-16 h-16 rounded-full bg-surface2 flex flex-shrink-0 items-center justify-center overflow-hidden shadow-sm border border-border-custom">
                    {selectedStaff.profilePic ? (
                      <img src={selectedStaff.profilePic} alt={selectedStaff.name} className="w-full h-full object-cover" />
                    ) : (
                      <User size={32} className="text-text3/50" />
                    )}
                  </div>
                  <div className="pt-0.5 flex-1">
                    <h2 className="text-lg font-black text-text tracking-tight mb-0.5">{selectedStaff.name}</h2>
                    <div className="text-[12px] text-text3 font-bold mb-2.5">
                      {getEmpId(selectedStaff)}
                    </div>
                    
                    {/* Message Action */}
                    <button className="inline-flex items-center gap-1.5 bg-brand/10 text-brand px-3 py-1 rounded-radius-custom text-[11px] font-black uppercase tracking-wider hover:bg-brand hover:text-white transition-all">
                      <MessageCircle size={12} />
                      <span>Send Message</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Contact Details */}
                  <div>
                    <div className="relative mb-2">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-border-custom"></div>
                      </div>
                      <div className="relative flex justify-start">
                        <span className="bg-white pr-2 text-[10px] font-bold tracking-widest text-text3 uppercase">
                          Contact Details
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-1.5 text-xs font-medium">
                      <div className="text-text3">Phone Number</div>
                      <div className="sm:col-span-2 font-medium text-text2">
                        {selectedStaff.phone ? (selectedStaff.phone.startsWith('+91') ? selectedStaff.phone : `+91 ${selectedStaff.phone}`) : 'N/A'}
                      </div>
                    </div>
                  </div>

                  {/* Category */}
                  <div>
                    <div className="relative mb-2">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-border-custom"></div>
                      </div>
                      <div className="relative flex justify-start">
                        <span className="bg-white pr-2 text-[10px] font-bold tracking-widest text-text3 uppercase">
                          Category
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-1.5 text-xs font-medium">
                      <div className="text-text3 mb-0.5 sm:mb-0">Role</div>
                      <div className="sm:col-span-2 font-bold text-text mb-0.5 sm:mb-0">{selectedStaff.role || 'N/A'}</div>
                      
                      <div className="text-text3">Staff Type</div>
                      <div className="sm:col-span-2 font-medium text-text2">{selectedStaff.type || 'N/A'}</div>
                    </div>
                  </div>

                  {/* Other Info */}
                  <div>
                    <div className="relative mb-2">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-border-custom"></div>
                      </div>
                      <div className="relative flex justify-start">
                        <span className="bg-white pr-2 text-[10px] font-bold tracking-widest text-text3 uppercase">
                          Other Information
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-1.5 text-xs font-medium">
                      <div className="text-text3">Joining Date</div>
                      <div className="sm:col-span-2 font-medium text-text2">{formatDate(selectedStaff.joinDate)}</div>
                    </div>
                  </div>
                </div>

              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-text3 min-h-[250px]">
                <User size={32} className="mb-2 text-border-custom animate-pulse" />
                <p className="text-[12px] font-bold uppercase tracking-wider">Select a staff member to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
