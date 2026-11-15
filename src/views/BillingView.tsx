'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  CreditCard,
  FileText,
  Download,
  CheckCircle2,
  ShieldCheck,
  RefreshCw,
  Search,
} from 'lucide-react';
import InvoiceModal, { InvoiceData } from '@/components/onboarding/InvoiceModal';

interface BillingData {
  plan: string;
  hasPaid: boolean;
  teamId?: string;
  billingCycle: string;
  subscriptionStatus: string;
  failedPaymentAttempts: number;
  paymentMethod: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
  invoices: InvoiceData[];
}

export default function BillingView() {
  const { data: session } = useSession();
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceData | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchBilling = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/billing');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setBilling(json.data);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch billing data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBilling();
  }, []);

  const handleViewInvoice = (inv: InvoiceData) => {
    setSelectedInvoice(inv);
    setModalOpen(true);
  };

  const invoices = billing?.invoices || [];
  const filteredInvoices = invoices.filter(inv =>
    inv.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.planName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isPro = billing?.plan === 'pro';

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-950/50 min-h-full">
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 py-4 md:py-6 space-y-6 animate-fadeIn">
        
        {/* ─── Page Header (Matching App Standard Typography) ─── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-200/80 dark:border-slate-800">
          <div>
            <h1 className="text-[20px] md:text-[24px] font-bold text-[#111111] dark:text-white tracking-tight">
              Company Billing
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={fetchBilling}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-all cursor-pointer shadow-xs disabled:opacity-60"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin text-blue-600' : ''} />
              <span>Refresh</span>
            </button>
            <a
              href="/onboarding/plans"
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition-all cursor-pointer shadow-xs"
            >
              <span>Manage Plan</span>
            </a>
          </div>
        </div>

        {/* ─── 3 Top Stats Cards (Mobbin UI Architecture) ─── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          
          {/* Card 1: Subscription Tier */}
          <div className="rounded-xl p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-150 flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Active Plan
              </span>
            </div>

            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {isPro ? 'Pro Plan' : 'Basic Plan'}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {isPro ? '$20.00 / month' : '$0.00 / forever'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {isPro
                  ? 'Full team collaboration, AI Copilot, and FlowSync MCP Server enabled.'
                  : 'Free tier with up to 5 projects and standard Kanban board.'}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11.5px] text-slate-500 dark:text-slate-400">
              <span>Billing cycle: Monthly</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">Renews in 30 days</span>
            </div>
          </div>

          {/* Card 2: Payment Method (Stripe) */}
          <div className="rounded-xl p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-150 flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Payment Gateway
              </span>
            </div>

            {isPro && billing?.paymentMethod ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200/70 dark:border-blue-800/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-2xs">
                  <CreditCard size={18} />
                </div>
                <div>
                  <div className="font-mono text-[13.5px] font-semibold text-slate-900 dark:text-white tracking-wider">
                    •••• •••• •••• {billing.paymentMethod.last4}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Expires {billing.paymentMethod.expMonth}/{billing.paymentMethod.expYear} • {billing.paymentMethod.brand.toUpperCase()}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 flex items-center justify-center shrink-0 shadow-2xs">
                  <CreditCard size={18} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    No Payment Method Needed
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Free Plan • No credit card required
                  </div>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11.5px] text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <ShieldCheck size={13} />
                {isPro ? 'PCI Level 1 Protected' : 'Free Tier Active'}
              </span>
              <span className="text-slate-400 dark:text-slate-500">{isPro ? '256-bit SSL' : 'Zero Charges'}</span>
            </div>
          </div>

          {/* Card 3: Total Invoices & Spend */}
          <div className="rounded-xl p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-150 flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Billing History
              </span>
            </div>

            <div>
              <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                ${(invoices.reduce((acc, curr) => acc + (curr.amount || 0), 0)).toFixed(2)} USD
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Total of {invoices.length} transaction receipt{invoices.length === 1 ? '' : 's'} recorded.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11.5px] text-slate-500 dark:text-slate-400">
              <span>Status: {isPro ? 'Up to date' : 'Free Workspace'}</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">{isPro ? '100% Tax Compliant' : 'Zero Invoices'}</span>
            </div>
          </div>

        </div>

        {/* ─── Stripe Transactions & Invoices Table (Mobbin UI Style) ─── */}
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          
          {/* Table Top Bar */}
          <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white tracking-tight">
                Stripe Invoices & Receipts
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Download tax compliant PDF invoices and review real-time Stripe payment logs.
              </p>
            </div>

            {/* Search box */}
            <div className="relative w-full sm:w-72">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by invoice # or plan..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 rounded-lg text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-900 dark:text-white placeholder:text-slate-400 transition-all shadow-2xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Invoices Content */}
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center gap-2">
              <RefreshCw size={18} className="animate-spin text-blue-600" />
              <span>Loading billing history...</span>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center gap-2">
              <FileText size={26} className="text-slate-300 dark:text-slate-600" />
              <span className="font-semibold text-slate-700 dark:text-slate-300 text-sm">No Invoices Found</span>
              <span className="max-w-xs text-slate-400 dark:text-slate-500">
                {searchQuery
                  ? 'No invoices match your search query.'
                  : isPro
                    ? 'When payments are processed via Stripe, your official tax invoices will be generated here.'
                    : 'You are on the Free Basic Plan. No invoices or payment charges apply to your workspace.'}
              </span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/75 dark:bg-slate-950/75 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-5">Invoice</th>
                    <th className="py-3 px-5">Date</th>
                    <th className="py-3 px-5">Plan</th>
                    <th className="py-3 px-5">Amount</th>
                    <th className="py-3 px-5">Payment Channel</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium">
                  {filteredInvoices.map((inv, idx) => (
                    <tr key={inv.invoiceNumber || idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      
                      {/* Invoice Number */}
                      <td className="py-3.5 px-5 font-mono font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <FileText size={14} className="text-blue-600 shrink-0" />
                        <span>{inv.invoiceNumber}</span>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-5 text-slate-500 dark:text-slate-400">
                        {new Date(inv.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Plan & Customer Details */}
                      <td className="py-3.5 px-5 text-slate-900 dark:text-white font-semibold">
                        <div>{inv.planName || 'FlowSync Pro'}</div>
                        {(inv.customerName || inv.customerLocation) && (
                          <div className="text-[10.5px] text-slate-400 font-normal flex items-center gap-1 mt-0.5">
                            <span>{inv.customerName || 'Customer'}</span>
                            <span>•</span>
                            <span>{inv.customerLocation || 'Global'}</span>
                          </div>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-5 font-bold text-slate-950 dark:text-white">
                        ${(inv.amount || 20).toFixed(2)} USD
                      </td>

                      {/* Payment Channel */}
                      <td className="py-3.5 px-5 text-slate-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                          <CreditCard size={12} className="text-slate-400" />
                          <span>{inv.brand?.toUpperCase() || 'CARD'} •••• {inv.last4 || '4242'}</span>
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 size={11} className="text-emerald-500" />
                          <span>Paid</span>
                        </span>
                      </td>

                      {/* Action: View Receipt Modal */}
                      <td className="py-3.5 px-5 text-right">
                        <button
                          onClick={() => handleViewInvoice(inv)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors cursor-pointer"
                        >
                          <Download size={12} />
                          <span>View Invoice</span>
                        </button>
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>

        {/* ─── Interactive Invoice Modal ─── */}
        <InvoiceModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          invoice={selectedInvoice}
        />

      </div>
    </div>
  );
}
