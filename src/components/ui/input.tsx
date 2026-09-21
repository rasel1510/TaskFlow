import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-[13px] text-[#111111] placeholder:text-[#9CA3AF] focus-visible:outline-none focus-visible:border-[#2563EB] focus-visible:ring-2 focus-visible:ring-[#DBEAFE] disabled:cursor-not-allowed disabled:opacity-50 transition-all',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
