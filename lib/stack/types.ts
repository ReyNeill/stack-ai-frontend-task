export interface StackConnection {
  connection_id: string;
  name: string;
  provider_id: string;
  connection_provider_data?: Record<string, unknown>;
}

export interface StackResourcePath {
  path: string;
}

export interface StackConnectionResource {
  knowledge_base_id: string;
  created_at: string;
  modified_at: string;
  indexed_at: string | null;
  inode_type: 'file' | 'directory';
  resource_id: string;
  inode_path: StackResourcePath;
  dataloader_metadata: {
    path?: string;
    web_url?: string;
    last_modified_at?: string;
    last_modified_by?: string;
    created_at?: string;
    created_by?: string;
  };
  user_metadata: Record<string, unknown>;
  inode_id: string | null;
  content_hash?: string;
  content_mime?: string;
  size?: number;
  status?: string;
}

export interface StackKnowledgeBaseSummary {
  knowledge_base_id: string;
  connection_id: string;
  name: string;
  description: string | null;
  connection_source_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface StackKnowledgeBaseDetail extends StackKnowledgeBaseSummary {
  website_sources: unknown[];
  indexing_params: Record<string, unknown>;
  cron_job_id: string | null;
  org_id: string;
  org_level_role: string | null;
}

export interface StackKnowledgeBaseResource extends StackConnectionResource {
  knowledge_base_id: string;
  status: 'indexed' | 'pending' | 'processing' | 'error' | 'resource' | string;
}

export type ListConnectionsResponse = StackConnection[];

export interface ListConnectionResourcesResponse {
  data: StackConnectionResource[];
}

export interface ListKnowledgeBasesResponse {
  admin?: StackKnowledgeBaseSummary[];
  editor?: StackKnowledgeBaseSummary[];
  viewer?: StackKnowledgeBaseSummary[];
}

export interface ListKnowledgeBaseResourcesResponse {
  data: StackKnowledgeBaseResource[];
}

export interface OrgResponse {
  org_id: string;
}
