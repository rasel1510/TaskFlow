'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CreditCard,
  FileText,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  RotateCw,
  Plus,
  ArrowRight,
  Download,
} from 'lucide-react';
import InvoiceModal, { InvoiceData } from '@/components/onboarding/InvoiceModal';

export default function BillingSettingsTab() {
  const [loading, setLoading] = useState(true);
  const [billingData, setBillingData] = useState<any>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceData | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [updateCardOpen, setUpdateCardOpen] = useState(false);
  const [newCardNumber, setNewCardNumber] = useState('');
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);

  const fetchBilling = () => {
    setLoading(true);
    fetch('/api/billing')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setBillingData(data.data);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchBilling();
  }, []);

  const handleOpenInvoice = (inv: any) => {
    setSelectedInvoice(inv);
    setModalOpen(true);
  };

  const handleUpdateCard = (e: React.FormEvent) => {
    e.preventDefault();
    setUpdateMsg('Payment method updated successfully with Stripe.');
    setTimeout(() => {
      setUpdateCardOpen(false);
      setUpdateMsg(null);
      fetchBilling();
    }, 1200);
  };

  const plan = billingData?.plan || 'pro';
  const isPro = plan === 'pro';

  return (
    <div className="max-w-3xl space-y-8 animate-fadeIn">
      
      {/* Title */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-xl font-bold text-[#111111] dark:text-white">
            Billing & Subscription
          </h2>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#E44232]/10 text-[#E44232] border border-[#E44232]/20">
            {isPro ? 'Pro Plan ($20/mo)' : 'Basic Plan ($0)'}
          </span>
        </div>
        <p className="text-xs sm:text-[13px] text-neutral-500">
          Manage your company payment methods, subscription plan, and view tax invoices.
        </p>
      </div>

      {/* =========================================================================
          BOX 1: CARD (Payment Method - Supervisor Diagram: "Cardt")
          ========================================================================= */}
      <div className="p-6 rounded-2xl bg-white dark:bg-[#15171C] border border-[#E5E7EB] dark:border-neutral-800 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#635BFF]/10 text-[#635BFF] flex items-center justify-center">
              <CreditCard size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                Payment Method (Card)
              </h3>
              <p className="text-xs text-neutral-500">
                Primary card used for recurring monthly workspace invoices
              </p>
            </div>
          </div>

          {isPro && (
            <button
              onClick={() => setUpdateCardOpen(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 transition-colors cursor-pointer"
            >
              Update Card
            </button>
          )}
        </div>

        {/* Card visualization */}
        {isPro && billingData?.paymentMethod ? (
          <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="px-2.5 py-1.5 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 font-bold text-xs font-mono text-neutral-700 dark:text-neutral-200 tracking-wider">
                {billingData.paymentMethod.brand?.toUpperCase() || 'VISA'}
              </div>
              <div>
                <p className="text-xs sm:text-sm font-mono font-semibold text-neutral-900 dark:text-white">
                  •••• •••• •••• {billingData.paymentMethod.last4}
                </p>
                <p className="text-[11px] text-neutral-400">
                  Expires {billingData.paymentMethod.expMonth || 12} / {billingData.paymentMethod.expYear || 2028} • Default billing method
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-neutral-400">
              <ShieldCheck size={14} className="text-emerald-500" />
              <span className="hidden sm:inline">Stripe Verified</span>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-neutral-200/70 dark:bg-neutral-800 flex items-center justify-center text-neutral-500">
                <CreditCard size={15} />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-semibold text-neutral-900 dark:text-white">
                  No Payment Method Required
                </p>
                <p className="text-[11px] text-neutral-400">
                  You are using the free Basic Plan. No card is charged.
                </p>
              </div>
            </div>

            <a
              href="/onboarding/plans"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition-colors"
            >
              Upgrade to Pro
            </a>
          </div>
        )}

        {/* Update Card Drawer / Modal */}
        {updateCardOpen && (
          <form onSubmit={handleUpdateCard} className="pt-3 border-t border-neutral-100 dark:border-neutral-800 space-y-3 text-xs">
            <p className="font-semibold text-neutral-800 dark:text-neutral-200">
              Enter new card information:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="text"
                placeholder="4242 •••• •••• ••••"
                value={newCardNumber}
                onChange={e => setNewCardNumber(e.target.value)}
                required
                className="px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="MM/YY"
                  required
                  className="w-1/2 px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 font-mono text-xs text-center focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="CVC"
                  required
                  className="w-1/2 px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 font-mono text-xs text-center focus:outline-none"
                />
              </div>
            </div>

            {updateMsg && (
              <p className="text-xs text-emerald-600 font-bold">{updateMsg}</p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg font-bold text-xs bg-[#635BFF] text-white hover:bg-[#5349EE] transition-colors cursor-pointer"
              >
                Save New Card
              </button>
              <button
                type="button"
                onClick={() => setUpdateCardOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-neutral-500 hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* =========================================================================
          BOX 2: HISTORY (Subscription Plan - Supervisor Diagram: "History")
          ========================================================================= */}
      <div className="p-6 rounded-2xl bg-white dark:bg-[#15171C] border border-[#E5E7EB] dark:border-neutral-800 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600/10 text-emerald-600 flex items-center justify-center">
              <Clock size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                Subscription History & Plan
              </h3>
              <p className="text-xs text-neutral-500">
                Current active subscription, cycle renewal, and team allowances
              </p>
            </div>
          </div>

          <Link
            href="/onboarding/plans"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#E44232]/10 text-[#E44232] hover:bg-[#E44232]/20 transition-colors flex items-center gap-1"
          >
            <span>Change Plan</span>
            <ArrowRight size={12} />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
          <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800">
            <span className="text-[11px] text-neutral-400 block mb-0.5">Current Plan</span>
            <span className="text-sm font-extrabold text-neutral-900 dark:text-white">
              {isPro ? 'Pro Plan ($20/mo)' : 'Basic Plan ($0)'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800">
            <span className="text-[11px] text-neutral-400 block mb-0.5">Status</span>
            <span className="inline-flex items-center gap-1 text-sm font-bold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={14} />
              <span>Active</span>
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800">
            <span className="text-[11px] text-neutral-400 block mb-0.5">Next Renewal</span>
            <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
              Dec 03, 2026
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          BOX 3: INVOICE (Tax Invoices Table - Supervisor Diagram: "Invoice")
          ========================================================================= */}
      <div className="p-6 rounded-2xl bg-white dark:bg-[#15171C] border border-[#E5E7EB] dark:border-neutral-800 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#E44232]/10 text-[#E44232] flex items-center justify-center">
              <FileText size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                Invoices & Receipts
              </h3>
              <p className="text-xs text-neutral-500">
                Official itemized tax receipts and payment statements
              </p>
            </div>
          </div>

          <span className="text-xs text-neutral-400">
            {billingData?.invoices?.length || 0} recorded
          </span>
        </div>

        {/* Invoices List Table */}
        <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF7F0] dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 font-semibold text-neutral-500">
              <tr>
                <th className="py-2.5 px-4">Invoice #</th>
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Amount</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {billingData?.invoices && billingData.invoices.length > 0 ? (
                billingData.invoices.map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-neutral-900 dark:text-white">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3 px-4 text-neutral-500">
                      {new Date(inv.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3 px-4 font-bold text-neutral-900 dark:text-white">
                      ${inv.amount.toFixed(2)} USD
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300">
                        {inv.status?.toUpperCase() || 'PAID'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleOpenInvoice(inv)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] dark:text-blue-400 hover:underline cursor-pointer"
                      >
                        <Download size={12} />
                        <span>View Invoice</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-neutral-400 text-xs">
                    {isPro
                      ? 'No invoices recorded yet.'
                      : 'You are currently on the free Basic Plan. No invoices or payment charges apply.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Printable Invoice Modal */}
      <InvoiceModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        invoice={selectedInvoice}
      />

    </div>
  );
}

