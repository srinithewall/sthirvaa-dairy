'use client';

import React, { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { useNotification } from '@/components/NotificationContext';
import { Check, Lock, ShieldCheck } from 'lucide-react';

/** One role's rights in one module, as stored in role_permissions. */
export interface PermissionRow {
  role: string;
  module: string;
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

type Action = 'view' | 'create' | 'edit' | 'delete';
const ACTIONS: Action[] = ['view', 'create', 'edit', 'delete'];

const MODULE_INFO: Record<string, { name: string; hint: string }> = {
  DASHBOARD: { name: 'Dashboard', hint: 'Home figures and Reports & Analytics' },
  HERDS: { name: 'Herd Management', hint: 'Animals, health, breeding, weights' },
  PRODUCTION: { name: 'Milk Production', hint: 'Milk records and distribution' },
  FEEDS: { name: 'Feed Management', hint: 'Feeds, rations and the purchase list' },
  ACTIVITIES: { name: 'Farm Chores', hint: 'Daily chores and routines' },
  INVENTORY: { name: 'Inventory', hint: 'Farm stock' },
  SHOP: { name: 'Shop', hint: 'Feed store billing and stock' },
  ORDERS: { name: 'Orders', hint: 'Customer orders and subscriptions' },
  SALES: { name: 'Sales', hint: 'Sales records' },
  LEDGER: { name: 'Digital Ledger', hint: 'Expenses and income' },
  BANK: { name: 'Bank Account', hint: 'Kotak statement, mapping and the sales/purchase report' },
  FINANCE: { name: 'Finance', hint: 'Financial summaries' },
  STAFF: { name: 'Staff Management', hint: 'Team directory' },
};
const ROLE_NAME: Record<string, string> = { STAFF: 'Staff', PARTNER: 'Partner', FINANCE: 'Finance', ADMIN: 'Admin' };

const keyOf = (r: { role: string; module: string }) => `${r.role}|${r.module}`;

/**
 * Admin screen: tick what each role may do in each module. ADMIN is shown locked - it always has
 * everything. Changes are kept locally until Save.
 */
export default function RolePermissions() {
  const { showToast } = useNotification();
  const [roles, setRoles] = useState<string[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [saved, setSaved] = useState<Record<string, PermissionRow>>({});
  const [draft, setDraft] = useState<Record<string, PermissionRow>>({});
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/permissions');
      const rows: Record<string, PermissionRow> = {};
      (res.data.rows as PermissionRow[]).forEach(r => { rows[keyOf(r)] = r; });
      setRoles(res.data.roles);
      setModules(res.data.modules);
      setSaved(rows);
      setDraft(rows);
      setRole(prev => prev || res.data.roles[0] || 'ADMIN');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Could not load role permissions.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const changed = useMemo(() => Object.values(draft).filter(r => {
    const s = saved[keyOf(r)];
    return !s || ACTIONS.some(a => s[a] !== r[a]);
  }), [draft, saved]);
  const changedRoles = new Set(changed.map(r => r.role));

  const locked = role === 'ADMIN';
  const rowFor = (module: string): PermissionRow => locked
    ? { role, module, view: true, create: true, edit: true, delete: true }
    : draft[`${role}|${module}`] || { role, module, view: false, create: false, edit: false, delete: false };

  /** View is needed for anything else: ticking an action ticks view, unticking view clears the rest. */
  const toggle = (module: string, action: Action) => {
    if (locked) return;
    const r = { ...rowFor(module) };
    r[action] = !r[action];
    if (action === 'view' && !r.view) { r.create = false; r.edit = false; r.delete = false; }
    if (action !== 'view' && r[action]) r.view = true;
    setDraft(d => ({ ...d, [keyOf(r)]: r }));
  };

  const setAll = (module: string, on: boolean) => {
    if (locked) return;
    const r: PermissionRow = { role, module, view: on, create: on, edit: on, delete: on };
    setDraft(d => ({ ...d, [keyOf(r)]: r }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/permissions', changed);
      showToast(`Permissions saved for ${[...changedRoles].map(r => ROLE_NAME[r] || r).join(', ')}.`);
      await load();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Could not save permissions.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-16 text-center"><div className="inline-block w-8 h-8 border-4 border-brand/30 border-t-brand rounded-full animate-spin" /></div>;
  }

  return (
    <div className="bg-white rounded-radius-custom-lg border border-border-custom card-shadow overflow-hidden">
      <div className="p-4 border-b border-border-custom bg-surface2/40">
        <div className="text-[13px] font-black text-text flex items-center gap-2 uppercase tracking-wider">
          <ShieldCheck size={16} className="text-brand" /> Role permissions
        </div>
        <p className="text-[12px] text-text3 mt-1">Pick a role, then tick what it can do in each module. A user gets the rights of their role.</p>
        <div className="flex flex-wrap gap-1.5 mt-3" role="tablist" aria-label="Role">
          {[...roles, 'ADMIN'].map(r => (
            <button key={r} role="tab" aria-selected={role === r} onClick={() => setRole(r)}
              className={`relative px-4 py-2 rounded-lg text-[12px] font-black tracking-wide border ${role === r ? 'bg-[#1b4332] text-white border-[#1b4332]' : 'bg-white text-text2 border-border-custom'}`}>
              {r === 'ADMIN' && <Lock size={11} className="inline mr-1 -mt-0.5" />}
              {ROLE_NAME[r] || r}
              {changedRoles.has(r) && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500" title="Unsaved changes" />}
            </button>
          ))}
        </div>
      </div>

      {locked && (
        <div className="px-4 py-2.5 text-[12px] text-text3 bg-surface2/60 border-b border-border-custom">
          Admins always have full access to every module. This cannot be changed.
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-[13px] min-w-[520px]">
          <thead>
            <tr className="text-[10px] font-black text-text3 uppercase tracking-widest border-b border-border-custom">
              <th className="text-left px-4 py-2.5">Module</th>
              {ACTIONS.map(a => <th key={a} className="px-2 py-2.5 w-16 text-center">{a}</th>)}
              <th className="px-3 py-2.5 w-16 text-center">All</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-custom">
            {modules.map(m => {
              const r = rowFor(m);
              const all = ACTIONS.every(a => r[a]);
              const info = MODULE_INFO[m] || { name: m, hint: '' };
              return (
                <tr key={m} className={r.view ? '' : 'bg-surface2/30'}>
                  <td className="px-4 py-2.5">
                    <div className={`font-bold ${r.view ? 'text-text' : 'text-text3'}`}>{info.name}</div>
                    {info.hint && <div className="text-[11px] text-text3">{info.hint}</div>}
                  </td>
                  {ACTIONS.map(a => (
                    <td key={a} className="px-2 py-2.5 text-center">
                      <Tick on={r[a]} disabled={locked} label={`${ROLE_NAME[role] || role}: ${a} ${info.name}`}
                        onClick={() => toggle(m, a)} />
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-center">
                    <Tick on={all} disabled={locked} subtle label={`${ROLE_NAME[role] || role}: all rights in ${info.name}`}
                      onClick={() => setAll(m, !all)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="p-3 sm:p-4 border-t border-border-custom flex items-center gap-2 bg-white sticky bottom-0">
        <span className="text-[12px] text-text3 mr-auto">
          {changed.length ? `${changed.length} unsaved change${changed.length === 1 ? '' : 's'}` : 'No unsaved changes'}
        </span>
        <button onClick={() => setDraft(saved)} disabled={!changed.length || saving}
          className="px-4 py-2 rounded-lg border border-border-custom text-text2 text-[12px] font-black disabled:opacity-40">
          DISCARD
        </button>
        <button onClick={save} disabled={!changed.length || saving}
          className="px-5 py-2 rounded-lg bg-brand text-white text-[12px] font-black shadow disabled:opacity-40">
          {saving ? 'SAVING...' : 'SAVE'}
        </button>
      </div>
    </div>
  );
}

function Tick({ on, disabled, subtle, label, onClick }: {
  on: boolean; disabled?: boolean; subtle?: boolean; label: string; onClick: () => void;
}) {
  return (
    <button type="button" role="checkbox" aria-checked={on} aria-label={label} title={label}
      disabled={disabled} onClick={onClick}
      className={`w-7 h-7 rounded-md border-2 inline-flex items-center justify-center transition-colors disabled:cursor-not-allowed ${
        on ? (subtle ? 'bg-brand/15 border-brand/40 text-brand' : 'bg-brand border-brand text-white')
          : 'bg-white border-border-custom text-transparent hover:border-brand/50'} ${disabled ? 'opacity-60' : ''}`}>
      <Check size={15} strokeWidth={3} />
    </button>
  );
}
