'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet } from '@/lib/http';
import { ListConnectionResourcesResponse, ListKnowledgeBaseResourcesResponse } from '@/lib/stack/types';
import { resourcePathToKnowledgeBasePath } from '@/lib/file-picker/transform';
import { ParsedResource } from '@/lib/file-picker/types';
import { PREFETCH_TOAST_CACHE, PREFETCH_COMPLETED_CACHE } from './constants';

interface PrefetchHiddenQueriesProps {
  connectionId?: string;
  knowledgeBaseId?: string;
  resource: ParsedResource;
  onSettled: () => void;
}

export function PrefetchHiddenQueries({
  connectionId,
  knowledgeBaseId,
  resource,
  onSettled,
}: PrefetchHiddenQueriesProps) {
  const queryClient = useQueryClient();
  const isDirectory = resource.type === 'directory';
  const knowledgeBasePath = resourcePathToKnowledgeBasePath(resource.fullPath);

  useEffect(() => {
    if (!connectionId || !isDirectory) {
      return;
    }

    const connectionKey: [string, string, string | undefined] = [
      'connection-resources',
      connectionId,
      resource.id,
    ];

    const toastKey = `${connectionId}:${knowledgeBaseId ?? 'none'}:${resource.id}`;

    let cancelled = false;

    const run = async () => {
      try {
        await queryClient.prefetchQuery({
          queryKey: connectionKey,
          queryFn: () =>
            apiGet<ListConnectionResourcesResponse>(
              `/api/stack/connections/${connectionId}/resources${resource.id ? `?resourceId=${resource.id}` : ''}`
            ),
          staleTime: 120_000,
        });

        if (knowledgeBaseId) {
          const knowledgeKey: [string, string, string] = [
            'knowledge-base-resources',
            knowledgeBaseId,
            knowledgeBasePath,
          ];

          await queryClient.prefetchQuery({
            queryKey: knowledgeKey,
            queryFn: () =>
              apiGet<ListKnowledgeBaseResourcesResponse>(
                `/api/stack/knowledge-bases/${knowledgeBaseId}/resources?resourcePath=${encodeURIComponent(knowledgeBasePath)}`
              ),
            staleTime: 120_000,
          });
        }

        if (!cancelled && PREFETCH_TOAST_CACHE.has(toastKey) && !PREFETCH_COMPLETED_CACHE.has(toastKey)) {
          PREFETCH_COMPLETED_CACHE.add(toastKey);
          toast.success(`"${resource.name}" is ready to open.`, {
            id: toastKey,
          });
        }
      } catch {
        if (!cancelled && PREFETCH_TOAST_CACHE.has(toastKey) && !PREFETCH_COMPLETED_CACHE.has(toastKey)) {
          toast.error(`Failed to preload "${resource.name}".`, {
            id: toastKey,
          });
        }
      } finally {
        if (!cancelled) {
          onSettled();
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [
    connectionId,
    knowledgeBaseId,
    knowledgeBasePath,
    isDirectory,
    queryClient,
    resource.fullPath,
    resource.id,
    resource.name,
    onSettled,
  ]);

  return null;
}

