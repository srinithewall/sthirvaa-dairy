'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, X, KeyRound, Pencil, Phone, Search, Eye, MapPin } from 'lucide-react';
import api from '@/lib/api';
import { useNotification } from '@/components/NotificationContext';
import { Customer, PriceSlab } from '@/lib/customerPricing';
import PriceSlabTable from '@/components/PriceSlabTable';

interface SlabRow { key: number; fromLitres: string; milkRate: string; deliveryRate: string; }
let _k = 0;
const nk = () => ++_k;

const toRows = (slabs: PriceSlab[]): SlabRow[] =>
  [...slabs].sort((a, b) => a.fromLitres - b.fromLitres).map(s => ({
    // An empty delivery box means no delivery at that volume.
    key: nk(), fromLitres: String(s.fromLitres), milkRate: String(s.milkRate),
    deliveryRate: s.deliveryAvailable === false ? '' : String(s.deliveryRate ?? 0),
  }));

/** Customers, each with their own milk price slabs and (admin only) a login to see their milk. */
export default function CustomersPanel() {
  const { showToast } = useNotification();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [slabs, setSlabs] = useState<Record<number, PriceSlab[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Customer | 'new' | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    try { setIsAdmin(JSON.parse(localStorage.getItem('user') || '{}').role === 'ADMIN'); } catch { /* not signed in */ }
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [c, s] = await Promise.all([api.get('/customers'), api.get('/customers/price-slabs')]);
      setCustomers(c.data);
      setSlabs(s.data || {});
    } catch {
      showToast('Could not load customers', 'error');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => customers
    .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search))
    .sort((a, b) => a.name.localeCompare(b.name)), [customers, search]);

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text3" size={16} />
          <input
            placeholder="Search customers..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 bg-white border border-border-custom rounded-lg text-sm focus:outline-none focus:border-brand shadow-sm"
          />
        </div>
        <button
          onClick={() => setEditing('new')}
          className="bg-brand text-white flex items-center gap-2 py-2 px-4 rounded-radius-custom font-medium text-[13px] hover:bg-brand-dark transition-all shadow-md"
        >
          <Plus size={16} /> New Customer
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-text3 italic">Loading customers...</div>
      ) : shown.length === 0 ? (
        <div className="p-8 text-center text-text3 italic bg-white rounded-radius-custom-lg border border-border-custom">No customers yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {shown.map(c => {
            const cs = [...(slabs[c.id] || [])].sort((a, b) => a.fromLitres - b.fromLitres);
            return (
              <button
                key={c.id}
                onClick={() => setEditing(c)}
                className="self-start text-left bg-white rounded-radius-custom-lg border border-border-custom card-shadow p-4 hover:border-brand/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="font-bold text-text truncate">{c.name}</div>
                    <div className="text-[12px] text-text3 flex items-center gap-1"><Phone size={11} /> {c.phone}</div>
                    {(c.deliveryLocation || c.deliveryKm) && (
                      <div className="mt-1.5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand bg-brand/10 rounded-full px-2.5 py-1">
                        <MapPin size={12} />
                        {c.deliveryLocation}
                        {c.deliveryKm ? <span className="font-normal text-text2">{c.deliveryLocation ? '· ' : ''}{+c.deliveryKm.toFixed(1)} km round trip</span> : null}
                      </div>
                    )}
                  </div>
                  <Pencil size={14} className="text-text3 flex-shrink-0 mt-1" />
                </div>
                {cs.length === 0 ? (
                  <div className="text-[12px] text-text2">Flat <b className="text-brand">₹{Math.round(c.defaultRate ?? 0)}</b> / L</div>
                ) : (
                  <PriceSlabTable slabs={cs} compact />
                )}
              </button>
            );
          })}
        </div>
      )}

      {editing && (
        <CustomerEditor
          customer={editing === 'new' ? null : editing}
          slabs={editing === 'new' ? [] : slabs[editing.id] || []}
          isAdmin={isAdmin}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function CustomerEditor({ customer, slabs, isAdmin, onClose, onSaved }: {
  customer: Customer | null; slabs: PriceSlab[]; isAdmin: boolean; onClose: () => void; onSaved: () => void;
}) {
  const { showToast, confirm } = useNotification();
  const [name, setName] = useState(customer?.name ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const [address, setAddress] = useState(customer?.address ?? '');
  const [deliveryLocation, setDeliveryLocation] = useState(customer?.deliveryLocation ?? '');
  const [deliveryKm, setDeliveryKm] = useState(customer?.deliveryKm != null ? String(customer.deliveryKm) : '');
  const [defaultRate, setDefaultRate] = useState(String(customer?.defaultRate ?? 45));
  const [rows, setRows] = useState<SlabRow[]>(() => toRows(slabs));
  const [saving, setSaving] = useState(false);

  // Login
  const [login, setLogin] = useState<{ hasLogin: boolean; username: string | null } | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [savingLogin, setSavingLogin] = useState(false);

  useEffect(() => {
    if (!customer || !isAdmin) return;
    api.get(`/customers/${customer.id}/login`).then(r => {
      setLogin(r.data);
      setUsername(r.data.username || customer.phone || '');
    }).catch(() => setLogin(null));
  }, [customer, isAdmin]);

  const setRow = (key: number, patch: Partial<SlabRow>) => setRows(p => p.map(r => r.key === key ? { ...r, ...patch } : r));
  const addRow = () => setRows(p => {
    const last = p.length ? Math.max(...p.map(r => parseFloat(r.fromLitres) || 0)) : -5;
    return [...p, { key: nk(), fromLitres: String(last + 5), milkRate: p[p.length - 1]?.milkRate ?? defaultRate, deliveryRate: '0' }];
  });

  const cleanSlabs = (): PriceSlab[] => rows
    .filter(r => parseFloat(r.milkRate) > 0)
    .map(r => ({
      fromLitres: parseFloat(r.fromLitres) || 0,
      milkRate: parseFloat(r.milkRate),
      deliveryRate: parseFloat(r.deliveryRate) || 0,
      deliveryAvailable: r.deliveryRate.trim() !== '',
    }));

  const preview = cleanSlabs().sort((a, b) => a.fromLitres - b.fromLitres);

  const save = async () => {
    if (!name.trim() || !phone.trim()) { showToast('Enter the name and phone number', 'warning'); return; }
    const froms = preview.map(s => s.fromLitres);
    if (new Set(froms).size !== froms.length) { showToast('Two slabs start at the same litres', 'warning'); return; }
    setSaving(true);
    try {
      const body = {
        name: name.trim(), phone: phone.trim(), address: address.trim() || null, defaultRate: parseFloat(defaultRate) || 45,
        deliveryLocation: deliveryLocation.trim() || null,
        deliveryKm: deliveryKm.trim() === '' ? null : parseFloat(deliveryKm),
      };
      const saved = customer
        ? (await api.put(`/customers/${customer.id}`, body)).data
        : (await api.post('/customers', body)).data;
      await api.put(`/customers/${saved.id}/price-slabs`, preview);
      showToast('Customer saved', 'success');
      onSaved();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not save the customer', 'error');
    } finally { setSaving(false); }
  };

  const saveLogin = async () => {
    if (!customer) return;
    if (!username.trim()) { showToast('Enter a username', 'warning'); return; }
    if (!login?.hasLogin && password.length < 4) { showToast('Set a password of at least 4 characters', 'warning'); return; }
    setSavingLogin(true);
    try {
      const r = await api.put(`/customers/${customer.id}/login`, { username: username.trim(), password: password || undefined });
      setLogin(r.data);
      setPassword('');
      showToast(login?.hasLogin ? 'Login updated' : 'Login created — share the username and password with the customer', 'success');
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not save the login', 'error');
    } finally { setSavingLogin(false); }
  };

  const removeLogin = () => {
    if (!customer) return;
    confirm(`Remove ${customer.name}'s login? They won't be able to sign in.`, async () => {
      try {
        const r = await api.delete(`/customers/${customer.id}/login`);
        setLogin(r.data);
        showToast('Login removed', 'success');
      } catch { showToast('Could not remove the login', 'error'); }
    }, 'danger');
  };

  const deleteCustomer = () => {
    if (!customer) return;
    confirm(`Delete ${customer.name}? Their prices and login go too. Only customers with no milk or sales on record can be deleted.`, async () => {
      try {
        await api.delete(`/customers/${customer.id}`);
        showToast('Customer deleted', 'success');
        onSaved();
      } catch (e: any) {
        showToast(e.response?.data?.message || 'Could not delete the customer', 'error');
      }
    }, 'danger');
  };

  const input = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-brand/30';
  const label = 'block text-[10px] font-bold uppercase tracking-wider text-text3 mb-1';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[95vh]">
        <div className="bg-brand-dark text-white px-5 py-4 flex items-center justify-between rounded-t-3xl sm:rounded-t-2xl flex-shrink-0">
          <h2 className="font-bold text-[16px]">{customer ? customer.name : 'New Customer'}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center"><X size={16} /></button>
        </div>

        <div className="overflow-y-auto p-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1"><label className={label}>Name</label><input className={input} value={name} onChange={e => setName(e.target.value)} /></div>
            <div className="col-span-2 sm:col-span-1"><label className={label}>Phone</label><input className={input} inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} /></div>
            <div className="col-span-2"><label className={label}>Address</label><input className={input} value={address} onChange={e => setAddress(e.target.value)} /></div>
            <div><label className={label}>Delivery location</label><input className={input} placeholder="e.g. Avalahali" value={deliveryLocation} onChange={e => setDeliveryLocation(e.target.value)} /></div>
            <div><label className={label}>Round trip (km)</label><input className={input} type="number" inputMode="decimal" min={0} value={deliveryKm} onChange={e => setDeliveryKm(e.target.value)} /></div>
          </div>

          {/* ── Milk price ── */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[13px] font-bold text-text">Milk price for this customer</h3>
              <button onClick={addRow} className="text-[11px] font-bold text-brand flex items-center gap-1 hover:underline"><Plus size={12} /> Add slab</button>
            </div>
            <p className="text-[11px] text-text3 mb-3">
              Price per litre by how many litres go in one delivery. Delivery charge is added on top of the milk price.
              Leave Delivery empty where you don't deliver (the customer collects); enter 0 for free delivery.
            </p>

            {rows.length === 0 ? (
              <div className="flex items-center gap-3 bg-surface2 rounded-xl p-3">
                <label className="text-[12px] text-text2 flex-1">Flat rate for any volume</label>
                <div className="relative w-28">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-text3">₹</span>
                  <input className={`${input} pl-6`} type="number" inputMode="decimal" value={defaultRate} onChange={e => setDefaultRate(e.target.value)} />
                </div>
                <span className="text-[12px] text-text3">/ L</span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_1fr_1fr_56px_28px] gap-2 text-[10px] font-bold uppercase tracking-wider text-text3 px-1">
                  <span>From (L)</span><span>Milk ₹/L</span><span>Delivery ₹/L</span><span className="text-right">Total</span><span />
                </div>
                {rows.map(r => {
                  const total = (parseFloat(r.milkRate) || 0) + (parseFloat(r.deliveryRate) || 0);
                  return (
                    <div key={r.key} className="grid grid-cols-[1fr_1fr_1fr_56px_28px] gap-2 items-center">
                      <input className={input} type="number" inputMode="decimal" min={0} value={r.fromLitres} onChange={e => setRow(r.key, { fromLitres: e.target.value })} />
                      <input className={input} type="number" inputMode="decimal" min={0} value={r.milkRate} onChange={e => setRow(r.key, { milkRate: e.target.value })} />
                      <input className={input} type="number" inputMode="decimal" min={0} placeholder="None" value={r.deliveryRate} onChange={e => setRow(r.key, { deliveryRate: e.target.value })} />
                      <span className="text-right font-black text-brand text-[14px]">₹{Math.round(total)}</span>
                      <button onClick={() => setRows(p => p.filter(x => x.key !== r.key))} className="w-7 h-7 rounded-full hover:bg-red-50 flex items-center justify-center text-gray-300 hover:text-danger"><Trash2 size={13} /></button>
                    </div>
                  );
                })}
                {preview.length > 0 && (
                  <div className="bg-surface2 rounded-xl p-3 mt-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-text3 mb-1.5">What the customer sees</div>
                    <PriceSlabTable slabs={preview} compact totalLabel="They pay" />
                  </div>
                )}
              </div>
            )}
          </div>

          {customer && (
            <a href={`/my-milk?customer=${customer.id}`}
              className="flex items-center justify-center gap-1.5 text-[12px] font-bold py-2.5 rounded-xl border border-brand/30 text-brand hover:bg-brand/5">
              <Eye size={14} /> View as customer
            </a>
          )}

          {/* ── Login ── */}
          {customer && isAdmin && (
            <div className="border-t border-gray-100 pt-4">
              <h3 className="text-[13px] font-bold text-text flex items-center gap-1.5 mb-1"><KeyRound size={14} className="text-brand" /> Customer login</h3>
              <p className="text-[11px] text-text3 mb-3">
                {login?.hasLogin
                  ? <>Signs in as <b className="text-text2">{login.username}</b> and sees only their own daily milk and bill.</>
                  : 'Give the customer a login to see the milk delivered to them each day and their bill.'}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={label}>Username</label><input className={input} autoCapitalize="none" value={username} onChange={e => setUsername(e.target.value)} /></div>
                <div><label className={label}>{login?.hasLogin ? 'New password (optional)' : 'Password'}</label><input className={input} type="text" autoComplete="off" value={password} onChange={e => setPassword(e.target.value)} /></div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={saveLogin} disabled={savingLogin}
                  className="text-[12px] font-bold px-4 py-2 rounded-lg border-2 border-brand text-brand hover:bg-brand hover:text-white transition-all disabled:opacity-50">
                  {savingLogin ? 'Saving…' : login?.hasLogin ? 'Update login' : 'Create login'}
                </button>
                {login?.hasLogin && (
                  <button onClick={removeLogin} className="text-[12px] font-bold px-4 py-2 rounded-lg text-danger hover:bg-red-50">Remove login</button>
                )}
              </div>
            </div>
          )}
          {customer && isAdmin && (
            <div className="border-t border-gray-100 pt-3">
              <button onClick={deleteCustomer} className="text-[12px] font-bold text-danger hover:underline flex items-center gap-1">
                <Trash2 size={12} /> Delete customer
              </button>
            </div>
          )}
          {!customer && isAdmin && (
            <p className="text-[11px] text-text3 border-t border-gray-100 pt-4">Save the customer first, then open it again to create their login.</p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 text-text3 font-semibold text-[14px] hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex-[2] py-3 rounded-xl bg-brand text-white font-black text-[14px] hover:bg-brand-dark disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Customer'}
          </button>
        </div>
      </div>
    </div>
  );
}
