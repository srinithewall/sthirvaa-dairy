'use client';

import React from 'react';
import { PriceSlab, slabLabel } from '@/lib/customerPricing';

/**
 * A customer's milk price, one row per volume band, with the milk price, the delivery charge and
 * what they pay per litre in their own labelled columns.
 */
export default function PriceSlabTable({ slabs, compact = false, totalLabel = 'Total' }: { slabs: PriceSlab[]; compact?: boolean; totalLabel?: string }) {
  const rows = [...slabs].sort((a, b) => a.fromLitres - b.fromLitres);
  const delivers = (s: PriceSlab) => s.deliveryAvailable !== false;
  const anyDelivery = rows.some(s => delivers(s) && (s.deliveryRate || 0) > 0);
  const anyPickupOnly = rows.some(s => !delivers(s));
  const cell = compact ? 'py-1' : 'py-1.5';
  return (
    <table className={`w-full ${compact ? 'text-[12px]' : 'text-[13px]'}`}>
      <thead>
        <tr className="text-[9px] font-bold uppercase tracking-wider text-text3">
          <th className="text-left font-bold pb-1">Litres per delivery</th>
          <th className="text-right font-bold pb-1">Milk</th>
          {anyDelivery && <th className="text-right font-bold pb-1">Delivery</th>}
          <th className="text-right font-bold pb-1">{totalLabel}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s, i) => {
          const delivery = delivers(s) ? s.deliveryRate || 0 : 0;
          return (
            <tr key={i} className="border-t border-gray-100">
              <td className={`${cell} text-text2`}>{slabLabel(rows, i)}</td>
              <td className={`${cell} text-right text-text2`}>₹{Math.round(s.milkRate)}</td>
              {anyDelivery && (
                <td className={`${cell} text-right ${delivery > 0 ? 'text-text2' : 'text-text3'}`}>
                  {!delivers(s) ? 'Not available' : delivery > 0 ? `₹${Math.round(delivery)}` : 'Free'}
                </td>
              )}
              <td className={`${cell} text-right font-bold text-brand whitespace-nowrap`}>₹{Math.round(s.milkRate + delivery)} / L</td>
            </tr>
          );
        })}
      </tbody>
      {anyDelivery && (
        <tfoot>
          <tr>
            <td colSpan={4} className="pt-1.5 text-[10px] text-text3">
              Prices are per litre. Delivery is charged per litre on top of the milk price.
              {anyPickupOnly && ' Where delivery is not available, collect the milk from the farm.'}
            </td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}
