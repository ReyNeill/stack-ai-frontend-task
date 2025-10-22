import { NextRequest, NextResponse } from 'next/server';
import { fetchConnectionChildren } from '@/lib/stack/services';

export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ connectionId: string }>;
  }
) {
  const { connectionId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const resourceId = searchParams.get('resourceId') ?? undefined;

  const data = await fetchConnectionChildren(connectionId, resourceId);
  return NextResponse.json(data);
}
