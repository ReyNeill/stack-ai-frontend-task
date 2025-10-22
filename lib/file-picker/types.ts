import type {
  StackConnectionResource,
  StackKnowledgeBaseResource,
} from '@/lib/stack/types';

export type ResourceKind = 'file' | 'directory';

export interface ParsedResource {
  id: string;
  type: ResourceKind;
  name: string;
  fullPath: string;
  modifiedAt?: string;
  size?: number;
  status: ResourceStatus;
  knowledgeBaseStatus?: StackKnowledgeBaseResource['status'];
  knowledgeBasePath?: string;
  raw: StackConnectionResource;
}

export type ResourceStatus = 'indexed' | 'pending' | 'processing' | 'error' | 'not_indexed';

export type ResourceSelectionMap = Map<string, ParsedResource>;
