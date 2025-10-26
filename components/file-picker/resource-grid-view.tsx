'use client';

import * as React from 'react';
import Image from 'next/image';
import { FileText, Folder, Loader2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { StatusBadge } from '@/components/file-picker/status-badge';
import { ParsedResource } from '@/lib/file-picker/types';
import { cn, formatBytes } from '@/lib/utils';

interface ResourceGridViewProps {
  sortedResources: ParsedResource[];
  isLoading: boolean;
  selectedIntegration: string;
  loadingResourceId: string | null;
  isStatusLoading: boolean;
  isSelected: (resource: ParsedResource) => boolean;
  onToggle: (resource: ParsedResource) => void;
  onEnterDirectory: (resource: ParsedResource) => void;
  onRowAction: (resource: ParsedResource) => void;
  onPrefetch?: (resource: ParsedResource) => void;
  isImageFile: (fileName: string) => boolean;
  isVideoFile: (fileName: string) => boolean;
  renderSkeleton: () => React.ReactElement;
  onOpenPreview?: (resource: ParsedResource) => void;
}

/**
 * CRITICAL: this component renders grid content with its own scroll container
 * unlike the list view, grid view includes its own scroll container
 */
export function ResourceGridView({
  sortedResources,
  isLoading,
  selectedIntegration,
  loadingResourceId,
  isStatusLoading,
  isSelected,
  onToggle,
  onEnterDirectory,
  onRowAction,
  onPrefetch,
  isImageFile,
  isVideoFile,
  renderSkeleton,
  onOpenPreview,
}: ResourceGridViewProps) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
      {isLoading ? (
        <div className="p-5">{renderSkeleton()}</div>
      ) : (
        <div className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {sortedResources.map((resource) => {
              const selected = isSelected(resource);
              const isDirectory = resource.type === 'directory';
              const displayName = isDirectory ? `${resource.name}/` : resource.name;
              const canDelete =
                !isStatusLoading &&
                (resource.status === 'indexed' || resource.status === 'processing');
              const isLoadingAction = loadingResourceId === resource.id;
              const baseActionLabel = isStatusLoading
                ? 'Loading...'
                : isDirectory
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
              const shouldShowCardNameTooltip = displayName.length > 32;

              return (
                <div
                  key={resource.id}
                  className={cn(
                    'group relative flex flex-col items-center p-3 rounded-lg border-2 transition-all cursor-pointer hover:bg-slate-50',
                    selected
                      ? 'border-slate-400 bg-slate-50'
                      : 'border-slate-200/70 hover:border-slate-300'
                  )}
                  onClick={() => {
                    if (resource.type === 'directory') {
                      onEnterDirectory(resource);
                    } else {
                      onToggle(resource);
                    }
                  }}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    if (resource.type === 'directory') {
                      onEnterDirectory(resource);
                      return;
                    }
                    if (resource.preview) {
                      onOpenPreview?.(resource);
                    }
                  }}
                >
                  <div
                    className="absolute top-2 left-2 z-10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={selected}
                      onCheckedChange={() => onToggle(resource)}
                      aria-label={`Select ${displayName}`}
                    />
                  </div>

                  <div className="w-full aspect-square flex items-center justify-center mb-2 rounded-lg bg-slate-100 overflow-hidden relative">
                    {resource.type === 'directory' ? (
                      <Folder className="h-12 w-12 text-slate-400" />
                    ) : isImageFile(resource.name) && selectedIntegration === 'files' ? (
                      <Image
                        src={resource.fullPath}
                        alt={resource.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                      />
                    ) : isVideoFile(resource.name) && selectedIntegration === 'files' ? (
                      <div className="relative w-full h-full bg-slate-900 flex items-center justify-center">
                        <Play className="h-12 w-12 text-white/80" />
                        <span className="absolute bottom-2 right-2 text-[10px] text-white/80 font-mono bg-black/50 px-1.5 py-0.5 rounded">
                          VIDEO
                        </span>
                      </div>
                    ) : (
                      <FileText className="h-12 w-12 text-slate-400" />
                    )}
                  </div>

                  <div className="w-full text-center">
                    {shouldShowCardNameTooltip ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p
                              className="text-xs font-medium text-slate-700 truncate mb-1 group-hover:underline cursor-pointer"
                              onMouseEnter={() => onPrefetch?.(resource)}
                              onFocus={() => onPrefetch?.(resource)}
                            >
                              {displayName}
                            </p>
                          </TooltipTrigger>
                          <TooltipContent sideOffset={5}>
                            <p className="max-w-xs break-all text-xs font-medium text-slate-900">
                              {displayName}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <p
                        className="text-xs font-medium text-slate-700 truncate mb-1 group-hover:underline cursor-pointer"
                        onMouseEnter={() => onPrefetch?.(resource)}
                        onFocus={() => onPrefetch?.(resource)}
                      >
                        {displayName}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-500">
                      {formatBytes(resource.size)}
                    </p>
                    {resource.type !== 'directory' && (
                      <div className="mt-2 flex justify-center">
                        {isStatusLoading ? (
                          <Skeleton className="h-6 w-20 rounded-full" />
                        ) : (
                          <StatusBadge status={resource.status} />
                        )}
                      </div>
                    )}
                  </div>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="w-full">
                          <Button
                            type="button"
                            size="sm"
                            variant={
                              isStatusLoading ? 'outline' : canDelete ? 'outline' : 'secondary'
                            }
                            className={cn(
                              'w-full mt-2 text-xs h-7',
                              isStatusLoading
                                ? 'border-slate-200 bg-slate-100 text-slate-400'
                                : canDelete
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300'
                                : 'bg-slate-900 text-white hover:bg-slate-800'
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              onRowAction(resource);
                            }}
                            disabled={
                              selectedIntegration === 'files' ||
                              isStatusLoading ||
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
                      {selectedIntegration === 'files' ? (
                        <TooltipContent sideOffset={5}>
                          <p>These are sample/local files bruh :D</p>
                        </TooltipContent>
                      ) : (
                        isStatusLoading && (
                          <TooltipContent sideOffset={5}>
                            <p>Loading file statuses...</p>
                          </TooltipContent>
                        )
                      )}
                    </Tooltip>
                  </TooltipProvider>
                </div>
              );
            })}
            {sortedResources.length === 0 && !isLoading && (
              <div className="col-span-full py-16 text-center text-sm text-slate-500">
                No files in this folder.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
