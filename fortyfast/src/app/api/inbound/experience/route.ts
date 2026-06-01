import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyExperienceToken } from '@/lib/tokens';

export const dynamic = 'force-dynamic';

/**
 * SendGrid Inbound Parse POSTs multipart/form-data with fields:
 *   to, from, subject, text, html, ...
 * We expect "to" to contain something like "experience+<JWT>@reply.yourdomain.com".
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const to = (form.get('to') as string) || '';
    const text = ((form.get('text') as string) || '').trim();
    const from = (form.get('from') as string) || '';

    const m = to.match(/experience\+([^@]+)@/i);
    if (!m) return NextResponse.json({ ok: false, error: 'No token in to-address' }, { status: 200 });

    const token = m[1];
    const signupId = await verifyExperienceToken(token);
    if (!signupId) return NextResponse.json({ ok: false, error: 'Invalid token' }, { status: 200 });

    const signup = await prisma.signup.findUnique({
      where: { id: signupId },
      include: { participants: true },
    });
    if (!signup) return NextResponse.json({ ok: false, error: 'Signup not found' }, { status: 200 });

    // Strip quoted reply tails (best-effort)
    const cleaned = text
      .split(/^[> ]*On .* wrote:$/m)[0]
      .replace(/^[> ].*$/gm, '')
      .trim();

    if (!cleaned) return NextResponse.json({ ok: true, skipped: 'empty body' });

    await prisma.experience.create({
      data: {
        signupId,
        content: cleaned,
        isAnonymous: false,
        isPublic: false, // requires moderation; admin can flag public on approval
        moderationStatus: 'PENDING',
        source: 'EMAIL_REPLY',
        participantName: signup.participants[0]?.name,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Inbound experience error', err);
    return NextResponse.json({ ok: false, error: err?.message }, { status: 200 });
  }
}
