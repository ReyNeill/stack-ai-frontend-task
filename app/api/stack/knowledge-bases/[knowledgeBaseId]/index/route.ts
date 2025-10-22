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

  await triggerKnowledgeBaseSync(knowledgeBaseId, org.org_id);

  return NextResponse.json({
    knowledge_base: updated,
    connection_source_ids: updated.connection_source_ids,
  });
}
