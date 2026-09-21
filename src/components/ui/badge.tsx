import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-[#DBEAFE] text-[#2563EB]',
        secondary: 'bg-[#F3F4F6] text-[#111111]',
        destructive: 'bg-[#FEE2E2] text-[#DC2626]',
        success: 'bg-[#DCFCE7] text-[#16A34A]',
        warning: 'bg-[#FEF3C7] text-[#D97706]',
        outline: 'border border-[#E5E7EB] text-[#111111]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
