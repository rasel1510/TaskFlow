import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DBEAFE] disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
  {
    variants: {
      variant: {
        default: 'bg-[#2563EB] text-white hover:bg-[#1D4ED8] font-semibold',
        destructive: 'bg-[#DC2626] text-white hover:bg-red-700',
        outline: 'border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] text-[#111111]',
        secondary: 'bg-[#F3F4F6] text-[#111111] hover:bg-[#E5E7EB]',
        ghost: 'hover:bg-[#F3F4F6] text-[rgba(17,17,17,0.45)] hover:text-[#111111]',
        link: 'text-[#2563EB] underline-offset-4 hover:underline',
      },
      size: {
        default: 'px-3.5 py-1.5',
        sm: 'px-2.5 py-1 text-xs',
        lg: 'px-5 py-2 text-sm',
        icon: 'h-8 w-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
