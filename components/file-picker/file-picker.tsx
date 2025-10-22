'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AppWindow,
  Calendar,
  Cloud,
  FileText,
  Folder,
  Globe,
  Layers,
  MessageSquare,
  RefreshCcw,
  Search,
  Share2,
  SortAsc,
  Text,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/http';
import {
  ListConnectionResourcesResponse,
  ListConnectionsResponse,
  ListKnowledgeBaseResourcesResponse,
  ListKnowledgeBasesResponse,
  StackKnowledgeBaseDetail,
} from '@/lib/stack/types';
import { cn, formatBytes, formatDate } from '@/lib/utils';
import {
  ParsedResource,
  ResourceStatus,
} from '@/lib/file-picker/types';
import {
  resourcePathToKnowledgeBasePath,
  toParsedResources,
} from '@/lib/file-picker/transform';
import { useSelectionStore } from '@/hooks/use-selection-store';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

import type { CheckedState } from '@radix-ui/react-checkbox';

interface KnowledgeBaseOption {
  id: string;
  name: string;
}

interface BreadcrumbItem {
  label: string;
  resourcePath: string;
  resourceId?: string;
}

type SortField = 'name' | 'modifiedAt';
type SortDirection = 'asc' | 'desc';

const STATUS_META: Record<ResourceStatus, { label: string; className: string }> = {
  indexed: { label: 'Indexed', className: 'bg-emerald-100 text-emerald-700' },
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-800' },
  processing: { label: 'Processing', className: 'bg-amber-100 text-amber-800' },
  error: { label: 'Error', className: 'bg-red-100 text-red-700' },
  not_indexed: { label: 'Not indexed', className: 'bg-slate-100 text-slate-500' },
};

type IntegrationItem =
  | { id: string; label: string; count?: number; type: 'icon'; icon: LucideIcon }
  | { id: string; label: string; count?: number; type: 'image'; src: string };

const INTEGRATIONS: IntegrationItem[] = [
  { id: 'files', label: 'Files', count: 4, type: 'icon', icon: Folder },
  { id: 'websites', label: 'Websites', type: 'icon', icon: Globe },
  { id: 'text', label: 'Text', type: 'icon', icon: Text },
  { id: 'confluence', label: 'Confluence', type: 'icon', icon: Layers },
  { id: 'notion', label: 'Notion', type: 'icon', icon: AppWindow },
  { id: 'google-drive', label: 'Google Drive', type: 'image', src: '/icons/google-drive.svg' },
  { id: 'onedrive', label: 'OneDrive', type: 'icon', icon: Cloud },
  { id: 'sharepoint', label: 'SharePoint', type: 'icon', icon: Share2 },
  { id: 'slack', label: 'Slack', type: 'icon', icon: MessageSquare },
];

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

function StatusBadge({ status }: { status: ResourceStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.not_indexed;
  return (
    <Badge
      variant="secondary"
      className={cn('rounded-full px-2.5 py-1 text-xs font-medium', meta.className)}
    >
      {meta.label}
    </Badge>
  );
}

function ResourceSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center justify-between rounded-lg border border-slate-200/80 bg-white/60 px-4 py-3 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-4 rounded-sm" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

export function FilePicker() {
  const queryClient = useQueryClient();
  const selectionStore = useSelectionStore();

  const [selectedKnowledgeBaseId, setSelectedKnowledgeBaseId] =
    useState<string | undefined>();
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { label: 'Root', resourcePath: '/' },
  ]);
  const [filterText, setFilterText] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'indexed' | 'not_indexed' | 'processing' | 'error'
  >('all');

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

  const activeConnectionId = connectionsQuery.data?.[0]?.connection_id;
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
    const textFilter = filterText.trim().toLowerCase();
    let resources = parsedResources;

    if (textFilter) {
      resources = resources.filter((resource) =>
        resource.name.toLowerCase().includes(textFilter)
      );
    }

    if (statusFilter !== 'all') {
      resources = resources.filter((resource) => {
        if (statusFilter === 'indexed') return resource.status === 'indexed';
        if (statusFilter === 'not_indexed') return resource.status === 'not_indexed';
        if (statusFilter === 'processing')
          return resource.status === 'processing' || resource.status === 'pending';
        if (statusFilter === 'error') return resource.status === 'error';
        return true;
      });
    }

    return resources;
  }, [parsedResources, filterText, statusFilter]);

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

  const selectionCount = selectionStore.items.size;
  const allSelected =
    sortedResources.length > 0 &&
    sortedResources.every((resource) => selectionStore.isSelected(resource.id));

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

  const handleToggleAll = (checked: CheckedState) => {
    if (checked === 'indeterminate') return;
    if (checked) {
      selectionStore.addMany(sortedResources);
    } else {
      selectionStore.clear();
    }
  };

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
                  status: 'processing',
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

  const isLoading =
    connectionsQuery.isLoading ||
    knowledgeBasesQuery.isLoading ||
    connectionResourcesQuery.isLoading;

  return (
    <main className="fixed inset-0 flex items-center justify-center p-6 overflow-hidden">
      <div className="w-full max-w-[1200px] h-[90vh] flex flex-col overflow-hidden rounded-[32px] border border-white/60 bg-white/85 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-1 min-h-0">
          <aside className="hidden w-64 shrink-0 border-r border-slate-200/60 bg-slate-50/80 p-6 md:flex md:flex-col overflow-hidden">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Integrations
            </p>
            <ScrollArea className="mt-4 flex-1 pr-2">
              <div className="space-y-1">
                {INTEGRATIONS.map((item) => {
                  const isActive = item.id === 'google-drive';
                  const Wrapper = item.type === 'icon' ? item.icon : null;

                  return (
                    <Button
                      key={item.id}
                      type="button"
                      variant="ghost"
                      className={cn(
                        'flex w-full items-center justify-between rounded-xl px-3 py-2 h-auto text-left text-sm font-normal transition',
                        isActive
                          ? 'cursor-default bg-white shadow-sm ring-1 ring-slate-200 hover:bg-white'
                          : 'cursor-pointer text-slate-500 hover:bg-white'
                      )}
                    >
                      <span className="flex items-center gap-3">
                        {item.type === 'icon' && Wrapper ? (
                          <Wrapper className="h-4 w-4 text-slate-400" />
                        ) : (
                          <Image
                            src={item.type === 'image' ? item.src : ''}
                            alt={item.label}
                            width={18}
                            height={18}
                            className="rounded-sm"
                          />
                        )}
                        <span className="font-medium">{item.label}</span>
                      </span>
                      {item.count != null && (
                        <span className="text-xs text-slate-400">{item.count}</span>
                      )}
                    </Button>
                  );
                })}
              </div>
            </ScrollArea>
          </aside>

          <section className="flex w-full flex-col min-w-0 overflow-hidden">
            <div className="flex items-center justify-between gap-4 px-8 pt-8">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100">
                  <Image
                    src="/icons/google-drive.svg"
                    alt="Google Drive"
                    width={24}
                    height={24}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-slate-900">
                      Google Drive
                    </h2>
                    <Badge className="bg-slate-100 text-xs font-medium text-slate-500">
                      Beta
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-500">
                    {connectionsQuery.data?.[0]?.name ?? 'Connected account'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    queryClient.invalidateQueries({
                      queryKey: ['knowledge-base-resources', activeKnowledgeBaseId, knowledgeBasePath],
                    });
                    queryClient.invalidateQueries({
                      queryKey: ['connection-resources', activeConnectionId, currentResourceId ?? 'root'],
                    });
                  }}
                >
                  <RefreshCcw className="h-4 w-4" />
                  Refresh
                </Button>
                <Select
                  value={activeKnowledgeBaseId ?? undefined}
                  onValueChange={(value) => {
                    setSelectedKnowledgeBaseId(value);
                    selectionStore.clear();
                  }}
                >
                  <SelectTrigger className="min-w-[190px]">
                    <SelectValue placeholder="Knowledge base" />
                  </SelectTrigger>
                  <SelectContent>
                    {knowledgeBaseOptions.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator className="mt-6" />

            <div className="flex flex-col gap-6 px-8 py-6 flex-1 min-h-0 overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
                {breadcrumbs.map((crumb, index) => {
                  const label =
                    index === 0
                      ? activeConnection?.name ?? 'Google Drive'
                      : crumb.label;
                  return (
                    <div key={`${crumb.resourcePath}-${index}`} className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleBreadcrumbClick(index)}
                        className={cn(
                          'h-auto rounded-md px-1.5 py-1 text-sm font-normal transition',
                          index === breadcrumbs.length - 1
                            ? 'bg-slate-100 text-slate-600 hover:bg-slate-100'
                            : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                        )}
                      >
                        {label}
                      </Button>
                      {index < breadcrumbs.length - 1 && <span>/</span>}
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={handleToggleAll}
                    aria-label="Select all"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2 text-slate-500 hover:text-slate-700"
                      onClick={() => toggleSort('name')}
                    >
                      <SortAsc className="h-4 w-4" />
                      Sort by name
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2 text-slate-500 hover:text-slate-700"
                      onClick={() => toggleSort('modifiedAt')}
                    >
                      <Calendar className="h-4 w-4" />
                      Sort by date
                    </Button>
                    <Select
                      value={statusFilter}
                      onValueChange={(value) =>
                        setStatusFilter(value as typeof statusFilter)
                      }
                    >
                      <SelectTrigger className="h-8 w-[150px] justify-start rounded-full border-slate-200 bg-white px-3 text-sm font-medium text-slate-500 focus:ring-0">
                        <SelectValue placeholder="Filter status" />
                      </SelectTrigger>
                      <SelectContent sideOffset={4}>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="indexed">Indexed</SelectItem>
                        <SelectItem value="processing">Processing</SelectItem>
                        <SelectItem value="not_indexed">Not indexed</SelectItem>
                        <SelectItem value="error">Errors</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      value={filterText}
                      onChange={(event) => setFilterText(event.target.value)}
                      placeholder="Search by name"
                      className="pl-9"
                    />
                  </div>
                  <Button
                    onClick={handleIndexSelected}
                    disabled={selectionCount === 0 || indexMutation.isPending}
                    className="gap-2"
                  >
                    Index selected ({selectionCount})
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/70 bg-white/70 shadow-sm flex-1 min-h-0 flex flex-col overflow-hidden">
                <ScrollArea className="flex-1">
                  {isLoading ? (
                    <div className="p-6">
                      <ResourceSkeleton />
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12 text-slate-400">Select</TableHead>
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
                              className="text-sm"
                            >
                              <TableCell>
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => selectionStore.toggle(resource)}
                                  aria-label={`Select ${resource.name}`}
                                />
                              </TableCell>
                              <TableCell>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={() => handleEnterDirectory(resource)}
                                  disabled={resource.type !== 'directory'}
                                  className={cn(
                                    'flex w-full items-center justify-start gap-3 rounded-lg px-2 py-1 h-auto text-left transition font-normal',
                                    resource.type === 'directory'
                                      ? 'text-slate-700 hover:bg-slate-100'
                                      : 'cursor-default text-slate-600 hover:bg-transparent'
                                  )}
                                >
                                  {resource.type === 'directory' ? (
                                    <Folder className="h-4 w-4 text-slate-300" />
                                  ) : (
                                    <FileText className="h-4 w-4 text-slate-300" />
                                  )}
                                  <span className="truncate">{resource.name}</span>
                                </Button>
                              </TableCell>
                              <TableCell className="text-slate-500">
                                {formatDate(resource.modifiedAt)}
                              </TableCell>
                              <TableCell className="text-slate-500">
                                {formatBytes(resource.size)}
                              </TableCell>
                              <TableCell>
                                <StatusBadge status={resource.status} />
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={canDelete ? 'outline' : 'secondary'}
                                  className={cn(
                                    'min-w-[88px] justify-center',
                                    canDelete
                                      ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                                      : 'bg-slate-900 text-white hover:bg-slate-800'
                                  )}
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
                  )}
                </ScrollArea>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200/70 bg-slate-50/70 px-8 py-4 text-sm text-slate-500">
              <div>
                {selectionCount} item{selectionCount === 1 ? '' : 's'} selected
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  onClick={() => selectionStore.clear()}
                  className="text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleIndexSelected}
                  disabled={selectionCount === 0 || indexMutation.isPending}
                >
                  Index selected
                </Button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
