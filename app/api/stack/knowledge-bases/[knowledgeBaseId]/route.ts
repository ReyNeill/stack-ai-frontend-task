import { NextRequest, NextResponse } from 'next/server';
import { fetchKnowledgeBase, updateKnowledgeBase } from '@/lib/stack/services';

export async function GET(
  _request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ knowledgeBaseId: string }>;
  }
) {
  const { knowledgeBaseId } = await params;
  const kb = await fetchKnowledgeBase(knowledgeBaseId);
  return NextResponse.json(kb);
}

export async function PUT(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ knowledgeBaseId: string }>;
  }
) {
  const { knowledgeBaseId } = await params;
  const body = await request.json();
  const kb = await updateKnowledgeBase(knowledgeBaseId, body);
  return NextResponse.json(kb);
}
