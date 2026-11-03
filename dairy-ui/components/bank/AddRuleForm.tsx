'use client';

import React, { useMemo, useState } from 'react';
import api from '@/lib/api';
import { FIXED_CATEGORY, LineType, TYPE_LABEL, TYPES_IN, TYPES_OUT, categoryLabel, categoryOptions, kindForType } from '@/lib/bank';
import { Plus } from 'lucide-react';

interface Category { id: number; name: string; type: 'EXPENSE' | 'INCOME' }

type Then = LineType | 'EMPLOYEE';

/**
 * Teach the app a party: "money from GOPAL RAMASWAMI REDDY is milk sales", or "LOKESH G is an
 * employee, always ask me". The words typed must all appear in the bank narration.
 */
export default function AddRuleForm({ categories, onAdded, onError }: {
  categories: Category[];
  onAdded: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [pattern, setPattern] = useState('');
  const [direction, setDirection] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [then, setThen] = useState<Then>('SOLD');
  const [category, setCategory] = useState('MILK_SALES');
  const [saving, setSaving] = useState(false);

  const names = (type: 'EXPENSE' | 'INCOME') =>
    [...new Set(categories.filter(c => c.type === type).map(c => c.name))].sort((a, b) => a.localeCompare(b));
  const expenseNames = useMemo(() => names('EXPENSE'), [categories]); // eslint-disable-line react-hooks/exhaustive-deps
  const incomeNames = useMemo(() => names('INCOME'), [categories]); // eslint-disable-line react-hooks/exhaustive-deps

  const choices: Then[] = [...(direction === 'CREDIT' ? TYPES_IN : TYPES_OUT), 'EMPLOYEE'];
  const options = then === 'EMPLOYEE' || then === 'IGNORE' || FIXED_CATEGORY[then] ? [] : categoryOptions(then, expenseNames, incomeNames);

  const pickThen = (t: Then) => {
    setThen(t);
    const opts = t === 'EMPLOYEE' || t === 'IGNORE' || FIXED_CATEGORY[t] ? [] : categoryOptions(t, expenseNames, incomeNames);
    setCategory(t === 'SOLD' || t === 'SALARY' || t === 'BANK_CHARGES' ? opts[0] || '' : '');
  };

  const pickDirection = (d: 'CREDIT' | 'DEBIT') => {
    setDirection(d);
    pickThen(d === 'CREDIT' ? 'SOLD' : 'PURCHASED');
  };

  const valid = pattern.replace(/[^A-Za-z0-9]/g, '').length >= 3 && (options.length === 0 || !!category);

  const add = async () => {
    setSaving(true);
    try {
      const body = then === 'EMPLOYEE'
        ? { pattern, direction: 'ANY', kind: 'EMPLOYEE' }
        : { pattern, direction, kind: kindForType(then), category: FIXED_CATEGORY[then] || (then === 'IGNORE' ? null : category) };
      const res = await api.post('/bank/rules', body);
      const applied = res.data.applied ? ` Applied to ${res.data.applied} open line(s).` : '';
      onAdded(`Rule added for ${res.data.rule.pattern}.${applied}`);
      setPattern('');
    } catch (err: any) {
      onError(err.response?.data?.message || 'Could not add the rule.');
    } finally {
      setSaving(false);
    }
  };

  const select = 'h-9 text-[13px] bg-white border border-border-custom rounded-lg px-2';

  return (
    <div className="bg-white rounded-radius-custom-lg border border-border-custom card-shadow p-4">
      <div className="text-[12px] font-black text-text2 uppercase tracking-widest mb-3">Add a rule</div>
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.4fr)_auto_minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 items-end">
        <label className="block">
          <span className="block text-[11px] font-bold text-text3 mb-1">Name or words in the narration</span>
          <input value={pattern} onChange={e => setPattern(e.target.value)} placeholder="GOPAL RAMASWAMI REDDY"
            className="w-full h-9 text-[13px] border border-border-custom rounded-lg px-2 uppercase" />
        </label>
        <div>
          <span className="block text-[11px] font-bold text-text3 mb-1">Money</span>
          <div className="flex bg-surface2 p-0.5 rounded-lg" role="group" aria-label="Money in or out">
            {(['CREDIT', 'DEBIT'] as const).map(d => (
              <button key={d} type="button" onClick={() => pickDirection(d)} disabled={then === 'EMPLOYEE'}
                className={`px-3 h-8 rounded-md text-[12px] font-bold ${direction === d && then !== 'EMPLOYEE' ? 'bg-white shadow text-text' : 'text-text3'} disabled:opacity-50`}>
                {d === 'CREDIT' ? 'In' : 'Out'}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="block text-[11px] font-bold text-text3 mb-1">Is</span>
          <select value={then} onChange={e => pickThen(e.target.value as Then)} className={`${select} w-full`}>
            {choices.map(c => <option key={c} value={c}>{c === 'EMPLOYEE' ? 'Employee: always ask me' : TYPE_LABEL[c]}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="block text-[11px] font-bold text-text3 mb-1">Category</span>
          {options.length ? (
            <select value={category} onChange={e => setCategory(e.target.value)} className={`${select} w-full`}>
              {!category && <option value="">Choose…</option>}
              {options.map(n => <option key={n} value={n}>{categoryLabel(n)}</option>)}
            </select>
          ) : (
            <select disabled className={`${select} w-full bg-surface2/60 text-text3`}>
              <option>{then === 'EMPLOYEE' ? 'Chosen per line' : then === 'IGNORE' ? '—' : then === 'ADVANCE' ? 'Staff advance' : 'Staff paid cash'}</option>
            </select>
          )}
        </label>
        <button onClick={add} disabled={!valid || saving}
          className="h-9 inline-flex items-center justify-center gap-1.5 px-4 rounded-lg bg-brand text-white text-[12px] font-black disabled:opacity-40">
          <Plus size={14} /> {saving ? 'ADDING...' : 'ADD'}
        </button>
      </div>
      <p className="text-[11px] text-text3 mt-2">
        All the words must appear in the bank&apos;s narration, in any order. Open lines that fit are updated straight away;
        lines you have already set are left as they are.
        {then === 'EMPLOYEE' && ' An employee’s lines, in or out, always wait for you to choose salary, purchase, reimbursement or advance.'}
      </p>
    </div>
  );
}
