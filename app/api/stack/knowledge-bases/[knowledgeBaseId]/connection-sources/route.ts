import { NextRequest, NextResponse } from 'next/server';
import {
  fetchKnowledgeBase,
  fetchOrg,
  triggerKnowledgeBaseSync,
  updateKnowledgeBase,
} from '@/lib/stack/services';

type Body = {
  resourceId: string;
  action: 'remove';
};

export async function PATCH(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ knowledgeBaseId: string }>;
  }
) {
  const { knowledgeBaseId } = await params;
  const body = (await request.json()) as Body;

  if (!body.resourceId || body.action !== 'remove') {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 });
  }

  const kb = await fetchKnowledgeBase(knowledgeBaseId);
  const org = await fetchOrg();

  const nextSourceIds = kb.connection_source_ids.filter(
    (id) => id !== body.resourceId
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
