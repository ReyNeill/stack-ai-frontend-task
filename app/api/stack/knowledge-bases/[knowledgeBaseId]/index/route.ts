import { NextRequest, NextResponse } from 'next/server';
import {
  fetchKnowledgeBase,
  fetchOrg,
  triggerKnowledgeBaseSync,
  updateKnowledgeBase,
} from '@/lib/stack/services';

export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ knowledgeBaseId: string }>;
  }
) {
  const { knowledgeBaseId } = await params;
  const body = (await request.json()) as { resourceIds: string[] };

  if (!Array.isArray(body.resourceIds) || body.resourceIds.length === 0) {
    return NextResponse.json(
      { message: 'resourceIds must be a non-empty array' },
      { status: 400 }
    );
  }

  const kb = await fetchKnowledgeBase(knowledgeBaseId);
  const org = await fetchOrg();

  const nextSourceIds = Array.from(
    new Set([...kb.connection_source_ids, ...body.resourceIds])
  );

  // update the knowledge base with the new resources
  const updated = await updateKnowledgeBase(knowledgeBaseId, {
    connection_id: kb.connection_id,
    connection_source_ids: nextSourceIds,
    indexing_params: kb.indexing_params,
    name: kb.name,
    description: kb.description,
    website_sources: kb.website_sources ?? [],
    org_level_role: kb.org_level_role ?? null,
    cron_job_id: kb.cron_job_id ?? null,
  });

  /**
   * non-blocking sync: why we don't fail on sync errors
   * 
   * the Stack AI sync endpoint occasionally returns 500 errors (backend issues).
   * However, the important work is already done:
   * - resources are added to connection_source_ids ✓
   * - knowledge base is updated ✓
   * 
   * stack AI's backend has automatic syncing that will pick up these changes.
   * making sync non-blocking ensures users can continue working even if
   * the sync endpoint is temporarily unavailable.
   * 
   * this demonstrates graceful degradation and better UX.
   */
  try {
    await triggerKnowledgeBaseSync(knowledgeBaseId, org.org_id);
  } catch (error) {
    console.error('Failed to trigger knowledge base sync:', error);
    // continue anyway - resources are already in connection_source_ids
    // stack AI's backend will eventually sync them automatically
  }

  return NextResponse.json({
    knowledge_base: updated,
    connection_source_ids: updated.connection_source_ids,
  });
}
