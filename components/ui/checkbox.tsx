'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

type CheckboxProps = React.ComponentPropsWithoutRef<'input'>;

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => {
    return (
      <label className={cn('relative inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded border border-slate-300 bg-white shadow-sm transition-colors focus-within:ring-2 focus-within:ring-slate-400 focus-within:ring-offset-2', className)}>
        <input
          type="checkbox"
          ref={ref}
          className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
          {...props}
        />
        <span className="flex h-4 w-4 items-center justify-center rounded bg-white peer-checked:bg-slate-900 peer-disabled:bg-slate-100">
          <Check className="h-3 w-3 text-white opacity-0 transition-opacity peer-checked:opacity-100" />
        </span>
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';
