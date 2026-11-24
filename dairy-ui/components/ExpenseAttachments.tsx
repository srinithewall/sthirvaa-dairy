'use client';

import React, { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { Paperclip, X, Upload, Trash2, FileText, Download } from 'lucide-react';
import { useNotification } from '@/components/NotificationContext';

export interface ExpenseAttachmentInfo {
  id: number;
  expenseId: number;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt?: string | null;
  uploadedBy?: string | null;
}

/** What the ledger takes as a bill or receipt. */
export const ATTACHMENT_ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp';
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const sizeLabel = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** Uploads one file to an expense; the server answers with the expense's attachment list. */
export async function uploadExpenseAttachment(expenseId: number, file: File): Promise<ExpenseAttachmentInfo[]> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await api.post(`/expenses/${expenseId}/attachments`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  return res.data;
}

/** Files that are too big are reported and left out. */
export function checkFiles(files: File[], showToast: (m: string, t?: any) => void): File[] {
  const ok = files.filter(f => f.size <= MAX_ATTACHMENT_BYTES);
  if (ok.length < files.length) showToast('Files over 10 MB were left out.', 'error');
  return ok;
}

/** Pop-up with an expense's bills and receipts: view, add and remove them. */
export default function ExpenseAttachmentsModal({ expenseId, title, onClose, onChanged }: {
  expenseId: number;
  title: string;
  onClose: () => void;
  /** Called with the new count after an upload or delete. */
  onChanged?: (count: number) => void;
}) {
  const { showToast, confirm } = useNotification();
  const [items, setItems] = useState<ExpenseAttachmentInfo[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<{ id: number; url: string; type: string; name: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get(`/expenses/${expenseId}/attachments`)
      .then(r => setItems(r.data))
      .catch(() => { setItems([]); showToast('Could not load the attachments.', 'error'); });
  }, [expenseId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Free the preview's blob URL when it changes or the pop-up closes.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  const update = (list: ExpenseAttachmentInfo[]) => { setItems(list); onChanged?.(list.length); };

  const upload = async (picked: FileList | null) => {
    const files = checkFiles(Array.from(picked ?? []), showToast);
    if (inputRef.current) inputRef.current.value = '';
    if (files.length === 0) return;
    setUploading(true);
    try {
      let list: ExpenseAttachmentInfo[] | null = null;
      for (const f of files) list = await uploadExpenseAttachment(expenseId, f);
      if (list) update(list);
      showToast(files.length === 1 ? 'Attachment uploaded.' : `${files.length} attachments uploaded.`);
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Upload failed.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const fetchBlob = async (a: ExpenseAttachmentInfo) =>
    (await api.get(`/expenses/${expenseId}/attachments/${a.id}/file`, { responseType: 'blob' })).data as Blob;

  const view = async (a: ExpenseAttachmentInfo) => {
    if (preview?.id === a.id) { setPreview(null); return; }
    try {
      const blob = await fetchBlob(a);
      setPreview({ id: a.id, url: URL.createObjectURL(blob), type: a.contentType, name: a.fileName });
    } catch {
      showToast('Could not open the file.', 'error');
    }
  };

  const download = async (a: ExpenseAttachmentInfo) => {
    try {
      const url = URL.createObjectURL(await fetchBlob(a));
      const link = document.createElement('a');
      link.href = url;
      link.download = a.fileName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      showToast('Could not download the file.', 'error');
    }
  };

  const remove = (a: ExpenseAttachmentInfo) => {
    confirm(`Remove "${a.fileName}"?`, async () => {
      try {
        const res = await api.delete(`/expenses/${expenseId}/attachments/${a.id}`);
        if (preview?.id === a.id) setPreview(null);
        update(res.data);
        showToast('Attachment removed.');
      } catch (err: any) {
        showToast(err.response?.data?.message || 'Could not remove it.', 'error');
      }
    }, 'danger');
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose} role="dialog" aria-modal="true" aria-label="Expense attachments">
      <div className="bg-white w-full sm:max-w-lg max-h-[92vh] rounded-t-[20px] sm:rounded-[20px] overflow-hidden shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-border-custom flex items-center gap-2">
          <Paperclip size={16} className="text-danger" />
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-black uppercase tracking-widest text-text2">Attachments</div>
            <div className="text-[11px] text-text3 truncate">{title}</div>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-text3 hover:text-text hover:bg-surface2"><X size={20} /></button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          {items === null ? (
            <div className="text-[13px] text-text3">Loading…</div>
          ) : items.length === 0 ? (
            <div className="text-[13px] text-text3">No bills or receipts yet.</div>
          ) : (
            <ul className="divide-y divide-border-custom border border-border-custom rounded-lg">
              {items.map(a => (
                <li key={a.id} className={`flex items-center gap-2 px-3 py-2 ${preview?.id === a.id ? 'bg-surface2' : ''}`}>
                  <FileText size={16} className="text-text3 flex-shrink-0" />
                  <button onClick={() => view(a)} className="flex-1 min-w-0 text-left" title="View">
                    <div className="text-[13px] font-bold text-text truncate">{a.fileName}</div>
                    <div className="text-[11px] text-text3">
                      {sizeLabel(a.sizeBytes)}
                      {a.uploadedAt && ` · ${new Date(a.uploadedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`}
                      {a.uploadedBy && ` · ${a.uploadedBy}`}
                    </div>
                  </button>
                  <button onClick={() => download(a)} aria-label={`Download ${a.fileName}`} title="Download"
                    className="p-2 rounded-lg text-text3 hover:text-brand hover:bg-white"><Download size={16} /></button>
                  <button onClick={() => remove(a)} aria-label={`Remove ${a.fileName}`} title="Remove"
                    className="p-2 rounded-lg text-text3 hover:text-danger hover:bg-white"><Trash2 size={16} /></button>
                </li>
              ))}
            </ul>
          )}

          {preview && (
            <div className="border border-border-custom rounded-lg overflow-hidden bg-surface2">
              {preview.type.startsWith('image/') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.url} alt={preview.name} className="w-full max-h-[55vh] object-contain" />
              ) : (
                <iframe src={preview.url} title={preview.name} className="w-full h-[55vh] bg-white" />
              )}
            </div>
          )}

          <input ref={inputRef} type="file" multiple accept={ATTACHMENT_ACCEPT} className="hidden"
            onChange={e => upload(e.target.files)} />
          <button onClick={() => inputRef.current?.click()} disabled={uploading}
            className="w-full h-11 rounded-lg bg-danger text-white text-[13px] font-black flex items-center justify-center gap-2 disabled:opacity-50">
            <Upload size={16} /> {uploading ? 'UPLOADING…' : 'UPLOAD BILL / RECEIPT'}
          </button>
          <div className="text-[11px] text-text3 text-center">PDF, JPG, PNG or WEBP · up to 10 MB each</div>
        </div>
      </div>
    </div>
  );
}
