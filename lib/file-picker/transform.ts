import type {
  ListKnowledgeBaseResourcesResponse,
  StackConnectionResource,
} from '@/lib/stack/types';
import type { ParsedResource, ResourceStatus } from './types';

function extractName(path: string): string {
  if (!path) return 'Untitled';
  const segments = path.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? path;
}

function computeStatus(
  resource: StackConnectionResource,
  knowledgeBaseData?: ListKnowledgeBaseResourcesResponse
): { status: ResourceStatus; kbEntry?: ListKnowledgeBaseResourcesResponse['data'][number] } {
  if (!knowledgeBaseData) {
    return { status: 'not_indexed' };
  }

  if (resource.inode_type === 'directory') {
    const match = knowledgeBaseData.data.find(
      (item) =>
        item.inode_type === 'directory' &&
        item.inode_path.path === resource.inode_path.path
    );

    if (match) {
      const mappedStatus = mapKnowledgeBaseStatus(match.status);
      return { status: mappedStatus, kbEntry: match };
    }

    const directoryPath = resource.inode_path.path.endsWith('/')
      ? resource.inode_path.path
      : `${resource.inode_path.path}/`;

    const descendantEntries = knowledgeBaseData.data.filter((item) =>
      item.inode_path.path.startsWith(directoryPath)
    );

    if (descendantEntries.length === 0) {
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

    return { status: 'not_indexed' };
  }

  const match = knowledgeBaseData.data.find(
    (item) => item.resource_id === resource.resource_id
  );

  if (!match) {
    return { status: 'not_indexed' };
  }

  return { status: mapKnowledgeBaseStatus(match.status), kbEntry: match };
}

function mapKnowledgeBaseStatus(status: string | undefined): ResourceStatus {
  switch (status) {
    case 'indexed':
      return 'indexed';
    case 'processing':
    case 'pending':
      return 'processing';
    case 'error':
      return 'error';
    default:
      return 'not_indexed';
  }
}

export function toParsedResources(
  resources: StackConnectionResource[],
  knowledgeBaseData?: ListKnowledgeBaseResourcesResponse
): ParsedResource[] {
  return resources.map((resource) => {
    const rawPath = resource.inode_path.path;
    const fullPath =
      resource.inode_type === 'directory' && rawPath && !rawPath.endsWith('/')
        ? `${rawPath}/`
        : rawPath;
    const { status, kbEntry } = computeStatus(resource, knowledgeBaseData);

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
