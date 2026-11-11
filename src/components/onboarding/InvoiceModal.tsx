'use client';

import React from 'react';
import { Printer, CreditCard } from 'lucide-react';
import {
  Dialog,
  DialogContent,
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
      <DialogContent className="max-w-lg p-0 overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xl">
        
        {/* Modal Top Bar */}
        <div className="px-6 py-3.5 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-900/50">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Paid
            </span>
            <span className="text-xs text-neutral-300 dark:text-neutral-700">|</span>
            <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400">
              #{invoice.invoiceNumber}
            </span>
          </div>

          {/* Action button - right margin ensures no overlap with DialogClose button */}
          <div className="flex items-center mr-8">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700 transition-colors cursor-pointer"
            >
              <Printer size={12} />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* Minimalist Invoice Body */}
        <div className="p-6 sm:p-7 space-y-6 text-neutral-800 dark:text-neutral-200" id="printable-invoice">
          
          {/* Company Brand & Invoice Date */}
          <div className="flex items-start justify-between pb-5 border-b border-neutral-100 dark:border-neutral-800">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-md bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 flex items-center justify-center shrink-0">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 50 50">
                    <path d="M27.5308 40.1395C27.5757 35.5502 26.4122 31.8182 24.9322 31.8037C23.4521 31.7893 22.2159 35.4979 22.1711 40.0871C22.1262 44.6764 23.2897 48.4085 24.7697 48.4229C26.2498 48.4374 27.486 44.7288 27.5308 40.1395Z" />
                    <path d="M18.947 39.0972C21.4661 35.2608 22.5052 31.4922 21.268 30.6798C20.0307 29.8674 16.9856 32.3188 14.4666 36.1552C11.9475 39.9916 10.9084 43.7601 12.1456 44.5726C13.3829 45.385 16.4279 42.9336 18.947 39.0972Z" />
                    <path d="M12.2792 33.593C16.4726 31.7278 19.3843 29.1194 18.7827 27.767C18.1812 26.4146 14.2942 26.8304 10.1008 28.6957C5.90744 30.5609 2.99571 33.1693 3.59726 34.5217C4.1988 35.8741 8.08584 35.4583 12.2792 33.593Z" />
                  </svg>
                </div>
                <span className="font-semibold text-sm text-neutral-900 dark:text-white tracking-tight">
                  FlowSync Inc.
                </span>
              </div>
              <p className="text-[11.5px] text-neutral-400 mt-1">billing@flowsync.app</p>
            </div>

            <div className="text-right space-y-0.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-400 block">
                Date Issued
              </span>
              <span className="text-xs font-medium text-neutral-900 dark:text-white">
                {formattedDate}
              </span>
            </div>
          </div>

          {/* Customer & Payment Method */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-400 block mb-1">
                Billed To
              </span>
              <p className="font-medium text-neutral-900 dark:text-white">
                {invoice.customerName || 'FlowSync Customer'}
              </p>
              <p className="text-neutral-400 text-[11px] mt-0.5">
                {invoice.customerEmail || 'Customer Workspace'}
              </p>
            </div>

            <div>
              <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-400 block mb-1">
                Payment Method
              </span>
              <div className="flex items-center gap-1.5 font-medium text-neutral-900 dark:text-white">
                <CreditCard size={13} className="text-neutral-400" />
                <span>
                  {invoice.paymentMethod === 'promo_code'
                    ? 'Promotional Voucher'
                    : `${invoice.brand || 'Card'} ending in ${invoice.last4 || '4242'}`}
                </span>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border border-neutral-100 dark:border-neutral-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50/70 dark:bg-neutral-800/40 border-b border-neutral-100 dark:border-neutral-800 text-[11px] font-medium text-neutral-400 uppercase tracking-wider">
                <tr>
                  <th className="py-2 px-3.5">Description</th>
                  <th className="py-2 px-3.5 text-center">Interval</th>
                  <th className="py-2 px-3.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                <tr>
                  <td className="py-3 px-3.5">
                    <p className="font-medium text-neutral-900 dark:text-white">{invoice.planName}</p>
                    <p className="text-neutral-400 text-[11px] mt-0.5">Subscription fee</p>
                  </td>
                  <td className="py-3 px-3.5 text-center text-neutral-500 capitalize">
                    {invoice.billingCycle || 'Monthly'}
                  </td>
                  <td className="py-3 px-3.5 text-right font-medium text-neutral-900 dark:text-white">
                    ${invoice.amount.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Totals Summary */}
          <div className="flex justify-end pt-1">
            <div className="w-48 space-y-1.5 text-xs">
              <div className="flex justify-between text-neutral-400">
                <span>Subtotal</span>
                <span className="text-neutral-600 dark:text-neutral-300 font-mono">${invoice.amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Tax</span>
                <span className="text-neutral-600 dark:text-neutral-300 font-mono">$0.00</span>
              </div>
              <div className="flex justify-between text-xs font-semibold text-neutral-900 dark:text-white pt-2 border-t border-neutral-100 dark:border-neutral-800">
                <span>Total Paid</span>
                <span className="font-mono">${invoice.amount.toFixed(2)} USD</span>
              </div>
            </div>
          </div>

          {/* Minimalist Footer Note */}
          <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 text-center text-[11px] text-neutral-400">
            Questions about this receipt? Contact support@flowsync.app
          </div>

        </div>

      </DialogContent>
    </Dialog>
  );
}
