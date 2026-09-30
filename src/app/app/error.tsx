'use client';

import { useEffect } from 'react';
import Link from 'next/link';

interface AppErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AppRouteError({ error, reset }: AppErrorProps) {
  useEffect(() => {
    console.error('[TaskFlow Workspace Error]:', error);

    // Auto-recover from chunk or module loading errors caused by cache updates
    const isChunkOrModuleError =
      error?.name === 'ChunkLoadError' ||
      error?.message?.includes('Loading chunk') ||
      error?.message?.includes('Cannot find module') ||
      error?.message?.includes('MODULE_NOT_FOUND');

    if (isChunkOrModuleError && typeof window !== 'undefined') {
      const lastReload = sessionStorage.getItem('tf_chunk_reload');
      const now = Date.now();
      if (!lastReload || now - Number(lastReload) > 10000) {
        sessionStorage.setItem('tf_chunk_reload', String(now));
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <div className="flex-1 min-h-[100dvh] bg-[#F9FAFB] flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-white border border-[#E5E7EB] rounded-2xl p-6 md:p-8 shadow-sm">
        <div className="w-12 h-12 mx-auto rounded-xl bg-red-50 border border-red-100 flex items-center justify-center mb-4 text-[#DC2626]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 className="text-[18px] font-bold text-[#111111] mb-1.5 tracking-tight">Workspace Error</h2>
        <p className="text-[13px] text-[rgba(17,17,17,0.6)] mb-6 leading-relaxed">
          {error?.message || 'An error occurred while loading the workspace. Please try again.'}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white font-medium rounded-lg text-[13px] transition-colors shadow-xs cursor-pointer"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="px-4 py-2 bg-[#F3F4F6] hover:bg-[#E5E7EB] active:bg-[#D1D5DB] text-[#374151] font-medium rounded-lg text-[13px] transition-colors cursor-pointer"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
