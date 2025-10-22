'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Folder,
  Loader2,
  MoreHorizontal,
  RefreshCcw,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';

import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/http';
import {
  ListConnectionResourcesResponse,
  ListConnectionsResponse,
  ListKnowledgeBaseResourcesResponse,
  ListKnowledgeBasesResponse,
  StackKnowledgeBaseDetail,
} from '@/lib/stack/types';
import { formatBytes, formatDate, cn } from '@/lib/utils';
import { ParsedResource, ResourceStatus } from '@/lib/file-picker/types';
import {
  resourcePathToKnowledgeBasePath,
  toParsedResources,
} from '@/lib/file-picker/transform';
import { useSelectionStore } from '@/hooks/use-selection-store';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

interface BreadcrumbItem {
  label: string;
  resourceId?: string;
  resourcePath: string;
}

interface KnowledgeBaseOption {
  id: string;
  name: string;
}

type SortField = 'name' | 'modifiedAt';
type SortDirection = 'asc' | 'desc';

type StatusVariant = 'default' | 'secondary' | 'success' | 'warning' | 'destructive';

const STATUS_VARIANTS: Record<ResourceStatus, { label: string; variant: StatusVariant }> = {
  indexed: { label: 'Indexed', variant: 'success' },
  pending: { label: 'Pending', variant: 'warning' },
  processing: { label: 'Processing', variant: 'warning' },
  error: { label: 'Error', variant: 'destructive' },
  not_indexed: { label: 'Not indexed', variant: 'secondary' },
};

function flattenKnowledgeBases(data?: ListKnowledgeBasesResponse): KnowledgeBaseOption[] {
  if (!data) return [];
  const segments: Array<keyof ListKnowledgeBasesResponse> = ['admin', 'editor', 'viewer'];
  const options: KnowledgeBaseOption[] = [];
  for (const key of segments) {
    const values = data[key];
    if (Array.isArray(values)) {
      options.push(
        ...values.map((item) => ({
          id: item.knowledge_base_id,
          name: item.name,
        }))
      );
    }
  }
  return options;
}

function makeStatusBadge(resource: ParsedResource) {
  const { variant, label } =
    STATUS_VARIANTS[resource.status] ?? STATUS_VARIANTS.not_indexed;
  return <Badge variant={variant}>{label}</Badge>;
}

function ResourceSkeletonTable() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 7 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2"
        >
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-6 w-24" />
        </div>
      ))}
    </div>
  );
}

export function FilePicker() {
  const queryClient = useQueryClient();
  const selectionStore = useSelectionStore();

  const [selectedConnectionId, setSelectedConnectionId] = useState<string | undefined>();
  const [selectedKnowledgeBaseId, setSelectedKnowledgeBaseId] = useState<string | undefined>();
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { label: 'Root', resourcePath: '/' },
  ]);
  const [filterText, setFilterText] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const connectionsQuery = useQuery<ListConnectionsResponse>({
    queryKey: ['connections'],
    queryFn: () => apiGet('/api/stack/connections'),
  });

  const knowledgeBasesQuery = useQuery<ListKnowledgeBasesResponse>({
    queryKey: ['knowledge-bases'],
    queryFn: () => apiGet('/api/stack/knowledge-bases'),
  });

  const knowledgeBaseOptions = useMemo(
    () => flattenKnowledgeBases(knowledgeBasesQuery.data),
    [knowledgeBasesQuery.data]
  );

  const activeConnectionId =
    selectedConnectionId ?? connectionsQuery.data?.[0]?.connection_id;
  const activeKnowledgeBaseId =
    selectedKnowledgeBaseId ?? knowledgeBaseOptions[0]?.id;

  const activeConnection = useMemo(() => {
    if (!connectionsQuery.data) return undefined;
    return (
      connectionsQuery.data.find(
        (connection) => connection.connection_id === activeConnectionId
      ) ?? connectionsQuery.data[0]
    );
  }, [connectionsQuery.data, activeConnectionId]);

  const currentBreadcrumb = breadcrumbs[breadcrumbs.length - 1];
  const currentResourceId = currentBreadcrumb?.resourceId;
  const knowledgeBasePath = resourcePathToKnowledgeBasePath(
    currentBreadcrumb?.resourcePath
  );

  const connectionResourcesQuery = useQuery<ListConnectionResourcesResponse>({
    queryKey: ['connection-resources', activeConnectionId, currentResourceId ?? 'root'],
    queryFn: () =>
      apiGet(
        `/api/stack/connections/${activeConnectionId}/resources${currentResourceId ? `?resourceId=${currentResourceId}` : ''}`
      ),
    enabled: Boolean(activeConnectionId),
  });

  const knowledgeBaseResourcesQuery = useQuery<ListKnowledgeBaseResourcesResponse>({
    queryKey: ['knowledge-base-resources', activeKnowledgeBaseId, knowledgeBasePath],
    queryFn: () =>
      apiGet(
        `/api/stack/knowledge-bases/${activeKnowledgeBaseId}/resources?resourcePath=${encodeURIComponent(knowledgeBasePath)}`
      ),
    enabled: Boolean(activeKnowledgeBaseId),
  });

  const parsedResources = useMemo(
    () =>
      toParsedResources(
        connectionResourcesQuery.data?.data ?? [],
        knowledgeBaseResourcesQuery.data
      ),
    [connectionResourcesQuery.data, knowledgeBaseResourcesQuery.data]
  );

  const filteredResources = useMemo(() => {
    const filter = filterText.trim().toLowerCase();
    if (!filter) return parsedResources;
    return parsedResources.filter((resource) =>
      resource.name.toLowerCase().includes(filter)
    );
  }, [parsedResources, filterText]);

  const sortedResources = useMemo(() => {
    return [...filteredResources].sort((a, b) => {
      if (sortField === 'name') {
        return sortDirection === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }

      const aDate = a.modifiedAt ? new Date(a.modifiedAt).getTime() : 0;
      const bDate = b.modifiedAt ? new Date(b.modifiedAt).getTime() : 0;
      return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
    });
  }, [filteredResources, sortDirection, sortField]);

  const allSelected =
    sortedResources.length > 0 &&
    sortedResources.every((resource) => selectionStore.isSelected(resource.id));

  const selectionCount = selectionStore.items.size;

  const toggleSort = (field: SortField) => {
    setSortField(field);
    setSortDirection((prev) =>
      prev === 'asc' && sortField === field ? 'desc' : 'asc'
    );
  };

  const handleBreadcrumbClick = (index: number) => {
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
  };

  const handleEnterDirectory = (resource: ParsedResource) => {
    if (resource.type !== 'directory') return;

    setBreadcrumbs((prev) => [
      ...prev,
      {
        label: resource.name,
        resourceId: resource.id,
        resourcePath: resource.fullPath,
      },
    ]);
  };

  const clearSelection = () => selectionStore.clear();

  const indexMutation = useMutation({
    mutationFn: async (payload: { resourceIds: string[] }) => {
      return apiPost<{ knowledge_base: StackKnowledgeBaseDetail }>(
        `/api/stack/knowledge-bases/${activeKnowledgeBaseId}/index`,
        payload
      );
    },
    onMutate: async (variables) => {
      const { resourceIds } = variables;

      await queryClient.cancelQueries({
        queryKey: ['knowledge-base-resources', activeKnowledgeBaseId, knowledgeBasePath],
      });

      const previous = queryClient.getQueryData<
        ListKnowledgeBaseResourcesResponse
      >([
        'knowledge-base-resources',
        activeKnowledgeBaseId,
        knowledgeBasePath,
      ]);

      if (previous) {
        queryClient.setQueryData<
          ListKnowledgeBaseResourcesResponse
        >(
          ['knowledge-base-resources', activeKnowledgeBaseId, knowledgeBasePath],
          {
            data: [
              ...previous.data,
              ...parsedResources
                .filter((resource) => resourceIds.includes(resource.id))
                .map((resource) => ({
                  knowledge_base_id: activeKnowledgeBaseId!,
                  created_at: new Date().toISOString(),
                  modified_at: new Date().toISOString(),
                  indexed_at: null,
                  inode_type: resource.type,
                  resource_id: resource.id,
                  inode_path: { path: resource.fullPath },
                  dataloader_metadata: resource.raw.dataloader_metadata,
                  user_metadata: resource.raw.user_metadata,
                  inode_id: resource.raw.inode_id,
                  content_hash: resource.raw.content_hash,
                  content_mime: resource.raw.content_mime,
                  size: resource.raw.size,
                  status: 'pending',
                })),
            ],
          }
        );
      }

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ['knowledge-base-resources', activeKnowledgeBaseId, knowledgeBasePath],
          context.previous
        );
      }
      toast.error('Failed to start indexing. Please try again.');
    },
    onSuccess: () => {
      toast.success('Indexing started');
      selectionStore.clear();
      queryClient.invalidateQueries({
        queryKey: ['knowledge-base-resources', activeKnowledgeBaseId],
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (resource: ParsedResource) => {
      await apiDelete(
        `/api/stack/knowledge-bases/${activeKnowledgeBaseId}/resources?resourcePath=${encodeURIComponent(resource.fullPath)}`
      );
      await apiPatch(
        `/api/stack/knowledge-bases/${activeKnowledgeBaseId}/connection-sources`,
        { resourceId: resource.id, action: 'remove' }
      );
    },
    onMutate: async (resource) => {
      await queryClient.cancelQueries({
        queryKey: ['knowledge-base-resources', activeKnowledgeBaseId, knowledgeBasePath],
      });

      const previous = queryClient.getQueryData<
        ListKnowledgeBaseResourcesResponse
      >([
        'knowledge-base-resources',
        activeKnowledgeBaseId,
        knowledgeBasePath,
      ]);

      if (previous) {
        queryClient.setQueryData<
          ListKnowledgeBaseResourcesResponse
        >(
          ['knowledge-base-resources', activeKnowledgeBaseId, knowledgeBasePath],
          {
            data: previous.data.filter(
              (item) => item.resource_id !== resource.id
            ),
          }
        );
      }

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ['knowledge-base-resources', activeKnowledgeBaseId, knowledgeBasePath],
          context.previous
        );
      }
      toast.error('Failed to de-index resource.');
    },
    onSuccess: () => {
      toast.success('Resource removed from knowledge base');
      queryClient.invalidateQueries({
        queryKey: ['knowledge-base-resources', activeKnowledgeBaseId],
      });
    },
  });

  const handleIndexSelected = () => {
    if (!activeKnowledgeBaseId) {
      toast.error('Select a knowledge base first.');
      return;
    }

    const resourceIds = Array.from(selectionStore.items.values()).map(
      (item) => item.id
    );

    if (resourceIds.length === 0) {
      toast('Select at least one file or folder');
      return;
    }

    indexMutation.mutate({ resourceIds });
  };

  const handleRowAction = (resource: ParsedResource) => {
    if (resource.type === 'directory') {
      handleEnterDirectory(resource);
      return;
    }

    if (resource.status === 'indexed' || resource.status === 'processing') {
      deleteMutation.mutate(resource);
    } else {
      if (!activeKnowledgeBaseId) {
        toast.error('Select a knowledge base first.');
        return;
      }
      indexMutation.mutate({ resourceIds: [resource.id] });
    }
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      sortedResources.forEach((resource) => {
        if (selectionStore.isSelected(resource.id)) {
          selectionStore.toggle(resource);
        }
      });
      return;
    }

    sortedResources.forEach((resource) => {
      if (!selectionStore.isSelected(resource.id)) {
        selectionStore.toggle(resource);
      }
    });
  };

  const isLoading =
    connectionsQuery.isLoading ||
    knowledgeBasesQuery.isLoading ||
    connectionResourcesQuery.isLoading;

  return (
    <div className="flex h-full min-h-[600px] rounded-xl border border-slate-200 bg-white shadow-sm">
      <aside className="hidden w-64 border-r border-slate-200 bg-slate-50 p-4 md:block">
        <div className="text-sm font-semibold text-slate-600">Connections</div>
        <div className="mt-3 space-y-2">
          {connectionsQuery.isLoading && <Skeleton className="h-8 w-full" />}
          {connectionsQuery.data?.map((connection) => {
            const isActive = connection.connection_id === activeConnectionId;
            return (
              <button
                key={connection.connection_id}
                type="button"
                onClick={() => {
                  setSelectedConnectionId(connection.connection_id);
                  setBreadcrumbs([
                    {
                      label: connection.name,
                      resourcePath: '/',
                    },
                  ]);
                  selectionStore.clear();
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive ? 'bg-white font-medium shadow-sm' : 'hover:bg-white'
                )}
              >
                <Folder className="h-4 w-4" />
                <span className="truncate">{connection.name}</span>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="flex flex-1 flex-col overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            {breadcrumbs.map((crumb, index) => {
              const label =
                index === 0
                  ? activeConnection?.name ?? crumb.label
                  : crumb.label;
              return (
              <div key={`${crumb.resourcePath}-${index}`} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleBreadcrumbClick(index)}
                  className="text-sm font-medium text-slate-700 transition hover:text-slate-900"
                >
                  {label}
                </button>
                {index < breadcrumbs.length - 1 && (
                  <span className="text-slate-400">/</span>
                )}
              </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-md border border-slate-200 px-3 py-1 text-sm text-slate-600 md:flex">
              <RefreshCcw className="h-4 w-4" />
              <button
                type="button"
                onClick={() => {
                  queryClient.invalidateQueries({
                    queryKey: ['knowledge-base-resources', activeKnowledgeBaseId, knowledgeBasePath],
                  });
                  queryClient.invalidateQueries({
                    queryKey: ['connection-resources', activeConnectionId, currentResourceId ?? 'root'],
                  });
                }}
              >
                Refresh
              </button>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-500" htmlFor="knowledgeBase">
                Knowledge base
              </label>
              <select
                id="knowledgeBase"
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                value={activeKnowledgeBaseId ?? ''}
                onChange={(event) => {
                  setSelectedKnowledgeBaseId(event.target.value);
                  selectionStore.clear();
                }}
              >
                {knowledgeBaseOptions.map((kb) => (
                  <option key={kb.id} value={kb.id}>
                    {kb.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </header>

        <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <Checkbox checked={allSelected} onChange={toggleSelectAll} />
            <Button
              type="button"
              variant="ghost"
              className="hidden gap-2 text-sm text-slate-600 md:inline-flex"
              onClick={() => toggleSort('name')}
            >
              Sort by name
              <MoreHorizontal className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="hidden gap-2 text-sm text-slate-600 md:inline-flex"
              onClick={() => toggleSort('modifiedAt')}
            >
              Sort by date
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                value={filterText}
                onChange={(event) => setFilterText(event.target.value)}
                placeholder="Search by name"
                className="pl-8"
              />
            </div>
            <Button
              type="button"
              onClick={handleIndexSelected}
              disabled={selectionCount === 0 || indexMutation.isPending}
            >
              {indexMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Indexing...
                </span>
              ) : (
                `Index selected (${selectionCount})`
              )}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {isLoading ? (
            <ResourceSkeletonTable />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Select</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Last modified</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedResources.map((resource) => {
                  const isSelected = selectionStore.isSelected(resource.id);
                  const canDelete =
                    resource.status === 'indexed' || resource.status === 'processing';
                  return (
                    <TableRow
                      key={resource.id}
                      data-state={isSelected ? 'selected' : undefined}
                    >
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onChange={() => selectionStore.toggle(resource)}
                        />
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => handleEnterDirectory(resource)}
                          className={cn(
                            'flex items-center gap-2 rounded-md px-1 py-1 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100',
                            resource.type !== 'directory' && 'cursor-default hover:bg-transparent'
                          )}
                        >
                          <Folder className="h-4 w-4" />
                          <span className="truncate">{resource.name}</span>
                        </button>
                      </TableCell>
                      <TableCell>{formatDate(resource.modifiedAt)}</TableCell>
                      <TableCell>{formatBytes(resource.size)}</TableCell>
                      <TableCell>{makeStatusBadge(resource)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant={canDelete ? 'destructive' : resource.type === 'directory' ? 'ghost' : 'outline'}
                          size="sm"
                          onClick={() => handleRowAction(resource)}
                          disabled={
                            (resource.type === 'directory' && resource.status === 'processing') ||
                            indexMutation.isPending ||
                            deleteMutation.isPending
                          }
                        >
                          {resource.type === 'directory'
                            ? 'Open'
                            : canDelete
                            ? 'De-index'
                            : 'Index'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {sortedResources.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-sm text-slate-500">
                      No files in this folder.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>

        {selectionCount > 0 && (
          <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                {selectionCount} item{selectionCount === 1 ? '' : 's'} selected
              </div>
              <div className="flex items-center gap-3">
                <Button type="button" variant="ghost" onClick={clearSelection}>
                  Clear selection
                </Button>
                <Button
                  type="button"
                  onClick={handleIndexSelected}
                  disabled={indexMutation.isPending}
                >
                  Index selected
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
