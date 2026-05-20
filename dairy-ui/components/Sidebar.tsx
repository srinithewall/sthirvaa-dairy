'use client';

import React from 'react';
import { LayoutDashboard, Bell, Layout, Droplets, ShoppingCart, DollarSign, Package, Package2, Users, BarChart3, LogOut, Settings, ClipboardList, FileText, X, Info, GitCommit, Camera } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import api, { formatImageUrl } from '@/lib/api';
import { changelogData } from '@/lib/changelog';

const sidebarItems = [
  { group: 'Overview', items: [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' }
  ]},
  { group: 'Farm Management', items: [
    { name: 'Herd Management', icon: Layout, path: '/herds' },
    { name: 'Milk Production', icon: Droplets, path: '/production' }
  ]},
  { group: 'Business', items: [
    { name: 'Digital Ledger', icon: BarChart3, path: '/ledger' },
    { name: 'Sales', icon: ShoppingCart, path: '/sales' },
    { name: 'Inventory', icon: Package, path: '/inventory' }
  ]},
  { group: 'Shop', items: [
    { name: 'Sthirvaa Shop', icon: ShoppingCart, path: '/shop' },
    { name: 'My Orders', icon: ClipboardList, path: '/orders' },
    { name: 'My Invoices', icon: FileText, path: '/invoices' },
    { name: 'Products Admin', icon: Package2, path: '/admin/products' }
  ]},
  { group: 'Operations', items: [
    { name: 'Staff Management', icon: Users, path: '/staff' }
  ]}
];

export default function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const [user, setUser] = React.useState({ username: 'Loading...', email: '', role: 'STAFF', staffId: null, customerId: null });
  const [showModal, setShowModal] = React.useState(false);
  const [staffInfo, setStaffInfo] = React.useState<any>(null);
  const [showChangelogModal, setShowChangelogModal] = React.useState(false);

  // Close sidebar when pathname changes (on mobile)
  React.useEffect(() => {
    onClose();
  }, [pathname]);

  React.useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  React.useEffect(() => {
    if (user.staffId) {
      fetchStaffDetails();
    }
  }, [user.staffId]);

  const fetchStaffDetails = async () => {
    try {
      const res = await api.get(`/staff/${user.staffId}`);
      setStaffInfo(res.data);
    } catch (err) {
      console.error('Error fetching staff info:', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const handleProfilePicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user.staffId || !staffInfo) return;

    const fd = new FormData();
    fd.append('file', file);

    try {
      const uploadRes = await api.post('/files/upload?type=staff', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const imageUrl = uploadRes.data.url;

      const updatedStaff = {
        ...staffInfo,
        profilePic: imageUrl
      };

      await api.post('/staff', updatedStaff);
      setStaffInfo(updatedStaff);
    } catch (err) {
      console.error('Failed to upload profile picture:', err);
    }
  };

  const displayName = user.username.split('@')[0];

  return (
    <React.Fragment>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] md:hidden animate-in fade-in duration-300"
          onClick={onClose}
        />
      )}

      <div className={`
        fixed md:static inset-y-0 left-0 z-[1001] w-[230px] bg-white border-r border-gray-100 
        flex flex-col h-screen overflow-y-auto flex-shrink-0 transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'} 
        md:translate-x-0 md:flex md:shadow-none
      `}>
        <div className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            {staffInfo?.profilePic ? (
              <img 
                src={formatImageUrl(staffInfo.profilePic)} 
                alt={displayName} 
                className="w-10 h-10 rounded-full object-cover border border-border-custom shadow-sm flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 bg-surface rounded-full flex-shrink-0 flex items-center justify-center text-text3 border border-border-custom shadow-sm">
                <Users size={20} />
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <div className="text-[15px] font-bold text-[#2D3E50] truncate">
                Hi, <span className="capitalize">{displayName}</span>
              </div>
              <button 
                onClick={() => setShowModal(true)}
                className="text-[12px] text-[#4A90E2] font-semibold hover:underline text-left"
              >
                View My Info
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setShowModal(true)}
              className="p-1.5 text-[#4A90E2] hover:bg-surface rounded-md transition-all flex-shrink-0"
              title="Profile Settings"
            >
              <Settings size={18} />
            </button>
            <button 
              onClick={onClose}
              className="md:hidden p-1.5 text-text3 hover:bg-surface rounded-md transition-all flex-shrink-0"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      
      <div className="h-[1px] bg-[#E8EDF2] mx-4 mb-3" />

      {/* User Info Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200 border border-brand/20">
            <div className="bg-brand-dark p-6 text-white text-center relative">
              <button 
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
              >
                <LogOut size={16} className="rotate-180" />
              </button>
              <div className="relative w-16 h-16 mx-auto mb-3 group">
                {staffInfo?.profilePic ? (
                  <img 
                    src={formatImageUrl(staffInfo.profilePic)} 
                    alt={displayName} 
                    className="w-16 h-16 rounded-full object-cover shadow-lg border border-white/20"
                  />
                ) : (
                  <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center text-brand-dark text-2xl font-bold shadow-lg">
                    {displayName.substring(0,2).toUpperCase()}
                  </div>
                )}
                {user.staffId && (
                  <label className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center text-[9px] text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer font-bold uppercase tracking-wider gap-0.5">
                    <Camera size={12} />
                    <span>Upload</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleProfilePicUpload} 
                    />
                  </label>
                )}
              </div>
              <h2 className="text-xl font-bold capitalize">{displayName}</h2>
              <p className="text-accent text-xs font-bold uppercase tracking-widest mt-1">
                {staffInfo?.role || user.role}
              </p>
            </div>
            
            <div className="p-6 pt-4 space-y-4">
              <div className="space-y-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-text3 font-bold uppercase tracking-wider">Description</span>
                  <p className="text-[12px] text-text2 leading-relaxed italic">
                    {staffInfo?.description || 'No description provided.'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-text3 font-bold uppercase tracking-wider">Phone</span>
                    <span className="text-[13px] text-text font-medium">{staffInfo?.phone || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-text3 font-bold uppercase tracking-wider">Location</span>
                    <span className="text-[13px] text-text font-medium">{staffInfo?.location || 'Bengaluru'}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1 pt-2 border-t border-border-custom mt-2">
                  <span className="text-[11px] text-text3 font-bold uppercase tracking-wider">Linked Email</span>
                  <span className="text-[13px] text-text2 truncate">
                    {user.email || (user.username === 'lokesh' ? 'lokesh.hg@farm.com' : user.username)}
                  </span>
                </div>
              </div>

              <button 
                onClick={() => setShowModal(false)}
                className="w-full bg-brand text-white py-2.5 rounded-lg font-bold hover:bg-brand-dark transition-colors mt-4 text-sm shadow-md"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {sidebarItems.map((section, idx) => (
        <React.Fragment key={idx}>
          <div className="px-4 pt-4 pb-1 text-[10px] font-bold text-text3 uppercase tracking-widest">
            {section.group}
          </div>
          {section.items.map((item) => {
            const isActive = pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center gap-2.5 py-2.5 px-3 rounded-lg cursor-pointer mx-2 my-0.5 transition-colors text-[13px] ${
                  isActive 
                    ? 'bg-[#E8F5EE] text-brand font-semibold shadow-sm' 
                    : 'text-text2 hover:bg-surface2 hover:text-text'
                }`}
              >
                <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                <span className="flex-1">{item.name}</span>
                {item.badge && (
                  <span className="bg-danger text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </React.Fragment>
      ))}

      <div className="mt-auto p-4 flex flex-col gap-2">
        <button 
          onClick={() => setShowChangelogModal(true)}
          className="flex items-center gap-2 text-text3 hover:text-brand transition-colors text-xs font-semibold w-full border border-gray-100 rounded-lg p-2 bg-surface hover:bg-[#E8F5EE]/40"
        >
          <Info size={14} className="text-brand" />
          <span>Version {changelogData[0]?.version || 'v1.2.2'}</span>
        </button>

        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 text-text3 hover:text-danger transition-colors text-sm font-medium w-full px-2 mt-1"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </div>

    {/* Changelog & Release Notes Modal */}
    {showChangelogModal && (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 border border-brand/20 flex flex-col max-h-[80vh]">
          {/* Header */}
          <div className="bg-brand-dark p-5 text-white flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-white/10 rounded-lg">
                <Info size={20} className="text-accent" />
              </div>
              <div className="text-left">
                <h2 className="text-lg font-bold">System Changelog</h2>
                <p className="text-[10px] text-accent font-semibold tracking-wider uppercase">Sthirvaa Farms • Release History</p>
              </div>
            </div>
            <button 
              onClick={() => setShowChangelogModal(false)}
              className="text-white/50 hover:text-white transition-colors p-1"
            >
              <X size={20} />
            </button>
          </div>
          
          {/* Body (Scrollable) */}
          <div className="p-6 overflow-y-auto space-y-5 bg-surface/30 flex-1 text-left">
            {changelogData.map((entry, index) => (
              <div key={index} className="relative pl-6 border-l border-gray-200 last:border-transparent pb-3">
                {/* Dot on Timeline */}
                <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 bg-brand rounded-full ring-4 ring-white" />
                
                {/* Release Meta */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="bg-brand-dark text-accent text-[11px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                      {entry.version}
                    </span>
                    {entry.status && (
                      <span className="text-[10px] text-brand bg-brand/10 font-bold px-1.5 py-0.5 rounded">
                        {entry.status}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-text3 font-bold">{entry.date}</span>
                </div>
                
                <div className="text-[9px] text-text2 font-bold mb-2.5 flex items-center gap-1">
                  <GitCommit size={10} className="text-text3" />
                  <span>Commit:</span>
                  <span className="bg-surface2 px-1 py-0.2 rounded font-mono text-[9px] border border-border-custom">{entry.commit}</span>
                </div>

                {/* Bullet points */}
                <ul className="space-y-1.5">
                  {entry.changes.map((change, cIdx) => (
                    <li key={cIdx} className="text-[11px] text-text2 leading-relaxed pl-3 relative before:content-['•'] before:absolute before:left-0 before:text-brand before:font-bold">
                      {change}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          
          {/* Footer */}
          <div className="p-4 border-t border-border-custom bg-white flex justify-end flex-shrink-0">
            <button 
              onClick={() => setShowChangelogModal(false)}
              className="bg-brand text-white px-5 py-2 rounded-lg font-bold hover:bg-brand-dark transition-colors text-xs shadow-md"
            >
              Close Version Info
            </button>
          </div>
        </div>
      </div>
    )}
  </React.Fragment>
);
}
