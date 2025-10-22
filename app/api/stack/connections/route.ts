import { NextResponse } from 'next/server';
import { fetchConnections } from '@/lib/stack/services';

export async function GET() {
  const connections = await fetchConnections();
  return NextResponse.json(connections);
}
