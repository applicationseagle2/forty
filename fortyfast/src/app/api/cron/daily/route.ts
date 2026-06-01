import { NextRequest, NextResponse } from 'next/server';
import { runDailyJob } from '@/lib/comms';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // up to 5 min on Vercel

export async function GET(req: NextRequest) {
  // Vercel Cron sets the Authorization header to "Bearer ${CRON_SECRET}".
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const result = await runDailyJob();
  return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
}
