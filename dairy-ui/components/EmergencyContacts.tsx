"use client";

import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { useNotification } from "@/components/NotificationContext";
import { Pencil, Phone, Plus, Trash2, X } from "lucide-react";

export interface EmergencyContact {
  id: number;
  name: string;
  role?: string | null;
  phone: string;
}

const ROLES = ["Vet", "AI technician", "Medicine shop", "Dairy society"];

/** Bottom sheet listing the farm's emergency numbers; tapping one dials it. Contacts are added and edited here too. */
export function ContactsSheet({ title, onClose }: { title?: string; onClose: () => void }) {
  const { showToast, confirm } = useNotification();
  const [contacts, setContacts] = useState<EmergencyContact[] | null>(null);
  const [editing, setEditing] = useState<Partial<EmergencyContact> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () =>
    api.get("/emergency-contacts")
      .then(r => {
        setContacts(r.data || []);
        if ((r.data || []).length === 0) setEditing({ role: "Vet" });
      })
      .catch(() => setContacts([]));

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      if (editing.id) await api.put(`/emergency-contacts/${editing.id}`, editing);
      else await api.post("/emergency-contacts", editing);
      setEditing(null);
      load();
    } catch (err: any) {
      showToast(err?.response?.data?.message || "Could not save the contact.", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = (c: EmergencyContact) =>
    confirm(`Remove ${c.name}?`, async () => {
      await api.delete(`/emergency-contacts/${c.id}`).catch(() => showToast("Could not remove.", "error"));
      load();
    }, "danger");

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/30" onClick={onClose}>
      <div className="w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl p-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-bold text-slate-800">{title || "Emergency contacts"}</div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600" aria-label="Close"><X size={18} /></button>
        </div>

        {contacts === null ? (
          <div className="py-6 text-center text-sm text-slate-400">Loading...</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {contacts.map(c => (
              <div key={c.id} className="flex items-center gap-2 py-2.5">
                <a href={`tel:${c.phone}`} className="flex-1 min-w-0 flex items-center gap-3">
                  <span className="w-9 h-9 flex-none rounded-full border border-slate-200 flex items-center justify-center text-slate-700">
                    <Phone size={16} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-800 truncate">{c.name}</span>
                    <span className="block text-xs text-slate-500">{c.role ? `${c.role} · ` : ""}{c.phone}</span>
                  </span>
                </a>
                <button onClick={() => setEditing(c)} className="p-1.5 text-slate-300 hover:text-slate-600" aria-label={`Edit ${c.name}`}><Pencil size={14} /></button>
                <button onClick={() => remove(c)} className="p-1.5 text-slate-300 hover:text-red-600" aria-label={`Remove ${c.name}`}><Trash2 size={14} /></button>
              </div>
            ))}
            {contacts.length === 0 && !editing && <div className="py-4 text-sm text-slate-500">No numbers saved yet.</div>}
          </div>
        )}

        {editing ? (
          <div className="mt-2 space-y-2 border-t border-slate-100 pt-3">
            <div className="text-xs font-semibold text-slate-500">{editing.id ? "Edit number" : "Add a number"}</div>
            <input value={editing.name || ""} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Name"
              className="w-full text-sm border border-border rounded-lg px-2.5 py-2" />
            <input value={editing.phone || ""} onChange={e => setEditing({ ...editing, phone: e.target.value })} placeholder="Phone number"
              type="tel" inputMode="tel" className="w-full text-sm border border-border rounded-lg px-2.5 py-2" />
            <div className="flex flex-wrap gap-1.5">
              {ROLES.map(r => (
                <button key={r} type="button" onClick={() => setEditing({ ...editing, role: editing.role === r ? null : r })}
                  className={`px-2.5 py-1 rounded-full border text-xs font-medium ${editing.role === r ? "bg-slate-100 border-slate-400 text-slate-800" : "bg-white border-slate-200 text-slate-600"}`}>
                  {r}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              {(contacts?.length || 0) > 0 && (
                <button onClick={() => setEditing(null)} className="text-xs font-semibold text-slate-500 px-3 py-1.5">Cancel</button>
              )}
              <button onClick={save} disabled={saving}
                className="text-xs font-semibold text-white bg-brand rounded-lg px-3 py-1.5 disabled:opacity-50">Save</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setEditing({ role: "Vet" })} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700">
            <Plus size={14} /> Add a number
          </button>
        )}
      </div>
    </div>
  );
}

/** Phone icon that opens the emergency contacts sheet. tone="alert" for use next to a problem. */
export function CallButton({ label, tone = "plain", sheetTitle }: { label?: string; tone?: "plain" | "alert"; sheetTitle?: string }) {
  const [open, setOpen] = useState(false);
  const cls = tone === "alert"
    ? "text-red-600 border-red-200 hover:bg-red-50"
    : "text-slate-600 border-slate-300 hover:bg-slate-50";
  return (
    <>
      <button type="button" onClick={e => { e.stopPropagation(); setOpen(true); }}
        className={`inline-flex items-center gap-1 border rounded-lg ${label ? "px-2 py-1" : "p-1.5"} text-xs font-semibold bg-white ${cls}`}
        aria-label={label || "Emergency contacts"} title="Emergency contacts">
        <Phone size={13} />{label}
      </button>
      {open && <ContactsSheet title={sheetTitle} onClose={() => setOpen(false)} />}
    </>
  );
}
