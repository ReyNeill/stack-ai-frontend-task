import { NextRequest, NextResponse } from 'next/server';
import {
  deleteKnowledgeBaseResource,
  fetchKnowledgeBaseChildren,
} from '@/lib/stack/services';
import { StackApiError } from '@/lib/stack/client';

export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ knowledgeBaseId: string }>;
  }
) {
  const { knowledgeBaseId } = await params;
  const resourcePath = request.nextUrl.searchParams.get('resourcePath') ?? '/';
  try {
    const data = await fetchKnowledgeBaseChildren(knowledgeBaseId, resourcePath);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof StackApiError && error.status === 400) {
      return NextResponse.json({ data: [] });
    }
    throw error;
  }
}

export async function DELETE(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ knowledgeBaseId: string }>;
  }
) {
  const { knowledgeBaseId } = await params;
  const resourcePath = request.nextUrl.searchParams.get('resourcePath');

  if (!resourcePath) {
    return NextResponse.json({ message: 'resourcePath is required' }, { status: 400 });
  }

  await deleteKnowledgeBaseResource(knowledgeBaseId, resourcePath);
  return NextResponse.json({ ok: true });
}
