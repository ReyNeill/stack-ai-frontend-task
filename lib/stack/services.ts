import { stackGet, stackPost, stackPut, stackDelete } from './client';
import {
  ListConnectionResourcesResponse,
  ListConnectionsResponse,
  ListKnowledgeBaseResourcesResponse,
  ListKnowledgeBasesResponse,
  OrgResponse,
  StackKnowledgeBaseDetail,
} from './types';

export async function fetchConnections(): Promise<ListConnectionsResponse> {
  return stackGet('/connections?connection_provider=gdrive&limit=20');
}

export async function fetchConnectionChildren(
  connectionId: string,
  resourceId?: string
): Promise<ListConnectionResourcesResponse> {
  const searchParams = new URLSearchParams();
  if (resourceId) {
    searchParams.set('resource_id', resourceId);
  }

  const query = searchParams.toString();
  const path = query
    ? `/connections/${connectionId}/resources/children?${query}`
    : `/connections/${connectionId}/resources/children`;

  return stackGet(path);
}

export async function fetchKnowledgeBases(): Promise<ListKnowledgeBasesResponse> {
  return stackGet('/knowledge_bases');
}

export async function fetchKnowledgeBase(
  knowledgeBaseId: string
): Promise<StackKnowledgeBaseDetail> {
  return stackGet(`/knowledge_bases/${knowledgeBaseId}`);
}

export async function fetchKnowledgeBaseChildren(
  knowledgeBaseId: string,
  resourcePath: string
): Promise<ListKnowledgeBaseResourcesResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set('resource_path', resourcePath);
  return stackGet(
    `/knowledge_bases/${knowledgeBaseId}/resources/children?${searchParams.toString()}`
  );
}

export async function createKnowledgeBase(body: {
  connection_id: string;
  connection_source_ids: string[];
  name: string;
  description?: string;
  indexing_params: Record<string, unknown>;
  org_level_role?: string | null;
  cron_job_id?: string | null;
  website_sources?: unknown[];
}): Promise<StackKnowledgeBaseDetail> {
  return stackPost('/knowledge_bases', body);
}

export async function updateKnowledgeBase(
  knowledgeBaseId: string,
  body: {
    connection_id: string;
    connection_source_ids: string[];
    name: string;
    description?: string | null;
    indexing_params: Record<string, unknown>;
    website_sources: unknown[];
    org_level_role: string | null;
    cron_job_id: string | null;
  }
): Promise<StackKnowledgeBaseDetail> {
  return stackPut(`/knowledge_bases/${knowledgeBaseId}`, body);
}

export async function triggerKnowledgeBaseSync(
  knowledgeBaseId: string,
  orgId: string
): Promise<void> {
  await stackPost(`/knowledge_bases/sync/trigger/${knowledgeBaseId}/${orgId}`);
}

export async function deleteKnowledgeBaseResource(
  knowledgeBaseId: string,
  resourcePath: string
): Promise<void> {
  const params = new URLSearchParams();
  params.set('resource_path', resourcePath);
  await stackDelete(`/knowledge_bases/${knowledgeBaseId}/resources?${params.toString()}`);
}

export async function fetchOrg(): Promise<OrgResponse> {
  return stackGet('/organizations/me/current');
}
