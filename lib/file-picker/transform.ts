import type {
  ListKnowledgeBaseResourcesResponse,
  StackConnectionResource,
} from '@/lib/stack/types';
import type { ParsedResource, ResourceStatus } from './types';

function normalizePath(path: string | undefined, isDirectory: boolean): string {
  if (!path) {
    return isDirectory ? '' : '';
  }

  const trimmed = path.replace(/^\/+/, '');

  if (!trimmed) {
    return isDirectory ? '' : '';
  }

  if (isDirectory) {
    return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
  }

  return trimmed;
}

function extractName(path: string): string {
  if (!path) return 'Untitled';
  const segments = path.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? path;
}

function computeStatus(
  resource: StackConnectionResource,
  knowledgeBaseData?: ListKnowledgeBaseResourcesResponse,
  indexedResourceIds?: Set<string>,
  knowledgeBaseDescendants?: Map<string, ListKnowledgeBaseResourcesResponse>
): { status: ResourceStatus; kbEntry?: ListKnowledgeBaseResourcesResponse['data'][number] } {
  if (!knowledgeBaseData) {
    if (indexedResourceIds?.has(resource.resource_id)) {
      return { status: 'processing' };
    }
    return { status: 'not_indexed' };
  }

  const normalizedResourcePath = normalizePath(
    resource.inode_path.path,
    resource.inode_type === 'directory'
  );

  if (resource.inode_type === 'directory') {
    const match = knowledgeBaseData.data.find(
      (item) =>
        item.inode_type === 'directory' &&
        normalizePath(item.inode_path.path, true) === normalizedResourcePath
    );

    if (match) {
      const mappedStatus = mapKnowledgeBaseStatus(match.status);
      return { status: mappedStatus, kbEntry: match };
    }

    const descendantEntries: ListKnowledgeBaseResourcesResponse['data'] = [];
    const seen = new Set<string>();

    const addEntries = (items: ListKnowledgeBaseResourcesResponse['data']) => {
      for (const item of items) {
        const normalized = normalizePath(item.inode_path.path, item.inode_type === 'directory');
        const key = `${item.resource_id ?? normalized}`;
        if (
          (!normalizedResourcePath || normalized.startsWith(normalizedResourcePath)) &&
          normalized !== normalizedResourcePath &&
          !seen.has(key)
        ) {
          descendantEntries.push(item);
          seen.add(key);
        }
      }
    };

    if (knowledgeBaseData) {
      addEntries(knowledgeBaseData.data);
    }

    if (knowledgeBaseDescendants) {
      knowledgeBaseDescendants.forEach((childData, pathKey) => {
        const normalizedKeyPath = normalizePath(pathKey, true);
        if (!normalizedResourcePath || normalizedKeyPath.startsWith(normalizedResourcePath)) {
          addEntries(childData.data);
        }
      });
    }

    if (descendantEntries.length === 0) {
      if (indexedResourceIds?.has(resource.resource_id)) {
        return { status: 'processing' };
      }
      return { status: 'not_indexed' };
    }

    const aggregatedStatuses = descendantEntries.map((entry) =>
      mapKnowledgeBaseStatus(entry.status)
    );

    if (aggregatedStatuses.includes('error')) {
      return { status: 'error' };
    }

    if (aggregatedStatuses.includes('processing') || aggregatedStatuses.includes('pending')) {
      return { status: 'processing' };
    }

    if (aggregatedStatuses.includes('indexed')) {
      return { status: 'indexed' };
    }

    if (indexedResourceIds?.has(resource.resource_id)) {
      return { status: 'processing' };
    }

    return { status: 'not_indexed' };
  }

  const match = knowledgeBaseData.data.find(
    (item) => item.resource_id === resource.resource_id
  );

  if (!match) {
    if (indexedResourceIds?.has(resource.resource_id)) {
      return { status: 'processing' };
    }
    return { status: 'not_indexed' };
  }

  return { status: mapKnowledgeBaseStatus(match.status), kbEntry: match };
}

/**
 * status mapping: Stack AI Backend → UI States
 * 
 * maps Stack AI's knowledge base statuses to our simpler UI states:
 * - 'indexed' to green badge (ready to use)
 * - 'processing'/'pending' to amber badge (in progress)
 * - 'error' to red badge (failed)
 * - undefined/other to gray badge (not indexed)
 * 
 * note: we merge 'processing' and 'pending' because they both indicate
 * "work in progress" from the user's perspective.
 */
function mapKnowledgeBaseStatus(status: string | undefined): ResourceStatus {
  switch (status) {
    case 'indexed':
      return 'indexed';
    case 'processing':
    case 'pending':
      return 'processing'; // combine these for simpler UI
    case 'error':
      return 'error';
    default:
      return 'not_indexed';
  }
}

export function toParsedResources(
  resources: StackConnectionResource[],
  knowledgeBaseData?: ListKnowledgeBaseResourcesResponse,
  indexedResourceIds?: Set<string>,
  knowledgeBaseDescendants?: Map<string, ListKnowledgeBaseResourcesResponse>
): ParsedResource[] {
  return resources.map((resource) => {
    const rawPath = resource.inode_path.path;
    const normalizedFullPath =
      resource.inode_type === 'directory'
        ? normalizePath(rawPath, true)
        : normalizePath(rawPath, false);

    const fullPath = normalizedFullPath ? `/${normalizedFullPath}` : '/';

    const { status, kbEntry } = computeStatus(
      resource,
      knowledgeBaseData,
      indexedResourceIds,
      knowledgeBaseDescendants
    );

    return {
      id: resource.resource_id,
      type: resource.inode_type,
      name: extractName(fullPath),
      fullPath,
      modifiedAt:
        resource.dataloader_metadata?.last_modified_at ?? resource.modified_at,
      size: resource.size,
      status,
      knowledgeBaseStatus: kbEntry?.status,
      knowledgeBasePath: kbEntry?.inode_path.path,
      raw: resource,
    };
  });
}

export function pruneSelectionsAgainst(selected: ParsedResource[], candidate: ParsedResource): ParsedResource[] {
  if (candidate.type !== 'directory') {
    return selected;
  }

  const prefix = candidate.fullPath.endsWith('/')
    ? candidate.fullPath
    : `${candidate.fullPath}/`;
  return selected.filter((item) => !item.fullPath.startsWith(prefix));
}

export function resourcePathToKnowledgeBasePath(resourcePath: string | undefined): string {
  if (!resourcePath || resourcePath === '/') {
    return '/';
  }

  const clean = resourcePath.replace(/^\/+/, '');
  return `/${clean}`;
}
