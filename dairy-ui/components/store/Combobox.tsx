'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface ComboOption { value: string; hint?: string; }

/**
 * Text box with its own dropdown: typing filters the list (matches anywhere in the name),
 * ▾ shows the whole list, and a name that isn't in the list is simply kept as typed (new entry).
 */
export default function Combobox({ value, onChange, options, placeholder, className = '', autoFocus }: {
  value: string; onChange: (v: string) => void; options: ComboOption[];
  placeholder?: string; className?: string; autoFocus?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const q = value.trim().toLowerCase();
  const filtered = showAll || !q ? options : options.filter((o) => o.value.toLowerCase().includes(q));

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const pick = (v: string) => { onChange(v); setOpen(false); setShowAll(false); };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && open && filtered[active]) { e.preventDefault(); pick(filtered[active].value); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative">
      <input value={value} placeholder={placeholder} autoFocus={autoFocus} autoComplete="off"
        onChange={(e) => { onChange(e.target.value); setOpen(true); setShowAll(false); setActive(0); }}
        onFocus={() => setOpen(true)} onKeyDown={onKey}
        className={`${className} pr-8`} />
      <button type="button" tabIndex={-1} aria-label="Show list"
        onClick={() => { setShowAll(!open || !showAll); setOpen(!open || !showAll); }}
        className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-text3 hover:text-brand">
        <ChevronDown size={16} />
      </button>
      {open && filtered.length > 0 && (
        <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-border-custom rounded-lg shadow-lg max-h-56 overflow-auto py-1">
          {filtered.map((o, i) => (
            <li key={o.value}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(o.value)} onMouseEnter={() => setActive(i)}
                className={`w-full text-left px-3 py-2 text-sm flex justify-between gap-2 ${i === active ? 'bg-surface2' : ''}`}>
                <span className="font-semibold text-text">{o.value}</span>
                {o.hint && <span className="text-text3 text-[12px] truncate">{o.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
