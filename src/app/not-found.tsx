import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-6 text-blue-600 shadow-sm">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h1 className="text-3xl font-bold text-[#111111] mb-2 tracking-tight">404 - Page Not Found</h1>
      <p className="text-[15px] text-[rgba(17,17,17,0.6)] max-w-md mb-8">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/app"
        className="px-5 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white font-medium rounded-xl text-[14px] transition-colors shadow-sm inline-flex items-center gap-2"
      >
        Return to Workspace
      </Link>
    </div>
  );
}
