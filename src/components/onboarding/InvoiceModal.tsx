'use client';

import React from 'react';
import { X, Printer, Download, CheckCircle2, ShieldCheck, Building2, Calendar, CreditCard } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface InvoiceData {
  invoiceNumber: string;
  amount: number;
  currency?: string;
  status: string;
  planName: string;
  billingCycle?: string;
  paymentMethod?: string;
  last4?: string | null;
  brand?: string | null;
  createdAt: string | Date;
  customerName?: string;
  customerEmail?: string;
}

interface InvoiceModalProps {
  open: boolean;
  onClose: () => void;
  invoice: InvoiceData | null;
}

export default function InvoiceModal({ open, onClose, invoice }: InvoiceModalProps) {
  if (!invoice) return null;

  const formattedDate = new Date(invoice.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-xl p-0 overflow-hidden rounded-2xl sm:rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xl">
        
        {/* Modal Top Actions */}
        <div className="bg-[#FAF7F0] dark:bg-neutral-800/80 px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Official Receipt</span>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 uppercase">
              {invoice.status}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 hover:bg-neutral-100 transition-colors cursor-pointer"
            >
              <Printer size={13} />
              <span>Print / PDF</span>
            </button>
          </div>
        </div>

        {/* Printable Invoice Body */}
        <div className="p-6 sm:p-8 space-y-6 text-neutral-800 dark:text-neutral-200" id="printable-invoice">
          
          {/* Header */}
          <div className="flex items-start justify-between border-b border-neutral-200 dark:border-neutral-800 pb-6">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#E44232] text-white flex items-center justify-center font-bold text-sm">
                  FS
                </div>
                <h3 className="text-lg font-extrabold tracking-tight text-neutral-950 dark:text-white">
                  FlowSync Inc.
                </h3>
              </div>
              <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                Task Management & AI Collaboration Platform<br />
                San Francisco, CA 94107 • billing@flowsync.app
              </p>
            </div>

            <div className="text-right">
              <span className="text-xs text-neutral-400 font-mono block">INVOICE NO.</span>
              <span className="text-sm font-mono font-bold text-neutral-950 dark:text-white">
                {invoice.invoiceNumber}
              </span>
              <span className="text-xs text-neutral-500 block mt-1">Date: {formattedDate}</span>
            </div>
          </div>

          {/* Customer / Payment details */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="font-semibold text-neutral-400 uppercase text-[10px] tracking-wider block mb-1">
                Billed To
              </span>
              <p className="font-bold text-neutral-900 dark:text-white">
                {invoice.customerName || 'FlowSync Customer'}
              </p>
              <p className="text-neutral-500">{invoice.customerEmail || 'Customer Workspace'}</p>
            </div>

            <div>
              <span className="font-semibold text-neutral-400 uppercase text-[10px] tracking-wider block mb-1">
                Payment Method
              </span>
              <div className="flex items-center gap-1.5 font-medium text-neutral-800 dark:text-neutral-200 capitalize">
                <CreditCard size={14} className="text-[#E44232]" />
                <span>
                  {invoice.paymentMethod === 'promo_code'
                    ? 'Promotional Voucher (100% Discount)'
                    : `${invoice.brand || 'Card'} ending in ${invoice.last4 || '4242'}`}
                </span>
              </div>
              <span className="text-neutral-500 text-[11px]">Processed via Stripe Gateway</span>
            </div>
          </div>

          {/* Line items table */}
          <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF7F0] dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-800 font-bold text-neutral-600 dark:text-neutral-300">
                <tr>
                  <th className="py-2.5 px-4">Description</th>
                  <th className="py-2.5 px-4 text-center">Interval</th>
                  <th className="py-2.5 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                <tr>
                  <td className="py-3 px-4">
                    <p className="font-bold text-neutral-900 dark:text-white">{invoice.planName}</p>
                    <p className="text-neutral-500 text-[11px]">Full access to FlowSync workspaces, AI Copilot & MCP tools</p>
                  </td>
                  <td className="py-3 px-4 text-center text-neutral-500">
                    {invoice.billingCycle || 'Monthly'}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-neutral-900 dark:text-white">
                    ${invoice.amount.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end pt-2">
            <div className="w-56 space-y-1.5 text-xs">
              <div className="flex justify-between text-neutral-500">
                <span>Subtotal</span>
                <span>${invoice.amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-neutral-500">
                <span>Tax (0%)</span>
                <span>$0.00</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-neutral-950 dark:text-white pt-2 border-t border-neutral-200 dark:border-neutral-800">
                <span>Total Paid</span>
                <span className="text-[#E44232]">${invoice.amount.toFixed(2)} USD</span>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 text-center text-[11px] text-neutral-400">
            Thank you for choosing FlowSync! If you have billing inquiries, reach out to support@flowsync.app.
          </div>

        </div>

      </DialogContent>
    </Dialog>
  );
}

