'use client';

import { Fragment } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ParsedResource } from '@/lib/file-picker/types';
import { cn, formatBytes, formatDate } from '@/lib/utils';
import type { CheckedState } from '@radix-ui/react-checkbox';
import { StatusBadge } from '@/components/file-picker/status-badge';

interface ResourceListViewProps {
  sortedResources: ParsedResource[];
  isLoading: boolean;
  allSelected: boolean;
  selectedIntegration: string;
  isSidebarCollapsed: boolean;
  loadingResourceId: string | null;
  isSelected: (id: string) => boolean;
  onToggle: (resource: ParsedResource) => void;
  onToggleAll: (checked: CheckedState) => void;
  onEnterDirectory: (resource: ParsedResource) => void;
  onRowAction: (resource: ParsedResource) => void;
  onPrefetch?: (resource: ParsedResource) => void;
  onOpenPreview?: (resource: ParsedResource) => void;
}

/**
 * CRITICAL: this component renders table content ONLY
 * the scroll container must be in the parent to preserve scroll functionality
 * do not wrap this in a scroll container - it will break sticky headers
 */
export function ResourceListView({
  sortedResources,
  isLoading,
  allSelected,
  selectedIntegration,
  isSidebarCollapsed,
  loadingResourceId,
  isSelected,
  onToggle,
  onToggleAll,
  onEnterDirectory,
  onRowAction,
  onPrefetch,
  onOpenPreview,
}: ResourceListViewProps) {
  return (
    <Table containerClassName="overflow-visible">
      {/* Sticky header - relies on parent scroll container */}
      <TableHeader className="sticky top-0 z-30 bg-white shadow-[0_1px_0_0_rgb(226,232,240)] pt-3 pb-2 [&>tr]:bg-transparent [&>tr]:border-b [&>tr]:border-slate-200 [&>tr>th]:sticky [&>tr>th]:top-0 [&>tr>th]:bg-white [&>tr>th]:z-20">
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-12">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center justify-center">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={onToggleAll}
                      aria-label="Select all"
                      disabled={isLoading}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent sideOffset={5}>
                  <p>Select all</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </TableHead>
          <TableHead>
            <span className="text-xs font-medium text-slate-500">Name</span>
          </TableHead>
          <TableHead>
            <span className="text-xs font-medium text-slate-500">Last modified</span>
          </TableHead>
          <TableHead>
            <span className="text-xs font-medium text-slate-500">Size</span>
          </TableHead>
          <TableHead>
            <span className="text-xs font-medium text-slate-500">Status</span>
          </TableHead>
          <TableHead className="text-center">
            <span className="text-xs font-medium text-slate-500">Action</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading
          ? Array.from({ length: 6 }).map((_, index) => (
              <TableRow key={`resource-skeleton-${index}`} className="animate-pulse">
                <TableCell className="w-12">
                  <div className="flex items-center justify-center">
                    <Skeleton className="h-4 w-4 rounded-sm" />
                  </div>
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-48" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-32" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex justify-center">
                    <Skeleton className="h-8 w-24 rounded-md" />
                  </div>
                </TableCell>
              </TableRow>
            ))
          : sortedResources.length > 0
          ? sortedResources.map((resource) => {
              const selected = isSelected(resource.id);
              const canDelete =
                resource.status === 'indexed' || resource.status === 'processing';
              const isDirectory = resource.type === 'directory';
              const displayName = isDirectory ? `${resource.name}/` : resource.name;
              const isLoadingAction = loadingResourceId === resource.id;
              const baseActionLabel = isDirectory
                ? canDelete
                  ? 'De-index'
                  : 'Index all'
                : canDelete
                ? 'De-index'
                : 'Index';
              const actionLabel = isLoadingAction
                ? canDelete
                  ? 'De-indexing...'
                  : 'Indexing...'
                : baseActionLabel;
              const shouldShowNameTooltip = displayName.length > 40;

              const nameMaxWidth = isSidebarCollapsed ? 420 : 300;
              const nameWidthClasses = 'transition-[max-width] duration-300 ease-in-out';

              const baseNameElement = isDirectory ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEnterDirectory(resource);
                  }}
                  onMouseEnter={() => onPrefetch?.(resource)}
                  onFocus={() => onPrefetch?.(resource)}
                  className={cn(
                    'text-sm font-medium text-slate-900 truncate block text-left group-hover:underline',
                    nameWidthClasses
                  )}
                  style={{ maxWidth: `${nameMaxWidth}px` }}
                >
                  {displayName}
                </button>
              ) : (
                <span
                  className={cn(
                    'text-sm font-medium text-slate-900 truncate block group-hover:underline',
                    nameWidthClasses
                  )}
                  style={{ maxWidth: `${nameMaxWidth}px` }}
                >
                  {displayName}
                </span>
              );

              const nameElement = shouldShowNameTooltip ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>{baseNameElement}</TooltipTrigger>
                    <TooltipContent sideOffset={6}>
                      <span className="max-w-xs break-words text-xs font-medium text-white">
                        {displayName}
                      </span>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                baseNameElement
              );

              return (
                <TableRow
                  key={resource.id}
                  data-state={selected ? 'selected' : undefined}
                  className={cn(
                    'group cursor-pointer',
                    selected ? 'bg-slate-50' : 'hover:bg-slate-100'
                  )}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('button')) {
                      return;
                    }
                    onToggle(resource);
                  }}
                  onDoubleClick={() => {
                    if (resource.type === 'directory') {
                      onEnterDirectory(resource);
                      return;
                    }
                    if (resource.preview) {
                      onOpenPreview?.(resource);
                    }
                  }}
                >
                  <TableCell className="w-12" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={selected}
                        onCheckedChange={() => onToggle(resource)}
                        aria-label={`Select ${displayName}`}
                      />
                    </div>
                  </TableCell>
                  <TableCell>{nameElement}</TableCell>
                  <TableCell className="text-sm text-slate-900">
                    {formatDate(resource.modifiedAt)}
                  </TableCell>
                  <TableCell className="text-sm text-slate-900">
                    {formatBytes(resource.size)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={resource.status} />
                  </TableCell>
                  <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="inline-block">
                            <Button
                              type="button"
                              size="sm"
                              variant={canDelete ? 'outline' : 'default'}
                              className={cn(
                                'min-w-[90px] h-8 text-xs font-medium',
                                canDelete
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300'
                                  : 'bg-slate-900 text-white hover:bg-slate-800'
                              )}
                              onClick={() => onRowAction(resource)}
                              disabled={
                                selectedIntegration === 'files' ||
                                (isDirectory && resource.status === 'processing') ||
                                loadingResourceId === resource.id
                              }
                            >
                              {isLoadingAction ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                actionLabel
                              )}
                            </Button>
                          </div>
                        </TooltipTrigger>
                        {selectedIntegration === 'files' && (
                          <TooltipContent sideOffset={5}>
                            <p>These are sample/local files bruh :D</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                </TableRow>
              );
            })
          : (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-16 text-center text-sm text-slate-500"
                >
                  No files in this folder.
                </TableCell>
              </TableRow>
            )}
      </TableBody>
    </Table>
  );
}
