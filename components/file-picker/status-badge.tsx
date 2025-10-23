import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ResourceStatus } from '@/lib/file-picker/types';

const STATUS_META: Record<
  ResourceStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }
> = {
  indexed: { 
    label: 'Indexed', 
    variant: 'secondary',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
  },
  pending: { 
    label: 'Pending', 
    variant: 'secondary',
    className: 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100'
  },
  processing: { 
    label: 'Processing', 
    variant: 'secondary',
    className: 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100'
  },
  error: { 
    label: 'Error', 
    variant: 'destructive'
  },
  not_indexed: { 
    label: 'Not indexed', 
    variant: 'secondary',
    className: 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-100'
  },
};

export function StatusBadge({ status }: { status: ResourceStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.not_indexed;
  return (
    <Badge
      variant={meta.variant}
      className={cn(meta.className)}
    >
      {meta.label}
    </Badge>
  );
}

