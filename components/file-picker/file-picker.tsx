'use client';

import Image from 'next/image';
import { useMemo, useState, Fragment, useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Calendar,
  FileText,
  Folder,
  Globe,
  Grid3x3,
  Image as ImageIcon,
  Layers,
  List,
  Loader2,
  Play,
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
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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

type IntegrationItem =
  | { id: string; label: string; count?: number; type: 'icon'; icon: LucideIcon }
  | { id: string; label: string; count?: number; type: 'image'; src: string };

const INTEGRATIONS: IntegrationItem[] = [
  { id: 'files', label: 'Files', count: 4, type: 'icon', icon: Folder },
  { id: 'websites', label: 'Websites', type: 'icon', icon: Globe },
  { id: 'text', label: 'Text', type: 'icon', icon: Text },
  { id: 'confluence', label: 'Confluence', type: 'icon', icon: Layers },
  { id: 'notion', label: 'Notion', type: 'image', src: '/icons/Notion.svg' },
  { id: 'google-drive', label: 'Google Drive', type: 'image', src: '/icons/google-drive.svg' },
  { id: 'onedrive', label: 'OneDrive', type: 'image', src: '/icons/Microsoft OneDrive.svg' },
  { id: 'sharepoint', label: 'SharePoint', type: 'image', src: '/icons/Microsoft SharePoint.svg' },
  { id: 'slack', label: 'Slack', type: 'image', src: '/icons/Slack.svg' },
];

const SAMPLE_LOCAL_FILES: ParsedResource[] = [
  {
    id: 'local-1',
    name: 'Team Photo.jpg',
    type: 'file',
    fullPath: '/Team Photo.jpg',
    size: 2458640,
    modifiedAt: '2024-01-15T10:30:00Z',
    status: 'not_indexed',
    raw: {} as any,
  },
  {
    id: 'local-2',
    name: 'Marketing Strategy.pdf',
    type: 'file',
    fullPath: '/Marketing Strategy.pdf',
    size: 2097152,
    modifiedAt: '2024-01-14T15:45:00Z',
    status: 'indexed',
    raw: {} as any,
  },
  {
    id: 'local-3',
    name: 'Team Meeting Notes.docx',
    type: 'file',
    fullPath: '/Team Meeting Notes.docx',
    size: 524288,
    modifiedAt: '2024-01-13T09:20:00Z',
    status: 'not_indexed',
    raw: {} as any,
  },
  {
    id: 'local-4',
    name: 'Demo Video.mp4',
    type: 'file',
    fullPath: '/Demo Video.mp4',
    size: 15728640,
    modifiedAt: '2024-01-12T14:00:00Z',
    status: 'indexed',
    raw: {} as any,
  },
];

function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

function isImageFile(fileName: string): boolean {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
  return imageExtensions.includes(getFileExtension(fileName));
}

function isVideoFile(fileName: string): boolean {
  const videoExtensions = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'];
  return videoExtensions.includes(getFileExtension(fileName));
}

function flattenKnowledgeBases(data?: ListKnowledgeBasesResponse): KnowledgeBaseOption[] {
  if (!data) return [];
  const segments: Array<keyof ListKnowledgeBasesResponse> = ['admin', 'editor', 'viewer'];
  const knowledgeBaseMap = new Map<string, KnowledgeBaseOption>();
  
  for (const key of segments) {
    const values = data[key];
    if (Array.isArray(values)) {
      for (const item of values) {
        // Deduplicate by ID - a knowledge base may appear in multiple segments
        if (!knowledgeBaseMap.has(item.knowledge_base_id)) {
          knowledgeBaseMap.set(item.knowledge_base_id, {
            id: item.knowledge_base_id,
            name: item.name,
          });
        }
      }
    }
  }
  
  return Array.from(knowledgeBaseMap.values());
}

function StatusBadge({ status }: { status: ResourceStatus }) {
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

  const [isMounted, setIsMounted] = useState(false);
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<string>('google-drive');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [loadingResourceId, setLoadingResourceId] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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

  const parsedResources = useMemo(() => {
    if (selectedIntegration === 'files') {
      return SAMPLE_LOCAL_FILES;
    }
    return toParsedResources(
      connectionResourcesQuery.data?.data ?? [],
      knowledgeBaseResourcesQuery.data
    );
  }, [selectedIntegration, connectionResourcesQuery.data, knowledgeBaseResourcesQuery.data]);

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
      // Set loading state for single resource operations
      if (resourceIds.length === 1) {
        setLoadingResourceId(resourceIds[0]);
      }

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
    onSettled: () => {
      setLoadingResourceId(null);
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
      setLoadingResourceId(resource.id);
      
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
    onSettled: () => {
      setLoadingResourceId(null);
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
    // Prevent API calls for sample local files
    if (selectedIntegration === 'files') {
      toast.error('Indexing local files is not yet supported');
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
      <div className="relative w-full max-w-[1100px] h-[80vh] flex flex-col overflow-hidden rounded-[24px] border border-white/60 bg-white/85 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-5 left-5 flex items-center gap-2 z-10">
          <div className="w-3 h-3 rounded-full bg-[#ff5f57] hover:bg-[#ff5f57]/80 transition-colors cursor-pointer" />
          <div className="w-3 h-3 rounded-full bg-[#febc2e] hover:bg-[#febc2e]/80 transition-colors cursor-pointer" />
          <div className="w-3 h-3 rounded-full bg-[#28c840] hover:bg-[#28c840]/80 transition-colors cursor-pointer" />
        </div>
        <div className="h-12 border-b shrink-0" />
        <div className="flex flex-1 min-h-0">
          <aside 
            className={cn(
              "hidden border-r bg-slate-50/80 md:flex md:flex-col overflow-hidden transition-all duration-300 ease-in-out",
              isSidebarCollapsed ? "w-0 p-0" : "w-56 px-4 py-5"
            )}
          >
            <div
              className={cn(
                "text-xs font-semibold uppercase tracking-wide text-slate-400 px-2 py-1 transition-opacity duration-200",
                isSidebarCollapsed && "opacity-0 pointer-events-none"
              )}
            >
              Integrations
            </div>
            <ScrollArea className={cn(
              "mt-4 flex-1 transition-opacity duration-200",
              isSidebarCollapsed ? "opacity-0" : "opacity-100"
            )}>
              <div className="space-y-1 px-1 py-1">
                {INTEGRATIONS.map((item) => {
                  const isActive = item.id === selectedIntegration;
                  const isEnabled = item.id === 'files' || item.id === 'google-drive';
                  const Wrapper = item.type === 'icon' ? item.icon : null;

                  return (
                    <Button
                      key={item.id}
                      type="button"
                      variant="ghost"
                      disabled={!isEnabled}
                      onClick={() => {
                        if (isEnabled) {
                          setSelectedIntegration(item.id);
                          selectionStore.clear();
                        }
                      }}
                      className={cn(
                        'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 h-auto text-left text-sm font-normal transition',
                        isActive
                          ? 'cursor-default bg-white shadow-sm ring-1 ring-slate-200 hover:bg-white'
                          : isEnabled
                          ? 'cursor-pointer text-slate-500 hover:bg-white'
                          : 'cursor-not-allowed text-slate-300 opacity-50'
                      )}
                    >
                      <span className="flex items-center gap-2.5">
                        {item.type === 'icon' && Wrapper ? (
                          <Wrapper className={cn(
                            "h-3.5 w-3.5",
                            isEnabled ? "text-slate-400" : "text-slate-300"
                          )} />
                        ) : (
                          <Image
                            src={item.type === 'image' ? item.src : ''}
                            alt={item.label}
                            width={16}
                            height={16}
                            className={cn("rounded-sm", !isEnabled && "opacity-50")}
                          />
                        )}
                        <span className="font-medium text-[13px]">{item.label}</span>
                      </span>
                      {item.count != null && (
                        <span className={cn(
                          "text-xs",
                          isEnabled ? "text-slate-400" : "text-slate-300"
                        )}>{item.count}</span>
                      )}
                    </Button>
                  );
                })}
              </div>
            </ScrollArea>
          </aside>

          <section className="flex w-full flex-col min-w-0 overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-6 py-3 border-b">
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer animate-[breathe_4s_ease-in-out_infinite]"
                        aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                        style={{
                          animation: 'breathe 4s ease-in-out infinite'
                        }}
                      >
                        {selectedIntegration === 'files' ? (
                          <Folder className="h-4 w-4 text-slate-600" />
                        ) : (
                          <Image
                            src="/icons/google-drive.svg"
                            alt="Google Drive"
                            width={18}
                            height={18}
                          />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent sideOffset={5}>
                      <p>{isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-sm font-semibold text-slate-900">
                      {selectedIntegration === 'files' ? 'Files' : 'Google Drive'}
                    </h2>
                    {selectedIntegration === 'google-drive' && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        Beta
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-8"
                  onClick={() => {
                    queryClient.invalidateQueries({
                      queryKey: ['knowledge-base-resources', activeKnowledgeBaseId, knowledgeBasePath],
                    });
                    queryClient.invalidateQueries({
                      queryKey: ['connection-resources', activeConnectionId, currentResourceId ?? 'root'],
                    });
                  }}
                >
                  <RefreshCcw className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Refresh</span>
                </Button>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 h-8"
                        onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
                      >
                        {viewMode === 'list' ? (
                          <Grid3x3 className="h-3.5 w-3.5" />
                        ) : (
                          <List className="h-3.5 w-3.5" />
                        )}
                        <span className="hidden sm:inline">View</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent sideOffset={5}>
                      <p>{viewMode === 'list' ? 'Switch to grid view' : 'Switch to list view'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {selectedIntegration === 'google-drive' &&
                  (isMounted ? (
                    <Select
                      value={activeKnowledgeBaseId ?? undefined}
                      onValueChange={(value) => {
                        setSelectedKnowledgeBaseId(value);
                        selectionStore.clear();
                      }}
                    >
                      <SelectTrigger className="min-w-[160px] h-8 text-xs">
                        <SelectValue placeholder="Knowledge base" />
                      </SelectTrigger>
                      <SelectContent>
                        {knowledgeBaseOptions.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            <div className="flex items-center justify-between gap-2 w-full">
                              <span className="truncate">{item.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono shrink-0">
                                {item.id.slice(0, 8)}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="min-w-[160px] h-8 rounded-md bg-slate-100 animate-pulse" />
                  ))}
              </div>
            </div>

            <div className="flex flex-col gap-4 px-6 py-4 flex-1 min-h-0 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-slate-600 hover:text-slate-900 h-8 w-8"
                          onClick={() => toggleSort('name')}
                        >
                          <SortAsc className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={5}>
                        <p>Sort by name</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-slate-600 hover:text-slate-900 h-8 w-8"
                          onClick={() => toggleSort('modifiedAt')}
                        >
                          <Calendar className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={5}>
                        <p>Sort by date</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  {isMounted ? (
                    <Select
                      value={statusFilter}
                      onValueChange={(value) =>
                        setStatusFilter(value as typeof statusFilter)
                      }
                    >
                      <SelectTrigger className="h-8 w-[130px] border-slate-200 bg-white text-xs text-slate-600">
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="indexed">Indexed</SelectItem>
                        <SelectItem value="processing">Processing</SelectItem>
                        <SelectItem value="not_indexed">Not indexed</SelectItem>
                        <SelectItem value="error">Errors</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="h-8 w-[130px] rounded-md bg-slate-100 animate-pulse" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      value={filterText}
                      onChange={(event) => setFilterText(event.target.value)}
                      placeholder="Search by name"
                      className="pl-9 h-8 w-64 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/70 bg-white/70 shadow-sm flex-1 min-h-0 flex flex-col relative overflow-hidden">
                {viewMode === 'grid' ? (
                  <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
                    {isLoading ? (
                      <div className="p-5">
                        <ResourceSkeleton />
                      </div>
                    ) : (
                      <div className="p-5">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                          {sortedResources.map((resource) => {
                            const isSelected = selectionStore.isSelected(resource.id);
                            const canDelete =
                              resource.status === 'indexed' || resource.status === 'processing';
                            const isDirectory = resource.type === 'directory';
                            const displayName = isDirectory ? `${resource.name}/` : resource.name;
                            const baseActionLabel = isDirectory
                              ? canDelete
                                ? 'De-index'
                                : 'Index all'
                              : canDelete
                              ? 'De-index'
                              : 'Index';
                            const actionLabel =
                              loadingResourceId === resource.id
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
                                  isSelected
                                    ? 'border-slate-400 bg-slate-50'
                                    : 'border-slate-200/70 hover:border-slate-300'
                                )}
                                onClick={() => {
                                  if (resource.type === 'directory') {
                                    handleEnterDirectory(resource);
                                  } else {
                                    selectionStore.toggle(resource);
                                  }
                                }}
                              >
                                <div 
                                  className="absolute top-2 left-2 z-10"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => selectionStore.toggle(resource)}
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
                                          <p className="text-xs font-medium text-slate-700 truncate mb-1 group-hover:underline">
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
                                    <p className="text-xs font-medium text-slate-700 truncate mb-1 group-hover:underline">
                                      {displayName}
                                    </p>
                                  )}
                                  <p className="text-[10px] text-slate-500">
                                    {formatBytes(resource.size)}
                                  </p>
                                  <div className="mt-2 flex justify-center">
                                    <StatusBadge status={resource.status} />
                                  </div>
                                </div>

                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="w-full">
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant={canDelete ? 'outline' : 'secondary'}
                                          className={cn(
                                            'w-full mt-2 text-xs h-7',
                                            canDelete
                                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300'
                                              : 'bg-slate-900 text-white hover:bg-slate-800'
                                          )}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRowAction(resource);
                                          }}
                                          disabled={
                                            selectedIntegration === 'files' ||
                                            (isDirectory && resource.status === 'processing') ||
                                            loadingResourceId === resource.id
                                          }
                                        >
                                          {loadingResourceId === resource.id ? (
                                            <>
                                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                              {actionLabel}
                                            </>
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
            ) : (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto scrollbar-hide">
                  <div className="px-5 pt-3 pb-3">
                    <Table containerClassName="overflow-y-visible">
                      <TableHeader className="sticky top-0 z-20 bg-white shadow-[0_1px_0_0_rgba(148,163,184,0.4)] [&>tr]:bg-white [&>tr>th]:sticky [&>tr>th]:top-0 [&>tr>th]:bg-white">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-12">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center justify-center">
                                    <Checkbox
                                      checked={allSelected}
                                      onCheckedChange={handleToggleAll}
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
                              const isSelected = selectionStore.isSelected(resource.id);
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

                              const baseNameElement = isDirectory ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEnterDirectory(resource);
                                  }}
                                  className="text-sm font-medium text-slate-900 truncate block max-w-[300px] text-left group-hover:underline"
                                >
                                  {displayName}
                                </button>
                              ) : (
                                <span className="text-sm font-medium text-slate-900 truncate block max-w-[300px] group-hover:underline">
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
                                  data-state={isSelected ? 'selected' : undefined}
                                  className={cn(
                                    'group cursor-pointer',
                                    isSelected ? 'bg-slate-50' : 'hover:bg-slate-50/50'
                                  )}
                                  onClick={(e) => {
                                    if ((e.target as HTMLElement).closest('button')) {
                                      return;
                                    }
                                    selectionStore.toggle(resource);
                                  }}
                                >
                                  <TableCell className="w-12" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center justify-center">
                                      <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={() => selectionStore.toggle(resource)}
                                        aria-label={`Select ${displayName}`}
                                      />
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    {nameElement}
                                  </TableCell>
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
                                              onClick={() => handleRowAction(resource)}
                                              disabled={
                                                selectedIntegration === 'files' ||
                                                (isDirectory && resource.status === 'processing') ||
                                                loadingResourceId === resource.id
                                              }
                                            >
                                              {isLoadingAction ? (
                                                <>
                                                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                                  {actionLabel}
                                                </>
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
                  </div>
                </div>
              </div>
            )}
            {selectedIntegration === 'google-drive' && breadcrumbs.length > 1 && (
              <div className="border-t border-slate-200/70 bg-white/70 px-5 py-2.5 rounded-b-2xl">
                <Breadcrumb>
                  <BreadcrumbList>
                    {breadcrumbs.map((crumb, index) => {
                      const label =
                        index === 0
                          ? activeConnection?.name ?? 'Google Drive'
                          : crumb.label;
                      const isLast = index === breadcrumbs.length - 1;

                      return (
                        <Fragment key={`${crumb.resourcePath}-${index}`}>
                          <BreadcrumbItem>
                            {isLast ? (
                              <BreadcrumbPage className="text-xs font-medium">
                                {label}
                              </BreadcrumbPage>
                            ) : (
                              <BreadcrumbLink asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleBreadcrumbClick(index)}
                                  className="h-auto rounded-md px-2 py-1 text-xs font-medium hover:bg-slate-100"
                                >
                                  {label}
                                </Button>
                              </BreadcrumbLink>
                            )}
                          </BreadcrumbItem>
                          {!isLast && <BreadcrumbSeparator />}
                        </Fragment>
                      );
                    })}
                      </BreadcrumbList>
                    </Breadcrumb>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between border-t bg-slate-50/70 px-6 py-3.5 text-sm text-slate-500">
              <div>
                {selectionCount} item{selectionCount === 1 ? '' : 's'} selected
              </div>
              <div className="flex items-center gap-2.5">
                <Button
                  variant="ghost"
                  onClick={() => selectionStore.clear()}
                  className="text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </Button>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="inline-block">
                        <Button
                          onClick={handleIndexSelected}
                          disabled={selectedIntegration === 'files' || selectionCount === 0 || indexMutation.isPending}
                        >
                          Index selected
                        </Button>
                      </div>
                    </TooltipTrigger>
                    {selectedIntegration === 'files' && (
                      <TooltipContent sideOffset={5}>
                        <p>These are local files bruh :D</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
