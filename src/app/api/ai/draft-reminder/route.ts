import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/authz';
import { draftMessage } from '@/lib/ai';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const schema = z.object({
  reminderType: z.enum(['broadcast', 'individual', 'experienceFollowUp']),
  fastName: z.string().min(1),
  fastPurpose: z.string().min(1),
  wardName: z.string().min(1),
  daysOffset: z.number().int(),
  tone: z.string().optional(),
  channel: z.enum(['EMAIL', 'SMS', 'BOTH']),
});

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const args = schema.parse(body);
    const draft = await draftMessage(args);
    return NextResponse.json(draft);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Draft failed' }, { status: 400 });
  }
}
