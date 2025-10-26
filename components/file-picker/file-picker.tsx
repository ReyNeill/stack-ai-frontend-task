'use client';

import Image from 'next/image';
import { Activity, useMemo, useState, Fragment, useEffect, useCallback, useRef } from 'react';
import {
  Calendar,
  Folder,
  Grid3x3,
  List,
  RefreshCcw,
  Search,
  SortAsc,
  Loader2,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/http';
import {
  ListConnectionResourcesResponse,
  ListConnectionsResponse,
  ListKnowledgeBaseResourcesResponse,
  ListKnowledgeBasesResponse,
  StackKnowledgeBaseSummary,
  StackKnowledgeBaseDetail,
} from '@/lib/stack/types';
import { cn } from '@/lib/utils';
import {
  ParsedResource,
} from '@/lib/file-picker/types';
import {
  resourcePathToKnowledgeBasePath,
  toParsedResources,
} from '@/lib/file-picker/transform';
import { useSelectionStore } from '@/hooks/use-selection-store';
import { Button } from '@/components/ui/button';
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
import { ResourceListView } from './resource-list-view';
import { ResourceGridView } from './resource-grid-view';
import { ResourceSkeleton } from './resource-skeleton';
import { PrefetchHiddenQueries } from './prefetch-hidden-queries';
import {
  INTEGRATIONS,
  SAMPLE_LOCAL_FILES,
  PREFETCH_TOAST_CACHE,
} from './constants';
import {
  flattenKnowledgeBases,
  findKnowledgeBaseSummary,
  isImageFile,
  isVideoFile,
} from './utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import type { CheckedState } from '@radix-ui/react-checkbox';

interface BreadcrumbItem {
  label: string;
  resourcePath: string;
  resourceId?: string;
}

type SortField = 'name' | 'modifiedAt';
type SortDirection = 'asc' | 'desc';

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
  const [prefetchResource, setPrefetchResource] = useState<ParsedResource | null>(null);
  const [previewResource, setPreviewResource] = useState<ParsedResource | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewResourceIdRef = useRef<string | null>(null);
  const [pendingResourceIds, setPendingResourceIds] = useState<string[]>([]);

  const pendingResourceIdSet = useMemo(
    () => new Set(pendingResourceIds),
    [pendingResourceIds]
  );

  const addPendingResourceIds = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setPendingResourceIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        next.add(id);
      }
      return Array.from(next);
    });
  }, []);

  const removePendingResourceIds = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setPendingResourceIds((prev) => prev.filter((id) => !ids.includes(id)));
  }, []);

  /**
   * load folder contents on hover (<Activity>)
   * 
   * performance optimization to minimize wait time:
   * - when user hovers over a folder, start loading its contents
   * - by the time they click, data is often already loaded
   * - shows subtle debug toast to indicate background loading
   * - dramatically improves perceived performance
   */
  const startPrefetch = (resource: ParsedResource) => {
    // only prefetch Google Drive directories
    if (resource.type !== 'directory' || selectedIntegration !== 'google-drive') {
      return;
    }

    if (!activeConnectionId) {
      return;
    }

    // create unique toast key to avoid duplicate notifications
    const toastKey = `${activeConnectionId}:${activeKnowledgeBaseId ?? 'none'}:${resource.id}`;

    // show toast only once per folder
    if (!PREFETCH_TOAST_CACHE.has(toastKey)) {
      PREFETCH_TOAST_CACHE.add(toastKey);
      toast.info(`Preloading "${resource.name}" in the background…`, {
        id: toastKey,
      });
    }

    // trigger prefetch by updating state (causes PrefetchComponent to fetch)
    setPrefetchResource((prev) => (prev?.id === resource.id ? prev : resource));
  };

  const closePreview = useCallback(() => {
    previewResourceIdRef.current = null;
    setPreviewResource(null);
    setPreviewContent(null);
    setPreviewError(null);
    setIsPreviewLoading(false);
  }, []);

  const handleOpenPreview = useCallback(
    async (resource: ParsedResource) => {
      if (resource.type === 'directory' || !resource.preview) {
        return;
      }

      previewResourceIdRef.current = resource.id;
      setPreviewResource(resource);
      setPreviewContent(null);
      setPreviewError(null);

      if (resource.preview.type === 'text') {
        setIsPreviewLoading(true);
        try {
          const previewUrl = resource.preview.src.startsWith('http')
            ? resource.preview.src
            : encodeURI(resource.preview.src);
          const response = await fetch(previewUrl);
          if (!response.ok) {
            throw new Error(`Failed to load preview (status ${response.status})`);
          }
          const text = await response.text();
          if (previewResourceIdRef.current !== resource.id) {
            return;
          }
          setPreviewContent(text);
        } catch (error) {
          if (previewResourceIdRef.current !== resource.id) {
            return;
          }
          console.error(error);
          setPreviewError('Unable to load preview.');
        } finally {
          if (previewResourceIdRef.current === resource.id) {
            setIsPreviewLoading(false);
          }
        }
      } else {
        setIsPreviewLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setIsMounted(true);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (!previewResource) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closePreview();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [previewResource, closePreview]);

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
  const activeKnowledgeBaseSummary = useMemo(
    () => findKnowledgeBaseSummary(knowledgeBasesQuery.data, activeKnowledgeBaseId),
    [knowledgeBasesQuery.data, activeKnowledgeBaseId]
  );
  const indexedResourceIds = useMemo(() => {
    if (!activeKnowledgeBaseSummary?.connection_source_ids) {
      return undefined;
    }
    return new Set(activeKnowledgeBaseSummary.connection_source_ids);
  }, [activeKnowledgeBaseSummary]);

  const updateKnowledgeBaseSummary = (updater: (ids: string[]) => string[] | undefined) => {
    if (!activeKnowledgeBaseId) return;
    queryClient.setQueryData<ListKnowledgeBasesResponse>(['knowledge-bases'], (current) => {
      if (!current) return current;

      const next: ListKnowledgeBasesResponse = { ...current };
      const segments: Array<keyof ListKnowledgeBasesResponse> = ['admin', 'editor', 'viewer'];

      for (const segment of segments) {
        const list = current[segment];
        if (!Array.isArray(list)) continue;
        const index = list.findIndex((item) => item.knowledge_base_id === activeKnowledgeBaseId);
        if (index === -1) continue;

        const target = list[index];
        const updatedIds = updater([...(target.connection_source_ids ?? [])]);
        if (!updatedIds) {
          return next;
        }

        const updatedItem: StackKnowledgeBaseSummary = {
          ...target,
          connection_source_ids: updatedIds,
        };

        next[segment] = [
          ...list.slice(0, index),
          updatedItem,
          ...list.slice(index + 1),
        ];

        break;
      }

      return next;
    });
  };

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
    refetchInterval: (data) => {
      if (!activeKnowledgeBaseId || selectedIntegration !== 'google-drive') {
        return false;
      }

      const hasPendingRequests = pendingResourceIds.length > 0;
      const hasProcessingStatuses = data?.data.some((item) =>
        item.status === 'processing' || item.status === 'pending'
      ) ?? false;

      if (!hasPendingRequests && !hasProcessingStatuses) {
        return false;
      }

      return 4000; // poll every 4s while work is in-flight
    },
    refetchIntervalInBackground: true,
  });

  const knowledgeBaseDescendants = useMemo(() => {
    if (!activeKnowledgeBaseId) {
      return new Map<string, ListKnowledgeBaseResourcesResponse>();
    }

    void knowledgeBaseResourcesQuery.dataUpdatedAt;

    const entries = queryClient.getQueriesData<ListKnowledgeBaseResourcesResponse>({
      queryKey: ['knowledge-base-resources', activeKnowledgeBaseId],
    });

    const map = new Map<string, ListKnowledgeBaseResourcesResponse>();
    for (const [key, data] of entries) {
      const queryKey = key as unknown as [string, string, string];
      const [, , path] = queryKey;
      if (path != null && data) {
        map.set(path, data);
      }
    }

    return map;
  }, [queryClient, activeKnowledgeBaseId, knowledgeBaseResourcesQuery.dataUpdatedAt]);

  const isStatusLoading =
    selectedIntegration === 'google-drive' && knowledgeBaseResourcesQuery.isLoading;

  const previewSource = previewResource?.preview?.src ?? previewResource?.fullPath ?? '';
  const encodedPreviewSource =
    previewSource && !previewSource.startsWith('http')
      ? encodeURI(previewSource)
      : previewSource;

  const parsedResources = useMemo(() => {
    if (selectedIntegration === 'files') {
      return SAMPLE_LOCAL_FILES;
    }
    return toParsedResources(
      connectionResourcesQuery.data?.data ?? [],
      knowledgeBaseResourcesQuery.data,
      indexedResourceIds,
      knowledgeBaseDescendants,
      pendingResourceIdSet
    );
  }, [
    selectedIntegration,
    connectionResourcesQuery.data,
    knowledgeBaseResourcesQuery.data,
    indexedResourceIds,
    knowledgeBaseDescendants,
    pendingResourceIdSet,
  ]);

  const filteredResources = useMemo(() => {
    const textFilter = filterText.trim().toLowerCase();
    let resources = parsedResources;

    if (textFilter) {
      resources = resources.filter((resource) =>
        resource.name.toLowerCase().includes(textFilter)
      );
    }

    if (statusFilter !== 'all' && !isStatusLoading) {
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
  }, [parsedResources, filterText, statusFilter, isStatusLoading]);

  const sortedResources = useMemo(() => {
    return [...filteredResources].sort((a, b) => {
      // TIER 1: always put directories first for better navigation
      if (a.type === 'directory' && b.type !== 'directory') return -1;
      if (a.type !== 'directory' && b.type === 'directory') return 1;
      
      // TIER 2: within same type (all folders or all files), sort by selected field
      if (sortField === 'name') {
        return sortDirection === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }

      // sort by modification date
      const aDate = a.modifiedAt ? new Date(a.modifiedAt).getTime() : 0;
      const bDate = b.modifiedAt ? new Date(b.modifiedAt).getTime() : 0;
      return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
    });
  }, [filteredResources, sortDirection, sortField]);

  const selectionCount = selectionStore.items.size;
  const allSelected =
    sortedResources.length > 0 &&
    sortedResources.every((resource) => selectionStore.isSelected(resource));

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

    const normalizedPath = resource.fullPath.endsWith('/')
      ? resource.fullPath
      : `${resource.fullPath}/`;

    setBreadcrumbs((prev) => [
      ...prev,
      {
        label: resource.name,
        resourceId: resource.id,
        resourcePath: normalizedPath,
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

  /**
   * OPTIMISTIC UPDATE PATTERN FOR INDEXING
   * 
   * this mutation demonstrates a robust optimistic UI pattern:
   * 1. onMutate: immediately update UI before API call (optimistic)
   * 2. onError: rollback changes if API fails
   * 3. onSuccess: confirm changes and show success message
   * 
   * benefits:
   * - instant feedback (no waiting for API)
   * - graceful error handling with rollback
   * - better UX with loading states only on action buttons
   */
  const indexMutation = useMutation({
    mutationFn: async (payload: { resourceIds: string[] }) => {
      return apiPost<{ knowledge_base: StackKnowledgeBaseDetail }>(
        `/api/stack/knowledge-bases/${activeKnowledgeBaseId}/index`,
        payload
      );
    },
    onMutate: async (variables) => {
      const { resourceIds } = variables;
      
      // show loading spinner only on the specific button being clicked
      if (resourceIds.length === 1) {
        setLoadingResourceId(resourceIds[0]);
      }

      addPendingResourceIds(resourceIds);

      // optimistically add resources to knowledge base summary
      // this updates the global indexed state immediately
      updateKnowledgeBaseSummary((ids) => {
        if (!activeKnowledgeBaseId) return undefined;
        const next = new Set(ids);
        for (const id of resourceIds) {
          next.add(id);
        }
        return Array.from(next);
      });

      // cancel any in-flight queries to prevent race conditions
      await queryClient.cancelQueries({
        queryKey: ['knowledge-base-resources', activeKnowledgeBaseId, knowledgeBasePath],
      });

      // save previous state for potential rollback on error
      const previous = queryClient.getQueryData<
        ListKnowledgeBaseResourcesResponse
      >([
        'knowledge-base-resources',
        activeKnowledgeBaseId,
        knowledgeBasePath,
      ]);

      if (previous) {
        // transform selected resources to match KB resource format
        const resourcesToIndex = parsedResources
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
            status: 'processing', // set to processing immediately for instant feedback
          }));

        // CRITICAL: avoid duplicates by updating existing resources
        // this prevents "Error" badges from appearing due to duplicate entries
        const existingIds = new Set(previous.data.map(item => item.resource_id));
        const updatedData = previous.data.map(item => {
          const updated = resourcesToIndex.find(r => r.resource_id === item.resource_id);
          return updated || item; // update status if exists, otherwise keep original
        });
        
        // only add truly new resources that don't exist yet
        const newResources = resourcesToIndex.filter(r => !existingIds.has(r.resource_id));

        // apply optimistic update to React Query cache
        queryClient.setQueryData<ListKnowledgeBaseResourcesResponse>(
          ['knowledge-base-resources', activeKnowledgeBaseId, knowledgeBasePath],
          {
            data: [...updatedData, ...newResources],
          }
        );
      }

      // return context for rollback on error
      return { previous, resourceIds };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ['knowledge-base-resources', activeKnowledgeBaseId, knowledgeBasePath],
          context.previous
        );
      }
      const attemptedIds = context?.resourceIds ?? [];
      if (attemptedIds.length > 0) {
        updateKnowledgeBaseSummary((ids) => {
          if (!activeKnowledgeBaseId) return undefined;
          const next = ids.filter((id) => !attemptedIds.includes(id));
          return next;
        });
        removePendingResourceIds(attemptedIds);
      }
      toast.error('Failed to start indexing. Please try again.');
    },
    onSuccess: (data, variables) => {
      const { resourceIds } = variables;

      if (data?.knowledge_base?.connection_source_ids) {
        const ids = data.knowledge_base.connection_source_ids;
        updateKnowledgeBaseSummary(() => {
          // merge server snapshot with requested ids to avoid losing optimistic state
          const mergedIds = new Set(ids);
          for (const resourceId of resourceIds) {
            mergedIds.add(resourceId);
          }
          return Array.from(mergedIds);
        });
      } else if (resourceIds.length > 0) {
        updateKnowledgeBaseSummary((existing) => {
          // fallback: ensure optimistic ids stick around if response omitted them
          const mergedIds = new Set(existing);
          for (const resourceId of resourceIds) {
            mergedIds.add(resourceId);
          }
          return Array.from(mergedIds);
        });
      }
      toast.success('Indexing started');
      selectionStore.clear();
      
      // poll for status updates until resources appear as indexed or processing
      // this prevents premature refetch from overwriting optimistic "processing" state
      let pollAttempts = 0;
      const maxAttempts = 10;
      
      const pollInterval = setInterval(async () => {
        pollAttempts++;
        
        // refetch to check current status
        const result = await queryClient.fetchQuery({
          queryKey: ['knowledge-base-resources', activeKnowledgeBaseId, knowledgeBasePath],
          queryFn: () =>
            apiGet<ListKnowledgeBaseResourcesResponse>(
              `/api/stack/knowledge-bases/${activeKnowledgeBaseId}/resources?resourcePath=${encodeURIComponent(knowledgeBasePath)}`
            ),
        });

        const resolvedIds: string[] = [];
        for (const id of resourceIds) {
          const match = result?.data.find((item) => item.resource_id === id);
          if (match && match.status && match.status !== 'not_indexed') {
            resolvedIds.push(id);
          }
        }

        if (resolvedIds.length > 0) {
          removePendingResourceIds(resolvedIds);
        }
        
        // check if any of the indexed resources now show as processing or indexed
        const allProcessing = resourceIds.every((id) => {
          const match = result?.data.find((item) => item.resource_id === id);
          return match && (match.status === 'processing' || match.status === 'indexed' || match.status === 'pending');
        });
        
        if (allProcessing || pollAttempts >= maxAttempts) {
          removePendingResourceIds(resourceIds);
          clearInterval(pollInterval);
          // final invalidation to ensure UI is in sync
          queryClient.invalidateQueries({
            queryKey: ['knowledge-base-resources', activeKnowledgeBaseId],
          });
        }
      }, 2000); // poll every 2 seconds
    },
    onSettled: () => {
      setLoadingResourceId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (resource: ParsedResource) => {
      if (resource.type !== 'directory') {
        await apiDelete(
          `/api/stack/knowledge-bases/${activeKnowledgeBaseId}/resources?resourcePath=${encodeURIComponent(resource.fullPath)}`
        );
      }
      return apiPatch<{ knowledge_base: StackKnowledgeBaseDetail; connection_source_ids: string[] }>(
        `/api/stack/knowledge-bases/${activeKnowledgeBaseId}/connection-sources`,
        { resourceId: resource.id, action: 'remove' }
      );
    },
    onMutate: async (resource) => {
      setLoadingResourceId(resource.id);

      removePendingResourceIds([resource.id]);

      updateKnowledgeBaseSummary((ids) => {
        if (!activeKnowledgeBaseId) return undefined;
        const next = ids.filter((id) => id !== resource.id);
        return next;
      });

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

      return { previous, resourceId: resource.id };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ['knowledge-base-resources', activeKnowledgeBaseId, knowledgeBasePath],
          context.previous
        );
      }
      if (context?.resourceId) {
        updateKnowledgeBaseSummary((ids) => {
          if (!activeKnowledgeBaseId) return undefined;
          const next = new Set(ids);
          next.add(context.resourceId!);
          return Array.from(next);
        });
      }
      toast.error('Failed to de-index resource.');
    },
    onSuccess: (data) => {
      if (data?.connection_source_ids) {
        const ids = data.connection_source_ids;
        updateKnowledgeBaseSummary(() => ids);
      }
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
    // prevent API calls for sample local files
    if (selectedIntegration === 'files') {
      toast.error('Indexing local files is not yet supported');
      return;
    }

    if (isStatusLoading) {
      toast.info('Please wait for statuses to finish loading.');
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
    <>
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
                          setPrefetchResource(null);
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
                  <ResourceGridView
                    sortedResources={sortedResources}
                    isLoading={isLoading}
                    selectedIntegration={selectedIntegration}
                    loadingResourceId={loadingResourceId}
                    isStatusLoading={isStatusLoading}
                    isSelected={(resource) => selectionStore.isSelected(resource)}
                    onToggle={(resource) => selectionStore.toggle(resource)}
                    onEnterDirectory={handleEnterDirectory}
                    onRowAction={handleRowAction}
                    onPrefetch={startPrefetch}
                    isImageFile={isImageFile}
                    isVideoFile={isVideoFile}
                    renderSkeleton={() => <ResourceSkeleton />}
                    onOpenPreview={
                      selectedIntegration === 'files' ? handleOpenPreview : undefined
                    }
                  />
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-5">
                <ResourceListView
                  sortedResources={sortedResources}
                  isLoading={isLoading}
                  allSelected={allSelected}
                  selectedIntegration={selectedIntegration}
                  isSidebarCollapsed={isSidebarCollapsed}
                  loadingResourceId={loadingResourceId}
                  isSelected={(resource) => selectionStore.isSelected(resource)}
                  onToggle={(resource) => selectionStore.toggle(resource)}
                  onToggleAll={handleToggleAll}
                  onEnterDirectory={handleEnterDirectory}
                  onRowAction={handleRowAction}
                  onPrefetch={startPrefetch}
                  onOpenPreview={
                    selectedIntegration === 'files' ? handleOpenPreview : undefined
                  }
                />
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
                          disabled={
                            selectedIntegration === 'files' ||
                            selectionCount === 0 ||
                            indexMutation.isPending ||
                            isStatusLoading
                          }
                        >
                          Index selected
                        </Button>
                      </div>
                    </TooltipTrigger>
                    {selectedIntegration === 'files' ? (
                      <TooltipContent sideOffset={5}>
                        <p>These are local files bruh :D</p>
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
            </div>
          </section>
        </div>
      </div>
      </main>
      {previewResource && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-6"
          onClick={closePreview}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative w-full max-w-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="overflow-hidden rounded-[28px] border border-white/25 bg-white/95 shadow-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-100/90 px-5 py-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      closePreview();
                    }}
                    aria-label="Close preview"
                    className="h-3 w-3 rounded-full bg-[#ff5f57] transition-colors hover:bg-[#ff5f57]/80 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled
                    aria-label="Minimize disabled"
                    className="h-3 w-3 rounded-full bg-[#febc2e] opacity-40"
                  />
                  <button
                    type="button"
                    disabled
                    aria-label="Zoom disabled"
                    className="h-3 w-3 rounded-full bg-[#28c840] opacity-40"
                  />
                </div>
                <div className="flex-1 text-center">
                  <span className="block truncate text-sm font-semibold text-slate-700">
                    {previewResource.name}
                  </span>
                  {previewResource.preview?.type && (
                    <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      {previewResource.preview.type}
                    </span>
                  )}
                </div>
                <div className="w-12" />
              </div>
              <div className="bg-white/95 px-6 py-6">
                {isPreviewLoading ? (
                  <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-slate-500">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="text-sm font-medium">Loading preview...</span>
                  </div>
                ) : previewError ? (
                  <div className="flex h-[60vh] items-center justify-center text-sm text-slate-500">
                    {previewError}
                  </div>
                ) : previewResource.preview?.type === 'image' ? (
                  <div className="relative h-[60vh] w-full overflow-hidden rounded-2xl bg-slate-900">
                    <Image
                      src={previewSource || '/file.svg'}
                      alt={previewResource.name}
                      fill
                      className="object-contain"
                      sizes="(max-width: 768px) 90vw, (max-width: 1024px) 70vw, 50vw"
                    />
                  </div>
                ) : previewResource.preview?.type === 'video' ? (
                  <div className="overflow-hidden rounded-2xl bg-black">
                    <video
                      key={encodedPreviewSource}
                      src={encodedPreviewSource}
                      className="w-full max-h-[60vh]"
                      controls
                      autoPlay
                      muted
                      playsInline
                      preload="metadata"
                    />
                  </div>
                ) : previewResource.preview?.type === 'text' ? (
                  <ScrollArea className="h-[60vh] rounded-2xl border border-slate-200 bg-slate-50">
                    <pre className="whitespace-pre-wrap break-words p-5 font-mono text-sm text-slate-800">
                      {previewContent ?? 'No content available.'}
                    </pre>
                  </ScrollArea>
                ) : (
                  <div className="flex h-[60vh] items-center justify-center text-sm text-slate-500">
                    Preview not available.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {selectedIntegration === 'google-drive' &&
        prefetchResource &&
        activeConnectionId && (
          <Activity mode="visible">
            <PrefetchHiddenQueries
              connectionId={activeConnectionId}
              knowledgeBaseId={activeKnowledgeBaseId}
              resource={prefetchResource}
              onSettled={() => setPrefetchResource(null)}
            />
          </Activity>
        )}
    </>
  );
}
