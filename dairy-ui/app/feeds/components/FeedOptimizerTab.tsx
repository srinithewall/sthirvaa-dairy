'use client';

import React, { useState, useEffect, useMemo } from 'react';
import api from '@/lib/api';
import {
  Calculator, Plus, Trash2, AlertCircle, ChevronDown, ChevronUp,
  Save, Leaf, Activity, X, Settings2, Calendar, Users, CheckCircle2
} from 'lucide-react';
import FeedingSchedule from './FeedingSchedule';
import { useNotification } from '@/components/NotificationContext';

/**
 * Overlays sit at z-[3000]+ to clear the app chrome: Sidebar is z-[1000] and the
 * other app modals occupy z-[2000]-z-[5000]. Anything below z-[1000] gets covered
 * by the sidebar/navbar, which hides the close button.
 */
const Z_MODAL = 'z-[3000]';
const Z_DIALOG = 'z-[3500]';

/**
 * Nutrient keys as emitted by the backend (NutrientCalculationService.NUTRIENT_KEYS).
 * The lookup below is case-insensitive so a backend rename to camelCase does not
 * silently blank the cards.
 */
const NUTRIENTS = [
  { key: 'DryMatter',    label: 'Dry Matter',    unit: 'kg', reqField: 'dryMatterIntake' },
  { key: 'CrudeProtein', label: 'Crude Protein', unit: 'kg', reqField: 'crudeProteinReq' },
  { key: 'TDN',          label: 'TDN',           unit: 'kg', reqField: 'tdnReq' },
  { key: 'Calcium',      label: 'Calcium',       unit: 'g',  reqField: 'calciumReq' },
];

const pick = (map: any, key: string) => {
  if (!map) return undefined;
  if (map[key] !== undefined) return map[key];
  const hit = Object.keys(map).find(k => k.toLowerCase() === key.toLowerCase());
  return hit ? map[hit] : undefined;
};

const ADEQUACY_STYLE: Record<string, string> = {
  ADEQUATE:  'bg-green-100 text-green-700',
  DEFICIENT: 'bg-red-100 text-red-700',
  EXCESS:    'bg-amber-100 text-amber-700',
};

interface Props {
  /** Raw { feed, nutrition, knowledge } rows, owned by the page and shared across tabs. */
  feeds: any[];
}

export default function FeedOptimizerTab({ feeds: feedRows }: Props) {
  const { showToast, confirm } = useNotification();

  const [herds, setHerds] = useState<any[]>([]);
  const feeds = useMemo(() => (feedRows || []).map((d: any) => d.feed || d), [feedRows]);

  const [selectedAnimalId, setSelectedAnimalId] = useState('');
  const [selectedAnimal, setSelectedAnimal] = useState<any>(null);
  const [isAnimalInfoOpen, setIsAnimalInfoOpen] = useState(false);

  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);

  const [feedType, setFeedType] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('default');
  const [customPlans, setCustomPlans] = useState<any[]>([]);

  const [entries, setEntries] = useState<{ feedId: string; quantityKg: string }[]>([
    { feedId: '', quantityKg: '' },
  ]);

  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);

  // Save dialog, for creating new plans (optionally across several animals). Updating an
  // existing plan does not come through here - it saves directly from the footer.
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [planName, setPlanName] = useState('');
  const [planAnimalIds, setPlanAnimalIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Assign-animals screen for a shared plan, with a per-animal adequacy check.
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignAnimalIds, setAssignAnimalIds] = useState<string[]>([]);
  const [adequacy, setAdequacy] = useState<Record<string, any>>({});
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignSaving, setAssignSaving] = useState(false);

  const isCustomPlanSelected = selectedPlan !== 'default';
  const selectedPlanName =
    customPlans.find(p => String(p.id) === String(selectedPlan))?.planName || '';

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Escape closes the topmost overlay; body scroll is locked while any is open.
  useEffect(() => {
    const anyOpen = isScheduleModalOpen || isCustomizeModalOpen || isSaveDialogOpen || isAssignModalOpen;
    if (!anyOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (isSaveDialogOpen) setIsSaveDialogOpen(false);
      else if (isAssignModalOpen) setIsAssignModalOpen(false);
      else if (isScheduleModalOpen) setIsScheduleModalOpen(false);
      else if (isCustomizeModalOpen) setIsCustomizeModalOpen(false);
    };
    window.addEventListener('keydown', onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isScheduleModalOpen, isCustomizeModalOpen, isSaveDialogOpen, isAssignModalOpen]);

  useEffect(() => {
    if (!selectedAnimalId) {
      setSelectedAnimal(null);
      setResults(null);
      setCustomPlans([]);
      setSelectedPlan('default');
      setIsAnimalInfoOpen(false);
      return;
    }
    const animal = herds.find(h => String(h.id) === String(selectedAnimalId)) || null;
    setSelectedAnimal(animal);
    setIsAnimalInfoOpen(false);
    setSelectedPlan('default');
    loadDefaultPlan(selectedAnimalId);
    loadCustomPlans(selectedAnimalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAnimalId]);

  // Feeds arrive as a prop from the page; only the herd list is fetched here.
  const fetchInitialData = async () => {
    try {
      const herdRes = await api.get('/herds');
      // GET /herds returns { herds, counts, total }; tolerate a bare array too.
      const raw = Array.isArray(herdRes.data) ? herdRes.data : (herdRes.data?.herds || []);
      // DISPOSED (i.e. inactive) lives on `status`, matching every other screen.
      setHerds(raw.filter((h: any) => String(h?.status || '').toUpperCase() !== 'DISPOSED'));
    } catch (err) {
      console.error('Failed to load animals', err);
    }
  };

  const loadDefaultPlan = async (animalId: string) => {
    setLoading(true);
    try {
      const res = await api.get('/feeds/default-plan', { params: { animalId } });
      const plan = res.data;
      applyPlanFeeds(plan?.feeds);
      // Auto-show the results panel only when the backend actually computed totals.
      setResults(plan?.totals ? plan : null);
    } catch (err) {
      console.error('Failed to load default plan', err);
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomPlans = async (animalId: string) => {
    try {
      const res = await api.get('/feed-plans', { params: { animalId } });
      setCustomPlans(res.data || []);
    } catch (err) {
      console.error('Failed to load custom plans', err);
      setCustomPlans([]);
    }
  };

  const applyPlanFeeds = (planFeeds: any[]) => {
    if (planFeeds && planFeeds.length > 0) {
      setEntries(
        planFeeds.map((f: any) => ({
          feedId: String(f.feedId ?? ''),
          quantityKg: String(f.quantityKg ?? ''),
        }))
      );
    } else {
      setEntries([{ feedId: '', quantityKg: '' }]);
    }
  };

  /** Feed lines from a saved plan, in the shape /feeds/optimize expects. */
  const toFeedEntries = (planFeeds: any[]) =>
    (planFeeds || [])
      .map((f: any) => ({
        feedId: f.feedId != null ? Number(f.feedId) : null,
        quantityKg: f.quantityKg != null ? Number(f.quantityKg) : null,
      }))
      .filter(e => e.feedId && e.quantityKg);

  /**
   * Evaluates a ration against the selected animal. Takes the lines explicitly rather
   * than reading `entries`, because callers that have just loaded a plan would otherwise
   * race the state update and evaluate the previous plan's feeds.
   */
  const evaluateRation = async (feedEntries: { feedId: number | null; quantityKg: number | null }[]) => {
    if (!selectedAnimalId || feedEntries.length === 0) {
      setResults(null);
      return;
    }
    setCalculating(true);
    try {
      const res = await api.post('/feeds/optimize', {
        animalId: parseInt(selectedAnimalId, 10),
        animalStage: selectedAnimal?.animalStatus || null,
        feedEntries,
      });
      setResults(res.data);
    } catch (err) {
      console.error('Failed to calculate ration', err);
      showToast('Could not calculate the ration. Please try again.', 'error');
      setResults(null);
    } finally {
      setCalculating(false);
    }
  };

  const handlePlanChange = async (value: string) => {
    setSelectedPlan(value);
    if (!selectedAnimalId) return;
    if (value === 'default') {
      loadDefaultPlan(selectedAnimalId);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get(`/feed-plans/${value}`);
      const planFeeds = res.data?.feeds;
      applyPlanFeeds(planFeeds);
      // Evaluate straight away so the results panel matches the plan just loaded,
      // rather than going blank until the user finds the Calculate button.
      await evaluateRation(toFeedEntries(planFeeds));
    } catch (err) {
      console.error('Failed to load plan', err);
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  const buildFeedEntries = () =>
    entries
      .map(e => ({
        feedId: e.feedId ? parseInt(e.feedId, 10) : null,
        quantityKg: e.quantityKg ? parseFloat(e.quantityKg) : null,
      }))
      .filter(e => e.feedId && e.quantityKg);

  const handleCalculate = async () => {
    if (!selectedAnimalId) return showToast('Select an animal first.', 'warning');
    const feedEntries = buildFeedEntries();
    if (feedEntries.length === 0) return showToast('Add at least one feed with a quantity.', 'warning');

    await evaluateRation(feedEntries);
  };

  const openSaveDialog = () => {
    if (!selectedAnimalId) return showToast('Select an animal first.', 'warning');
    if (buildFeedEntries().length === 0)
      return showToast('Add at least one feed with a quantity.', 'warning');

    setPlanName('');
    setPlanAnimalIds([String(selectedAnimalId)]);
    setIsSaveDialogOpen(true);
  };

  /**
   * Saves straight over the selected plan and closes - no confirmation step, since the
   * user reached this from an explicit "Update Plan" click on a named plan.
   */
  const handleUpdatePlan = async () => {
    if (!isCustomPlanSelected) return;
    const feedEntries = buildFeedEntries();
    if (feedEntries.length === 0)
      return showToast('Add at least one feed with a quantity.', 'warning');

    setSaving(true);
    try {
      await api.put(`/feed-plans/${selectedPlan}`, {
        planName: selectedPlanName,
        feedEntries,
      });
      await loadCustomPlans(selectedAnimalId);
      setIsCustomizeModalOpen(false);
      showToast(`Plan "${selectedPlanName}" updated.`, 'success');
      await evaluateRation(feedEntries);
    } catch (err) {
      console.error('Failed to update plan', err);
      showToast('Could not update the plan. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Opens the assign screen: current assignments, plus an adequacy check across every
   * active animal so the user can see who this ration actually suits before ticking them.
   */
  const openAssignModal = async () => {
    if (!isCustomPlanSelected) return;
    setIsAssignModalOpen(true);
    setAssignLoading(true);
    setAdequacy({});
    try {
      const detail = await api.get(`/feed-plans/${selectedPlan}`);
      setAssignAnimalIds(
        (detail.data?.assignments || []).map((a: any) => String(a.animalId))
      );

      const res = await api.post(`/feed-plans/${selectedPlan}/adequacy`, {
        animalIds: herds.map(h => Number(h.id)),
      });
      const byAnimal: Record<string, any> = {};
      (res.data || []).forEach((row: any) => {
        byAnimal[String(row.animalId)] = row;
      });
      setAdequacy(byAnimal);
    } catch (err) {
      console.error('Failed to load plan assignments', err);
      showToast('Could not load this plan\u2019s animals.', 'error');
    } finally {
      setAssignLoading(false);
    }
  };

  const toggleAssignAnimal = (id: string) => {
    setAssignAnimalIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSaveAssignments = async () => {
    setAssignSaving(true);
    try {
      // Replaces the whole set - the checkbox list is the source of truth.
      await api.put(`/feed-plans/${selectedPlan}/assignments`, {
        animalIds: assignAnimalIds.map(id => Number(id)),
      });
      await loadCustomPlans(selectedAnimalId);
      setIsAssignModalOpen(false);
      showToast(
        assignAnimalIds.length === 0
          ? `"${selectedPlanName}" is no longer assigned to any animal.`
          : `"${selectedPlanName}" now applies to ${assignAnimalIds.length} animal(s).`,
        'success'
      );
    } catch (err) {
      console.error('Failed to save assignments', err);
      showToast('Could not save the animals. Please try again.', 'error');
    } finally {
      setAssignSaving(false);
    }
  };

  const deficientAssignedCount = assignAnimalIds.filter(
    id => adequacy[id]?.overallStatus === 'DEFICIENT'
  ).length;

  const togglePlanAnimal = (id: string) => {
    setPlanAnimalIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSavePlan = async () => {
    const name = planName.trim();
    if (!name) return showToast('Give the plan a name.', 'warning');

    if (planAnimalIds.length === 0) return showToast('Pick at least one animal.', 'warning');

    const feedEntries = buildFeedEntries();
    setSaving(true);
    try {
      // The API stores one plan per animal, so a multi-animal save writes one
      // identically-named plan per selected animal rather than a single shared record.
      await Promise.all(
        planAnimalIds.map(id =>
          api.post('/feed-plans', {
            animalId: parseInt(id, 10),
            planName: name,
            feedEntries,
          })
        )
      );
      await loadCustomPlans(selectedAnimalId);
      setIsSaveDialogOpen(false);
      showToast(
        planAnimalIds.length === 1
          ? `Plan "${name}" saved.`
          : `Plan "${name}" saved for ${planAnimalIds.length} animals.`,
        'success'
      );
    } catch (err) {
      console.error('Failed to save plan', err);
      showToast('Could not save the plan. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlan = () => {
    if (!isCustomPlanSelected) return;
    const planId = selectedPlan;
    const name = selectedPlanName;

    confirm(
      `Delete the plan "${name}"? This cannot be undone.`,
      async () => {
        try {
          await api.delete(`/feed-plans/${planId}`);
          // Fall back to the default plan, which is always available.
          setSelectedPlan('default');
          await loadCustomPlans(selectedAnimalId);
          await loadDefaultPlan(selectedAnimalId);
          showToast(`Plan "${name}" deleted.`, 'success');
        } catch (err) {
          console.error('Failed to delete plan', err);
          showToast('Could not delete the plan. Please try again.', 'error');
        }
      },
      'danger'
    );
  };

  const updateEntry = (index: number, field: string, value: string) => {
    const next = [...entries];
    next[index] = { ...next[index], [field]: value };
    setEntries(next);
  };

  const addEntry = () => {
    if (entries.length < 20) setEntries([...entries, { feedId: '', quantityKg: '' }]);
  };

  const removeEntry = (index: number) => {
    const next = [...entries];
    next.splice(index, 1);
    setEntries(next.length ? next : [{ feedId: '', quantityKg: '' }]);
  };

  const feedTypes = Array.from(
    new Set(feeds.map(f => f?.category).filter(Boolean))
  ).sort();

  const visibleFeeds = feedType ? feeds.filter(f => f.category === feedType) : feeds;

  const scheduleFeeds = entries
    .map(e => {
      const feed = feeds.find(f => String(f.id) === String(e.feedId));
      return feed && e.quantityKg
        ? { feedName: feed.feedName, quantityKg: parseFloat(e.quantityKg) }
        : null;
    })
    .filter(Boolean) as { feedName: string; quantityKg: number }[];

  const addRecs: any[] = results?.addRecommendations || [];
  const reduceRecs: any[] = results?.reduceRecommendations || [];

  const renderCards = () => (
    <div className="grid grid-cols-2 gap-4">
      {NUTRIENTS.map(n => {
        const ns = pick(results?.nutrientStatus, n.key);
        const actual = ns?.current ?? pick(results?.totals, n.key);
        const req = ns?.required ?? results?.requirements?.[n.reqField];
        const status = ns?.status ?? pick(results?.status, n.key);
        return (
          <ResultCard
            key={n.key}
            label={n.label}
            actual={actual}
            req={req}
            unit={n.unit}
            status={status}
          />
        );
      })}
    </div>
  );

  const renderFinalStatus = () =>
    results?.finalStatus ? (
      <div className="bg-[#F5F9F6] border border-green-200 rounded-xl p-4 text-[13px] text-green-800 font-semibold">
        {results.finalStatus}
      </div>
    ) : null;

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-6">
        {/* ---------- Left panel: animal + plan selection ---------- */}
        <div className="flex-1 space-y-6">
          {/* Step 1 - Animal */}
          <div className="bg-surface rounded-xl border border-border-custom p-5 shadow-sm">
            <h3 className="text-[14px] font-bold mb-4 flex items-center gap-2">
              <CowIcon /> 1. Select Animal
            </h3>

            <select
              value={selectedAnimalId}
              onChange={e => setSelectedAnimalId(e.target.value)}
              className="w-full border border-border-custom rounded-xl p-2.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-brand bg-white"
            >
              <option value="">Select Animal...</option>
              {herds.map(h => (
                <option key={h.id} value={h.id}>
                  {[h.animalName || h.tagNumber, h.breed || '—', h.weightStatus || 'Unknown'].join(' | ')}
                </option>
              ))}
            </select>

            {selectedAnimal && (
              <div className="mt-3 border border-border-custom rounded-xl overflow-hidden">
                <button
                  onClick={() => setIsAnimalInfoOpen(o => !o)}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-surface2 text-[12px] font-bold text-text2 hover:bg-surface2/70 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Activity size={14} /> Animal Information
                  </span>
                  {isAnimalInfoOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {isAnimalInfoOpen && (
                  <div className="p-3 grid grid-cols-2 gap-x-4 gap-y-2 bg-white">
                    <InfoRow label="Breed" value={selectedAnimal.breed} />
                    <InfoRow label="Age" value={selectedAnimal.calculatedAge || selectedAnimal.age} />
                    <InfoRow label="Stage" value={results?.resolvedStage || selectedAnimal.animalStatus} />
                    <InfoRow label="DIM" value={selectedAnimal.dim != null ? `${selectedAnimal.dim} days` : null} />
                    <InfoRow
                      label="Avg Milk"
                      value={
                        selectedAnimal.avgMilk30Days != null
                          ? `${Math.round(selectedAnimal.avgMilk30Days * 10) / 10} L/day`
                          : null
                      }
                    />
                    <InfoRow
                      label="Weight"
                      value={selectedAnimal.calculatedWeight ? `${selectedAnimal.calculatedWeight} kg` : null}
                    />
                    <InfoRow label="Weight Status" value={selectedAnimal.weightStatus} />
                    <InfoRow label="Pregnancy" value={selectedAnimal.pregnancyStatus || 'Not pregnant'} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 2 - Plan */}
          <div className="bg-surface rounded-xl border border-border-custom p-5 shadow-sm">
            <h3 className="text-[14px] font-bold mb-4 flex items-center gap-2">
              <LeafIcon /> 2. Select Plan
            </h3>

            <div className="flex items-center gap-2">
              <select
                value={selectedPlan}
                onChange={e => handlePlanChange(e.target.value)}
                disabled={!selectedAnimalId}
                className="flex-1 min-w-0 border border-border-custom rounded-xl p-2.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-brand bg-white disabled:bg-surface2 disabled:text-text3"
              >
                <option value="default">Default Plan (Recommended)</option>
                {customPlans.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.planName}
                  </option>
                ))}
              </select>
              {isCustomPlanSelected && (
                <button
                  onClick={handleDeletePlan}
                  title="Delete this plan"
                  aria-label="Delete this plan"
                  className="flex-shrink-0 p-2.5 text-danger border border-border-custom rounded-xl hover:bg-danger/10 hover:border-danger transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            {isCustomPlanSelected && (
              <>
                <button
                  onClick={openAssignModal}
                  className="mt-3 w-full flex items-center justify-center gap-2 border border-border-custom text-text2 font-semibold py-2 rounded-xl hover:border-brand hover:text-brand transition-colors text-[12px]"
                >
                  <Users size={16} /> Manage Animals
                </button>
                <p className="text-[11px] text-text3 mt-1.5">
                  Editing a saved plan — use Customize Ration to change its feeds.
                </p>
              </>
            )}

            <button
              onClick={() => setIsCustomizeModalOpen(true)}
              disabled={!selectedAnimalId}
              className="mt-4 w-full bg-brand text-white font-bold py-2.5 rounded-xl hover:bg-brand-dark transition-colors flex items-center justify-center gap-2 text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Settings2 size={16} /> Customize Ration
            </button>
          </div>
        </div>

        {/* ---------- Right panel: results ---------- */}
        <div className="flex-[1.2] bg-surface rounded-xl border border-border-custom p-5 shadow-sm">
          <h3 className="text-[15px] font-bold mb-4">3. Ration Results</h3>

          {loading ? (
            <div className="h-48 flex flex-col items-center justify-center text-text3 italic gap-2 text-[13px]">
              <Calculator size={32} className="opacity-20" />
              <p>Loading plan...</p>
            </div>
          ) : !results ? (
            <div className="h-48 flex flex-col items-center justify-center text-text3 italic gap-2 text-[13px]">
              <Calculator size={32} className="opacity-20" />
              <p>Select an animal to view its recommended ration.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {renderCards()}

              {(addRecs.length > 0 || reduceRecs.length > 0) && (
                <div className="bg-[#FFF8E6] border border-accent/30 rounded-xl p-4">
                  <h4 className="font-bold text-[13px] flex items-center gap-2 text-accent-dark mb-3">
                    <AlertCircle size={16} /> Recommended Adjustments
                  </h4>

                  {addRecs.length > 0 && (
                    <div className="mb-3">
                      <div className="text-[11px] font-black uppercase tracking-wide text-green-700 mb-1">Add</div>
                      <ul className="space-y-1 pl-5 list-disc text-[12px] text-text2">
                        {addRecs.map((r, i) => (
                          <li key={i}>
                            {r.name} <span className="font-semibold text-text">{r.amount}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {reduceRecs.length > 0 && (
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-wide text-red-700 mb-1">Reduce</div>
                      <ul className="space-y-1 pl-5 list-disc text-[12px] text-text2">
                        {reduceRecs.map((r, i) => (
                          <li key={i}>
                            {r.name} <span className="font-semibold text-text">{r.amount}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {renderFinalStatus()}

              <button
                onClick={() => setIsScheduleModalOpen(true)}
                disabled={scheduleFeeds.length === 0}
                className="w-full border border-border-custom text-text2 font-semibold py-2.5 rounded-xl hover:border-brand hover:text-brand transition-colors flex items-center justify-center gap-2 text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Calendar size={16} /> View Daily Feed Schedule
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ---------- Feeding schedule modal ---------- */}
      {isScheduleModalOpen && (
        <div
          className={`fixed inset-0 ${Z_MODAL} bg-black/50 backdrop-blur-sm flex items-center justify-center p-4`}
          onClick={() => setIsScheduleModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-border-custom">
              <h3 className="text-[15px] font-bold flex items-center gap-2">
                <Calendar size={18} /> Daily Feed Schedule
              </h3>
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                aria-label="Close"
                className="p-1.5 rounded-lg text-text3 hover:bg-surface2 hover:text-text transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              <FeedingSchedule feeds={scheduleFeeds} />
            </div>
            <div className="flex-shrink-0 flex justify-end px-5 py-3 border-t border-border-custom">
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                className="text-[13px] font-semibold text-text2 border border-border-custom px-4 py-2 rounded-xl hover:border-brand hover:text-brand transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Customize ration modal ---------- */}
      {isCustomizeModalOpen && (
        <div
          className={`fixed inset-0 ${Z_MODAL} bg-black/50 backdrop-blur-sm flex items-center justify-center p-4`}
          onClick={() => setIsCustomizeModalOpen(false)}
        >
          {/* max-h keeps the header (and its close button) on screen: a fixed 95vh
              plus the backdrop's padding overflowed the viewport and clipped the top. */}
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-5xl h-[95vh] max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex-shrink-0 flex items-start justify-between px-5 py-4 border-b border-border-custom">
              <div className="min-w-0">
                <h3 className="text-[15px] font-bold flex items-center gap-2">
                  <Settings2 size={18} /> Customize Ration
                </h3>
                <p className="text-[12px] text-text3 mt-0.5">
                  {[
                    selectedAnimal?.animalName || selectedAnimal?.tagNumber,
                    selectedAnimal?.breed,
                    selectedPlan === 'default'
                      ? 'Default Plan'
                      : customPlans.find(p => String(p.id) === String(selectedPlan))?.planName,
                  ]
                    .filter(Boolean)
                    .join(' • ')}
                </p>
              </div>
              <button
                onClick={() => setIsCustomizeModalOpen(false)}
                aria-label="Close"
                className="flex-shrink-0 ml-3 p-1.5 rounded-lg text-text3 hover:bg-surface2 hover:text-text transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Two-column body */}
            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
              {/* Left: feed inputs */}
              <div className="flex-1 overflow-y-auto p-5 border-b lg:border-b-0 lg:border-r border-border-custom">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-[13px] font-bold flex items-center gap-2">
                    <Leaf size={16} /> Feed Inputs
                  </h4>
                  <span className="text-[11px] text-text3">{entries.length}/20 Slots</span>
                </div>

                <select
                  value={feedType}
                  onChange={e => setFeedType(e.target.value)}
                  className="w-full border border-border-custom rounded-xl p-2 text-[12px] mb-3 focus:outline-none focus:ring-1 focus:ring-brand bg-white"
                >
                  <option value="">All Feed Types</option>
                  {feedTypes.map(t => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>

                <div className="space-y-3">
                  {entries.map((entry, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <select
                        value={entry.feedId}
                        onChange={e => updateEntry(i, 'feedId', e.target.value)}
                        className="flex-1 min-w-0 border border-border-custom rounded-xl p-2 text-[12px] focus:outline-none focus:ring-1 focus:ring-brand bg-white"
                      >
                        <option value="">Select Feed...</option>
                        {visibleFeeds.map(f => (
                          <option key={f.id} value={f.id}>
                            {f.feedName} ({f.category})
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        placeholder="kg"
                        value={entry.quantityKg}
                        onChange={e => updateEntry(i, 'quantityKg', e.target.value)}
                        className="w-20 flex-shrink-0 border border-border-custom rounded-xl p-2 text-[12px] focus:outline-none focus:ring-1 focus:ring-brand"
                      />
                      <button
                        onClick={() => removeEntry(i)}
                        className="p-2 text-danger hover:bg-danger/10 rounded-lg transition-colors flex-shrink-0"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={addEntry}
                  className="mt-4 w-full flex items-center justify-center gap-2 border border-dashed border-border-custom text-brand font-semibold py-2 rounded-xl hover:bg-surface2 transition-colors text-[12px]"
                >
                  <Plus size={16} /> Add Feed
                </button>
              </div>

              {/* Right: live results */}
              <div className="flex-1 overflow-y-auto p-5 bg-surface">
                <h4 className="text-[13px] font-bold mb-3">Live Results</h4>
                {!results ? (
                  <div className="h-40 flex flex-col items-center justify-center text-text3 italic gap-2 text-[13px]">
                    <Calculator size={28} className="opacity-20" />
                    <p>Press Calculate to evaluate this ration.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {renderCards()}
                    {renderFinalStatus()}
                  </div>
                )}
              </div>
            </div>

            {/* Footer - wraps because the custom-plan case adds a fourth button */}
            <div className="flex-shrink-0 flex flex-wrap items-center justify-end gap-2 sm:gap-3 px-5 py-4 border-t border-border-custom">
              <button
                onClick={() => setIsCustomizeModalOpen(false)}
                className="text-[13px] font-semibold text-text3 px-3 py-2 rounded-xl hover:bg-surface2 hover:text-text transition-colors mr-auto"
              >
                Cancel
              </button>
              <button
                onClick={openSaveDialog}
                className="flex items-center gap-2 border border-border-custom text-text2 font-semibold px-4 py-2 rounded-xl hover:border-brand hover:text-brand transition-colors text-[13px]"
              >
                <Save size={16} /> {isCustomPlanSelected ? 'Save as New' : 'Save as Custom Plan'}
              </button>
              {isCustomPlanSelected && (
                <button
                  onClick={handleUpdatePlan}
                  disabled={saving}
                  className="flex items-center gap-2 border border-brand text-brand font-semibold px-4 py-2 rounded-xl hover:bg-brand/5 transition-colors text-[13px] disabled:opacity-60"
                >
                  <Save size={16} /> {saving ? 'Updating...' : 'Update Plan'}
                </button>
              )}
              <button
                onClick={handleCalculate}
                disabled={calculating}
                className="flex items-center gap-2 bg-brand text-white font-bold px-5 py-2 rounded-xl hover:bg-brand-dark transition-colors text-[13px] disabled:opacity-60"
              >
                <Calculator size={16} /> {calculating ? 'Calculating...' : 'Calculate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Assign animals to this plan ---------- */}
      {isAssignModalOpen && (
        <div
          className={`fixed inset-0 ${Z_DIALOG} bg-black/50 backdrop-blur-sm flex items-center justify-center p-4`}
          onClick={() => !assignSaving && setIsAssignModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex-shrink-0 flex items-start justify-between px-5 py-4 border-b border-border-custom">
              <div className="min-w-0">
                <h3 className="text-[15px] font-bold flex items-center gap-2">
                  <Users size={18} /> Animals on this Plan
                </h3>
                <p className="text-[12px] text-text3 mt-0.5 truncate">{selectedPlanName}</p>
              </div>
              <button
                onClick={() => setIsAssignModalOpen(false)}
                aria-label="Close"
                className="flex-shrink-0 ml-3 p-1.5 rounded-lg text-text3 hover:bg-surface2 hover:text-text transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto">
              {assignLoading ? (
                <div className="h-32 flex items-center justify-center text-text3 italic text-[13px]">
                  Checking this ration against each animal...
                </div>
              ) : (
                <>
                  <p className="text-[12px] text-text2 mb-3">
                    The badge shows whether this ration meets each animal&rsquo;s own
                    requirement — the same feeds suit animals differently depending on
                    weight, yield and stage.
                  </p>

                  <div className="border border-border-custom rounded-xl max-h-72 overflow-y-auto divide-y divide-border-custom/60">
                    {herds.map(h => {
                      const row = adequacy[String(h.id)];
                      const status = row?.overallStatus;
                      return (
                        <label
                          key={h.id}
                          className="flex items-center gap-3 px-3 py-2.5 text-[12px] cursor-pointer hover:bg-surface2 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={assignAnimalIds.includes(String(h.id))}
                            onChange={() => toggleAssignAnimal(String(h.id))}
                            className="accent-brand w-4 h-4 flex-shrink-0"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="font-semibold text-text block truncate">
                              {h.animalName || h.tagNumber}
                            </span>
                            <span className="text-text3 text-[11px]">
                              {row?.resolvedStage || h.breed || '—'}
                            </span>
                          </span>
                          {status && (
                            <span
                              className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide ${
                                ADEQUACY_STYLE[status] || 'bg-surface2 text-text3'
                              }`}
                            >
                              {status}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>

                  {deficientAssignedCount > 0 && (
                    <div className="mt-3 bg-[#FFF8E6] border border-accent/30 rounded-xl p-3 text-[12px] text-text2 flex gap-2">
                      <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-accent-dark" />
                      <span>
                        This ration is <span className="font-bold text-text">DEFICIENT</span> for{' '}
                        {deficientAssignedCount} of the animals you have ticked. They will be
                        underfed unless you adjust the plan for them separately.
                      </span>
                    </div>
                  )}

                  {assignAnimalIds.length === 0 && (
                    <p className="text-[11px] text-text3 mt-3">
                      With nobody ticked the plan is kept but applies to no animal.
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="flex-shrink-0 flex items-center justify-end gap-3 px-5 py-4 border-t border-border-custom">
              <span className="text-[11px] text-text3 mr-auto">
                {assignAnimalIds.length} selected
              </span>
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="text-[13px] font-semibold text-text3 px-3 py-2 rounded-xl hover:bg-surface2 hover:text-text transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAssignments}
                disabled={assignSaving || assignLoading}
                className="flex items-center gap-2 bg-brand text-white font-bold px-5 py-2 rounded-xl hover:bg-brand-dark transition-colors text-[13px] disabled:opacity-60"
              >
                <CheckCircle2 size={16} /> {assignSaving ? 'Saving...' : 'Save Animals'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Save as custom plan dialog ---------- */}
      {isSaveDialogOpen && (
        <div
          className={`fixed inset-0 ${Z_DIALOG} bg-black/50 backdrop-blur-sm flex items-center justify-center p-4`}
          onClick={() => !saving && setIsSaveDialogOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-border-custom">
              <h3 className="text-[15px] font-bold flex items-center gap-2">
                <Save size={18} /> Save as Custom Plan
              </h3>
              <button
                onClick={() => setIsSaveDialogOpen(false)}
                aria-label="Close"
                className="p-1.5 rounded-lg text-text3 hover:bg-surface2 hover:text-text transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div>
                <label className="block text-[11px] font-black text-text3 uppercase tracking-wide mb-1.5">
                  Plan Name
                </label>
                <input
                  type="text"
                  autoFocus
                  value={planName}
                  onChange={e => setPlanName(e.target.value)}
                  placeholder="e.g. Monsoon High-Yield Ration"
                  className="w-full border border-border-custom rounded-xl p-2.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-black text-text3 uppercase tracking-wide">
                    Apply To
                  </label>
                  <span className="text-[11px] text-text3">{planAnimalIds.length} selected</span>
                </div>
                <div className="border border-border-custom rounded-xl max-h-52 overflow-y-auto divide-y divide-border-custom/60">
                  {herds.map(h => (
                    <label
                      key={h.id}
                      className="flex items-center gap-3 px-3 py-2 text-[12px] cursor-pointer hover:bg-surface2 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={planAnimalIds.includes(String(h.id))}
                        onChange={() => togglePlanAnimal(String(h.id))}
                        className="accent-brand w-4 h-4 flex-shrink-0"
                      />
                      <span className="font-semibold text-text truncate">
                        {h.animalName || h.tagNumber}
                      </span>
                      <span className="text-text3 truncate ml-auto">{h.breed || '—'}</span>
                    </label>
                  ))}
                </div>
                <p className="text-[11px] text-text3 mt-1.5">
                  Saving to several animals creates one plan each, all sharing this name.
                </p>
              </div>
            </div>

            <div className="flex-shrink-0 flex items-center justify-end gap-3 px-5 py-4 border-t border-border-custom">
              <button
                onClick={() => setIsSaveDialogOpen(false)}
                className="text-[13px] font-semibold text-text3 px-3 py-2 rounded-xl hover:bg-surface2 hover:text-text transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePlan}
                disabled={saving}
                className="flex items-center gap-2 bg-brand text-white font-bold px-5 py-2 rounded-xl hover:bg-brand-dark transition-colors text-[13px] disabled:opacity-60"
              >
                <Save size={16} />
                {saving ? 'Saving...' : 'Save Plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const InfoRow = ({ label, value }: { label: string; value?: string | null }) => (
  <div>
    <div className="text-[10px] font-black uppercase tracking-wide text-text3">{label}</div>
    <div className="text-[12px] font-semibold text-text">{value || '—'}</div>
  </div>
);

const ResultCard = ({ label, actual, req, unit, status }: any) => {
  const s = String(status || '').toUpperCase();
  const isOk = s === 'ADEQUATE' || s === 'OK';
  const isDef = s === 'DEFICIENT';
  return (
    <div
      className={`border rounded-xl p-3 ${
        isOk
          ? 'bg-[#F5F9F6] border-green-200'
          : isDef
          ? 'bg-red-50 border-red-200'
          : 'bg-amber-50 border-amber-200'
      }`}
    >
      <div className="text-[11px] font-bold text-text2 uppercase tracking-wide mb-2 flex justify-between gap-2">
        <span className="truncate">{label}</span>
        <span className={isOk ? 'text-green-600' : isDef ? 'text-red-600' : 'text-amber-600'}>
          {status || '—'}
        </span>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <span className="text-xl font-bold font-mono">
            {actual != null ? Math.round(actual * 100) / 100 : '-'}
          </span>
          <span className="text-[11px] text-text3 ml-1">{unit}</span>
        </div>
        <div className="text-[11px] text-text3 mb-1">
          Req: {req != null ? Math.round(req * 100) / 100 : '-'} {unit}
        </div>
      </div>
    </div>
  );
};

const CowIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 10v4c0 3.3 2.7 6 6 6h6c3.3 0 6-2.7 6-6v-4m-18 0l2-4m16 4l-2-4m-7 4v4"></path></svg>;
const LeafIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"></path><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"></path></svg>;
