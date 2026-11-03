'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  CreditCard,
  FileText,
  Download,
  Printer,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  ArrowUpRight,
  Clock,
  Sparkles,
  RefreshCw,
  Search,
  Building2,
  Lock,
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
  const role = (session?.user as any)?.role || 'Admin';
  const teamName = (session?.user as any)?.teamName || 'Your Company';

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-8 animate-fadeIn">
      
      {/* ─── Page Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800/60 px-2.5 py-0.5 rounded-full">
              {teamName}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">•</span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Admin Billing Portal
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 dark:text-white tracking-tight">
            Company Billing & Stripe Payments
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage your company subscription, view Stripe transaction history, and download official invoices.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchBilling}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-all cursor-pointer shadow-xs"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <a
            href="/onboarding/plans"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all cursor-pointer shadow-sm hover:shadow-md shadow-blue-500/20"
          >
            <Sparkles size={13} />
            <span>Manage Plan</span>
          </a>
        </div>
      </div>

      {/* ─── 3 Top Stats Cards ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Card 1: Subscription Tier */}
        <div className="rounded-2xl p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Active Plan
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Active
            </span>
          </div>

          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-950 dark:text-white">
                {isPro ? 'Pro Plan' : 'Basic Plan'}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {isPro ? '$20.00 / month' : '$0.00 / forever'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {isPro
                ? 'Full team collaboration, AI Copilot, and FlowSync MCP Server enabled.'
                : 'Free tier with up to 5 projects and standard Kanban board.'}
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
            <span>Billing cycle: Monthly</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">Renews in 30 days</span>
          </div>
        </div>

        {/* Card 2: Payment Method (Stripe) */}
        <div className="rounded-2xl p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Payment Gateway
            </span>
            <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
              <Lock size={11} />
              <span>Stripe Test Mode</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <CreditCard size={20} />
            </div>
            <div>
              <div className="font-mono text-sm font-bold text-slate-950 dark:text-white tracking-wider">
                •••• •••• •••• {billing?.paymentMethod?.last4 || '4242'}
              </div>
              <div className="text-xs text-slate-500">
                Expires {billing?.paymentMethod?.expMonth || 12}/{billing?.paymentMethod?.expYear || 2028} • {billing?.paymentMethod?.brand?.toUpperCase() || 'VISA'}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
              <ShieldCheck size={13} />
              PCI Level 1 Protected
            </span>
            <span>256-bit SSL</span>
          </div>
        </div>

        {/* Card 3: Total Invoices & Spend */}
        <div className="rounded-2xl p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Billing History
            </span>
            <span className="text-[11px] text-slate-400 font-medium">All Time</span>
          </div>

          <div>
            <div className="text-2xl font-black text-slate-950 dark:text-white">
              ${(invoices.reduce((acc, curr) => acc + (curr.amount || 0), 0)).toFixed(2)} USD
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Total of {invoices.length} transaction receipt{invoices.length === 1 ? '' : 's'} recorded.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
            <span>Status: Up to date</span>
            <span className="text-blue-600 dark:text-blue-400 font-semibold">100% Tax Compliant</span>
          </div>
        </div>

      </div>

      {/* ─── Stripe Transactions & Invoices Table ─── */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden">
        
        {/* Table Top Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-950 dark:text-white">
              Stripe Invoices & Receipts
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Download tax compliant PDF invoices and review real-time Stripe payment logs.
            </p>
          </div>

          {/* Search box */}
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by invoice #..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        {/* Invoices List */}
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
            <RefreshCw size={20} className="animate-spin text-blue-600" />
            <span>Loading billing history...</span>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
            <FileText size={28} className="text-slate-300 dark:text-slate-600" />
            <span className="font-semibold text-slate-700 dark:text-slate-300 text-sm">No Invoices Found</span>
            <span className="max-w-xs text-slate-400">
              {searchQuery
                ? 'No invoices match your search query.'
                : 'When payments are processed via Stripe, your official tax invoices will be generated here.'}
            </span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
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
                  <tr key={inv.invoiceNumber || idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    
                    {/* Invoice Number */}
                    <td className="py-3.5 px-5 font-mono font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <FileText size={14} className="text-blue-600 shrink-0" />
                      <span>{inv.invoiceNumber}</span>
                    </td>

                    {/* Date */}
                    <td className="py-3.5 px-5 text-slate-500">
                      {new Date(inv.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>

                    {/* Plan */}
                    <td className="py-3.5 px-5 text-slate-900 dark:text-white font-semibold">
                      {inv.planName || 'FlowSync Pro'}
                    </td>

                    {/* Amount */}
                    <td className="py-3.5 px-5 font-bold text-slate-950 dark:text-white">
                      ${(inv.amount || 20).toFixed(2)} USD
                    </td>

                    {/* Payment Channel */}
                    <td className="py-3.5 px-5 text-slate-500">
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

      {/* ─── Upgrade & Support Banner ─── */}
      <div className="rounded-2xl p-6 bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-extrabold tracking-tight flex items-center gap-2">
            <span>Need Custom Enterprise Billing or VAT Invoices?</span>
            <Sparkles size={16} className="text-blue-200" />
          </h3>
          <p className="text-xs sm:text-sm text-blue-100 mt-1 max-w-xl">
            FlowSync offers custom annual contracts, ACH bank transfers, and unified procurement invoicing for scaling teams.
          </p>
        </div>
        <a
          href="mailto:billing@flowsync.app"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-white text-blue-600 hover:bg-blue-50 transition-colors shrink-0 shadow-sm cursor-pointer"
        >
          <span>Contact Billing Team</span>
          <ArrowUpRight size={14} />
        </a>
      </div>

      {/* ─── Interactive Invoice Modal ─── */}
      <InvoiceModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        invoice={selectedInvoice}
      />

    </div>
  );
}

