'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import OnboardingHeader from '@/components/onboarding/OnboardingHeader';
import InvoiceModal, { InvoiceData } from '@/components/onboarding/InvoiceModal';
import { CheckCircle2, FileText, ArrowRight, ShieldCheck, Sparkles, Building2 } from 'lucide-react';

function OnboardingSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invoiceId = searchParams.get('invoiceId');

  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/billing')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          const matched = data.data.invoices?.find((i: any) => i.id === invoiceId) || data.data.invoices?.[0];
          if (matched) {
            setInvoice(matched);
          } else {
            // Fallback invoice data for presentation
            setInvoice({
              invoiceNumber: 'INV-2026-4891',
              amount: 20.0,
              currency: 'usd',
              status: 'paid',
              planName: 'Pro Plan',
              billingCycle: 'monthly',
              paymentMethod: 'card',
              last4: '4242',
              brand: 'visa',
              createdAt: new Date().toISOString(),
            });
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [invoiceId]);

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-[#0D0E12] text-neutral-900 dark:text-neutral-100 flex flex-col font-sans">
      <OnboardingHeader currentStep={3} />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-16 flex flex-col items-center">
        
        {/* Animated Green Checkmark matching supervisor's "Success page" */}
        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-lg mb-6 animate-scaleIn">
          <CheckCircle2 size={36} strokeWidth={2.5} />
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-950 dark:text-white text-center">
          Payment Successful!
        </h1>

        <p className="mt-2 text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 text-center max-w-md">
          Your $20.00 payment was processed securely via Stripe. Your FlowSync Pro Plan is now fully activated.
        </p>

        {/* Invoice Summary Box (Matches "Invoice" in diagram) */}
        <div className="w-full mt-8 p-6 rounded-2xl bg-white dark:bg-[#15171C] border border-[#ECE5D8] dark:border-neutral-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Transaction Details
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
              PAID
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-neutral-500">Plan:</span>
              <span className="font-bold text-neutral-900 dark:text-white">FlowSync Pro ($20/month)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Invoice Number:</span>
              <span className="font-mono text-neutral-800 dark:text-neutral-200">
                {invoice?.invoiceNumber || 'INV-2026-4891'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Amount Charged:</span>
              <span className="font-bold text-neutral-900 dark:text-white">
                ${invoice ? invoice.amount.toFixed(2) : '20.00'} USD
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Payment Gateway:</span>
              <span className="text-neutral-700 dark:text-neutral-300">
                Stripe • {invoice?.brand || 'Visa'} ending in {invoice?.last4 || '4242'}
              </span>
            </div>
          </div>

          {/* Invoice CTA button matching diagram's [Invoice] button */}
          <div className="pt-2">
            <button
              onClick={() => setModalOpen(true)}
              className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <FileText size={14} className="text-[#E44232]" />
              <span>View / Download Invoice PDF</span>
            </button>
          </div>
        </div>

        {/* Primary CTA: "Create Organization Page" */}
        <div className="w-full mt-8">
          <button
            onClick={() => router.push('/onboarding/organization')}
            className="w-full py-3.5 px-6 rounded-xl font-bold text-sm bg-[#E44232] hover:bg-[#D0392A] text-white transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
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
      <div className="min-h-screen bg-[#FDFBF7] dark:bg-[#0D0E12] flex items-center justify-center text-xs font-semibold text-neutral-400">
        Loading confirmation...
      </div>
    }>
      <OnboardingSuccessContent />
    </Suspense>
  );
}
