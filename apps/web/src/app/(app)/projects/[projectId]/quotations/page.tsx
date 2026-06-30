'use client';

/**
 * Quotation Comparison Page — /projects/[projectId]/quotations
 *
 * Renders a matrix comparing supplier quotations for each trade package.
 * - Rows = line items; Columns = suppliers
 * - Lowest rate per row highlighted in green
 * - Summary table shows total per supplier
 * - "Enter Quotation" button opens a manual entry modal
 *
 * Sprint 17 (S17-005)
 */

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiClient } from '@/lib/api/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface QuotationLineItem {
  item_no?: string;
  description: string;
  unit?: string;
  qty?: number | null;
  rate?: number | null;
  amount?: number | null;
}

interface Supplier {
  id: string;
  name: string;
  email?: string | null;
  cidb_grade?: string | null;
}

interface Quotation {
  id: string;
  supplier_id: string;
  trade: string;
  line_items: QuotationLineItem[];
  total_amount: number | null;
  currency: string;
  submitted_at: string;
  validity_days: number;
  notes: string | null;
  status: string;
  suppliers: Supplier;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, dp = 2): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('en-MY', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

const STATUS_BADGE: Record<string, string> = {
  draft:     'bg-gray-100 text-gray-500',
  submitted: 'bg-blue-100 text-blue-700',
  evaluated: 'bg-amber-100 text-amber-700',
  awarded:   'bg-green-100 text-green-700',
  rejected:  'bg-red-100 text-red-500',
};

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function QuotationPage() {
  const { projectId } = useParams<{ projectId: string }>();

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading]       = useState(true);
  const [tradeFilter, setTradeFilter] = useState('');

  // Add quotation modal
  const [showAdd, setShowAdd]   = useState(false);
  const [addForm, setAddForm]   = useState({
    supplier_id: '', trade: '', currency: 'MYR',
    validity_days: 90, notes: '', line_items_text: '',
  });
  const [suppliers, setSuppliers]     = useState<Supplier[]>([]);
  const [saving, setSaving]           = useState(false);
  const [addError, setAddError]       = useState<string | null>(null);
  const [_orgId, setOrgId]             = useState<string | null>(null);

  // Load
  function load() {
    setLoading(true);
    apiClient
      .get<Quotation[]>(`/projects/${projectId}/quotations`)
      .then((res) => setQuotations(res.data ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [projectId]);

  // Load org + suppliers for add modal
  useEffect(() => {
    apiClient.get<{ id: string }[]>('/organizations').then((res) => {
      const org = res.data?.[0];
      if (!org) return;
      setOrgId(org.id);
      apiClient
        .get<Supplier[]>(`/organizations/${org.id}/suppliers?status=active`)
        .then((r) => setSuppliers(r.data ?? []));
    });
  }, []);

  // Unique trades in all quotations
  const allTrades = useMemo(() => {
    const trades = new Set(quotations.map((q) => q.trade));
    return Array.from(trades).sort();
  }, [quotations]);

  const visibleTrade = tradeFilter || (allTrades[0] ?? '');

  // Quotations for the selected trade
  const tradeQuotes = useMemo(
    () => quotations.filter((q) => q.trade === visibleTrade),
    [quotations, visibleTrade],
  );

  // Unique description-keyed items across all quotes in this trade
  const allDescriptions = useMemo(() => {
    const seen = new Set<string>();
    const items: QuotationLineItem[] = [];
    tradeQuotes.forEach((q) => {
      q.line_items.forEach((li) => {
        const key = (li.item_no ?? '') + '||' + li.description;
        if (!seen.has(key)) { seen.add(key); items.push(li); }
      });
    });
    return items;
  }, [tradeQuotes]);

  // Find the rate for a given description from a supplier's quote
  function getRate(quote: Quotation, desc: string, itemNo?: string): number | null {
    const li = quote.line_items.find(
      (i) => i.description === desc && (itemNo === undefined || i.item_no === itemNo),
    );
    return li?.rate ?? null;
  }

  // For each row, find the minimum rate among all suppliers
  function minRate(desc: string, itemNo?: string): number | null {
    const rates = tradeQuotes.map((q) => getRate(q, desc, itemNo)).filter((r): r is number => r !== null);
    return rates.length > 0 ? Math.min(...rates) : null;
  }

  // ── Add quotation handler ───────────────────────────────────────────────────

  async function handleAddQuotation(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setAddError(null);
    try {
      // Parse line items from simple CSV text: description,unit,qty,rate
      const lineItems: QuotationLineItem[] = addForm.line_items_text
        .split('\n')
        .map((row) => row.trim())
        .filter(Boolean)
        .map((row) => {
          const parts = row.split(',').map((p) => p.trim());
          const qty   = parseFloat(parts[2] ?? '');
          const rate  = parseFloat(parts[3] ?? '');
          return {
            description: parts[0] ?? '',
            unit:        parts[1] ?? '',
            qty:         isNaN(qty) ? null : qty,
            rate:        isNaN(rate) ? null : rate,
            amount:      (!isNaN(qty) && !isNaN(rate)) ? qty * rate : null,
          };
        });

      const total = lineItems.reduce((s, li) => s + (li.amount ?? 0), 0);

      await apiClient.post(`/projects/${projectId}/quotations`, {
        supplier_id:   addForm.supplier_id,
        trade:         addForm.trade,
        currency:      addForm.currency,
        validity_days: addForm.validity_days,
        notes:         addForm.notes || undefined,
        line_items:    lineItems,
        total_amount:  total || undefined,
        status:        'submitted',
      });

      setShowAdd(false);
      load();
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
        <Link href={`/projects/${projectId}`} className="text-sm text-gray-400 hover:text-gray-600">
          ← Project
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-sm font-semibold text-gray-900">Quotation Comparison</h1>
        <button
          onClick={() => { setShowAdd(true); setAddError(null); }}
          className="ml-auto px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700"
        >
          + Enter Quotation
        </button>
      </div>

      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-gray-400 animate-pulse">Loading quotations…</p>
        </div>
      )}

      {!loading && quotations.length === 0 && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-sm">
            <div className="text-5xl mb-4">📊</div>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">No Quotations Yet</h2>
            <p className="text-sm text-gray-500 mb-5">
              Enter supplier quotations manually or distribute RFQs via the workflow canvas and record responses here.
            </p>
            <button
              onClick={() => setShowAdd(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              + Enter First Quotation
            </button>
          </div>
        </div>
      )}

      {!loading && quotations.length > 0 && (
        <>
          {/* Trade tabs */}
          <div className="flex items-center gap-1 px-6 py-2 border-b border-gray-200 bg-white flex-shrink-0 overflow-x-auto">
            {allTrades.map((t) => (
              <button
                key={t}
                onClick={() => setTradeFilter(t)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                  visibleTrade === t
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t} ({quotations.filter((q) => q.trade === t).length})
              </button>
            ))}
          </div>

          {/* Summary row — totals per supplier */}
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex-shrink-0 overflow-x-auto">
            <div className="flex gap-3 min-w-max">
              {tradeQuotes.map((q) => {
                const currency = q.currency ?? 'MYR';
                return (
                  <div key={q.id} className="rounded-xl border border-gray-200 bg-white px-4 py-3 min-w-[160px]">
                    <p className="text-xs font-semibold text-gray-800 truncate">{q.suppliers?.name}</p>
                    {q.suppliers?.cidb_grade && (
                      <p className="text-[10px] text-gray-400">CIDB {q.suppliers.cidb_grade}</p>
                    )}
                    <p className="text-sm font-bold text-gray-900 mt-1">
                      {currency} {fmt(q.total_amount)}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_BADGE[q.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {q.status}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {new Date(q.submitted_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Comparison matrix */}
          <div className="flex-1 overflow-auto">
            {allDescriptions.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-12">
                No line items in these quotations.
              </p>
            ) : (
              <table className="w-full text-xs border-collapse" style={{ minWidth: `${200 + tradeQuotes.length * 160}px` }}>
                <thead className="sticky top-0 bg-gray-100 z-10">
                  <tr>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-600 border-b border-gray-200 w-12">
                      Item
                    </th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-600 border-b border-gray-200">
                      Description
                    </th>
                    <th className="text-center px-3 py-2.5 font-semibold text-gray-600 border-b border-gray-200 w-14">
                      Unit
                    </th>
                    <th className="text-right px-3 py-2.5 font-semibold text-gray-600 border-b border-gray-200 w-16">
                      Qty
                    </th>
                    {tradeQuotes.map((q) => (
                      <th
                        key={q.id}
                        className="text-right px-3 py-2.5 font-semibold text-gray-600 border-b border-l border-gray-200 w-32 whitespace-nowrap"
                        title={q.suppliers?.name}
                      >
                        {q.suppliers?.name?.split(' ').slice(0, 2).join(' ') ?? '?'}
                        <span className="block text-[9px] font-normal text-gray-400">
                          Rate ({q.currency})
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allDescriptions.map((item, idx) => {
                    const min = minRate(item.description, item.item_no);
                    return (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-blue-50/20 transition-colors">
                        <td className="px-3 py-2 font-mono text-gray-400 text-[10px]">
                          {item.item_no || '—'}
                        </td>
                        <td className="px-3 py-2 text-gray-800 leading-snug max-w-xs truncate">
                          {item.description}
                        </td>
                        <td className="px-3 py-2 text-center text-gray-500">{item.unit || '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                          {fmt(item.qty, 0)}
                        </td>
                        {tradeQuotes.map((q) => {
                          const rate = getRate(q, item.description, item.item_no);
                          const isLowest = rate !== null && rate === min;
                          return (
                            <td
                              key={q.id}
                              className={`px-3 py-2 text-right tabular-nums border-l border-gray-100 font-medium ${
                                isLowest
                                  ? 'bg-green-50 text-green-700'
                                  : rate !== null
                                  ? 'text-gray-800'
                                  : 'text-gray-300'
                              }`}
                            >
                              {rate !== null ? fmt(rate) : '—'}
                              {isLowest && <span className="ml-1 text-[9px]">✓</span>}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="sticky bottom-0 bg-white border-t-2 border-gray-300">
                  <tr>
                    <td colSpan={4} className="px-3 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Total
                    </td>
                    {tradeQuotes.map((q) => {
                      const isLowest = q.total_amount !== null && q.total_amount ===
                        Math.min(...tradeQuotes.map((x) => x.total_amount ?? Infinity));
                      return (
                        <td
                          key={q.id}
                          className={`px-3 py-2.5 text-right tabular-nums text-sm font-bold border-l border-gray-200 ${
                            isLowest ? 'text-green-700 bg-green-50' : 'text-gray-900'
                          }`}
                        >
                          {fmt(q.total_amount)}
                          {isLowest && <span className="ml-1 text-[9px] text-green-600">★ Lowest</span>}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </>
      )}

      {/* ── Add Quotation Modal ─────────────────────────────────────────────── */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex-shrink-0 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Enter Quotation</h2>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <form onSubmit={handleAddQuotation} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {addError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                  {addError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Supplier <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={addForm.supplier_id}
                    onChange={(e) => setAddForm({ ...addForm, supplier_id: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs bg-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">— Select —</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Trade <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    value={addForm.trade}
                    onChange={(e) => setAddForm({ ...addForm, trade: e.target.value })}
                    placeholder="e.g. Structural"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Currency</label>
                  <select
                    value={addForm.currency}
                    onChange={(e) => setAddForm({ ...addForm, currency: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs bg-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="MYR">MYR</option>
                    <option value="USD">USD</option>
                    <option value="SGD">SGD</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Validity (days)</label>
                  <input
                    type="number"
                    min={1}
                    value={addForm.validity_days}
                    onChange={(e) => setAddForm({ ...addForm, validity_days: parseInt(e.target.value) || 90 })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Line Items
                  <span className="ml-1 font-normal text-gray-400">— one per line: Description, Unit, Qty, Rate</span>
                </label>
                <textarea
                  value={addForm.line_items_text}
                  onChange={(e) => setAddForm({ ...addForm, line_items_text: e.target.value })}
                  rows={6}
                  placeholder={`Reinforced concrete column, m3, 45.5, 850\nFormwork, m2, 120, 35\nRebar, ton, 8.2, 4200`}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-mono focus:outline-none focus:border-blue-500 resize-none"
                />
                <p className="text-[10px] text-gray-400 mt-0.5">Amount = Qty × Rate, computed automatically</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={addForm.notes}
                  onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                  rows={2}
                  placeholder="Any conditions, exclusions…"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-1 pb-2">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save Quotation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
