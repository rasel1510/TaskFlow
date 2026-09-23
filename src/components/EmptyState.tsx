import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center py-12 px-4 rounded-xl ${className}`}
    >
      <div className="w-12 h-12 rounded-2xl bg-[#F3F4F6] flex items-center justify-center text-[#9CA3AF] mb-3.5">
        {icon || (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
        )}
      </div>
      <h3 className="text-[14px] font-semibold text-[#111111]">{title}</h3>
      {description && (
        <p className="text-[12.5px] text-[rgba(17,17,17,0.5)] mt-1 max-w-sm">
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-[#2563EB] text-white rounded-lg text-[13px] font-medium hover:bg-[#1D4ED8] transition-colors shadow-sm"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
