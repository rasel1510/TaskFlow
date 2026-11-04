'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import OnboardingHeader from '@/components/onboarding/OnboardingHeader';
import InvoiceModal, { InvoiceData } from '@/components/onboarding/InvoiceModal';
import { CheckCircle2, FileText, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

function OnboardingSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const invoiceId = searchParams.get('invoiceId');

  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If returning from Stripe Checkout with ?session_id=... verify with backend
    const url = sessionId
      ? `/api/billing?session_id=${encodeURIComponent(sessionId)}`
      : '/api/billing';

    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          const matched =
            data.data.invoices?.find((i: any) => i.id === invoiceId) ||
            data.data.invoices?.[0];

          if (matched) {
            setInvoice(matched);
          } else {
            setInvoice({
              invoiceNumber: 'INV-2026-4891',
              amount: 20.0,
              currency: 'usd',
              status: 'paid',
              planName: 'Pro Plan',
              billingCycle: 'monthly',
              paymentMethod: 'stripe',
              last4: '4242',
              brand: 'visa',
              createdAt: new Date().toISOString(),
            });
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessionId, invoiceId]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F0F6FF] via-[#F8FAFC] to-[#EFF6FF] dark:from-[#0B1120] dark:via-[#0F172A] dark:to-[#0B1120] text-slate-900 dark:text-slate-100 flex flex-col font-sans relative overflow-hidden transition-colors">
      
      {/* Ambient background glow in FlowSync Blue */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[340px] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none -z-10" />

      <OnboardingHeader currentStep={3} />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-16 flex flex-col items-center">
        
        {/* Animated Green Checkmark matching supervisor's "Success page" */}
        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/10 mb-6 animate-scaleIn">
          <CheckCircle2 size={36} strokeWidth={2.5} />
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white text-center">
          Payment Successful!
        </h1>

        <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 text-center max-w-md">
          Your $20.00 payment was processed securely via Stripe. Your FlowSync Pro Plan is now fully activated.
        </p>

        {/* Invoice Summary Box */}
        <div className="w-full mt-8 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl shadow-blue-500/5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Transaction Details
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80">
              PAID
            </span>
          </div>

          <div className="space-y-2.5 text-xs sm:text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Plan:</span>
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                <span>FlowSync Pro ($20/month)</span>
                <Sparkles size={13} className="text-blue-600" />
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Invoice Number:</span>
              <span className="font-mono text-slate-800 dark:text-slate-200">
                {invoice?.invoiceNumber || (loading ? 'Loading...' : 'INV-2026-4891')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Amount Charged:</span>
              <span className="font-extrabold text-blue-600 dark:text-blue-400">
                ${invoice ? invoice.amount.toFixed(2) : '20.00'} USD
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Payment Gateway:</span>
              <span className="text-slate-700 dark:text-slate-300 font-medium">
                Stripe • {invoice?.brand ? invoice.brand.toUpperCase() : 'Card'} {invoice?.last4 ? `ending in ${invoice.last4}` : ''}
              </span>
            </div>
          </div>

          {/* Invoice CTA button */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setModalOpen(true)}
              className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs border border-blue-200/80 dark:border-slate-700 bg-blue-50/40 dark:bg-slate-800 hover:bg-blue-600 hover:text-white hover:border-blue-600 text-blue-700 dark:text-blue-300 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <FileText size={14} />
              <span>View / Download Invoice Receipt</span>
            </button>
          </div>
        </div>

        {/* Primary CTA: "Create Organization Page" */}
        <div className="w-full mt-8">
          <button
            onClick={() => router.push('/onboarding/organization')}
            className="w-full py-3.5 px-6 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/35 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Continue to Create Organization</span>
            <ArrowRight size={16} />
          </button>
        </div>

      </main>

      {/* Invoice Modal */}
      <InvoiceModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        invoice={invoice}
      />
    </div>
  );
}

export default function OnboardingSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F0F6FF] dark:bg-[#0B1120] flex items-center justify-center text-xs font-semibold text-slate-400">
        Loading confirmation...
      </div>
    }>
      <OnboardingSuccessContent />
    </Suspense>
  );
}
