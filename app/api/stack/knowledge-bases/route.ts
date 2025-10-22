import { NextRequest, NextResponse } from 'next/server';
import { createKnowledgeBase, fetchKnowledgeBases } from '@/lib/stack/services';

export async function GET() {
  const knowledgeBases = await fetchKnowledgeBases();
  return NextResponse.json(knowledgeBases);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const knowledgeBase = await createKnowledgeBase(body);
  return NextResponse.json(knowledgeBase, { status: 201 });
}
