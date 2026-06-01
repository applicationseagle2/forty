import { requireAdmin, canManageWard } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/crypto';
import { testWardSms } from '@/lib/sms';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

async function saveTwilio(formData: FormData) {
  'use server';
  const user = await requireAdmin();
  const wardId = formData.get('wardId') as string;
  if (!(await canManageWard(user, wardId))) throw new Error('Forbidden');

  const sid = (formData.get('accountSid') as string)?.trim();
  const token = (formData.get('authToken') as string)?.trim();
  const from = (formData.get('fromNumber') as string)?.trim();
  if (!sid || !from) throw new Error('Account SID and From number required');

  const data: any = {
    twilioAccountSid: sid,
    twilioFromNumber: from,
  };
  if (token) data.twilioAuthTokenEnc = encrypt(token);

  await prisma.ward.update({ where: { id: wardId }, data });
  revalidatePath(`/admin/wards/${wardId}/twilio`);
}

async function sendTestSms(formData: FormData) {
  'use server';
  const user = await requireAdmin();
  const wardId = formData.get('wardId') as string;
  const phone = (formData.get('phone') as string)?.trim();
  if (!(await canManageWard(user, wardId))) throw new Error('Forbidden');
  if (!phone) throw new Error('Phone required');
  const r = await testWardSms(wardId, phone);
  if (!r.ok) throw new Error(r.error || 'Send failed');
}

export default async function TwilioSetupPage({ params }: { params: { id: string } }) {
  const user = await requireAdmin();
  if (!(await canManageWard(user, params.id))) redirect('/admin');

  const ward = await prisma.ward.findUnique({ where: { id: params.id } });
  if (!ward) notFound();

  const configured = !!(ward.twilioAccountSid && ward.twilioAuthTokenEnc && ward.twilioFromNumber);

  return (
    <div className="max-w-xl space-y-10">
      <div>
        <Link href={`/admin/wards/${ward.id}`} className="btn-ghost text-sm mb-4">← {ward.name}</Link>
        <p className="display-eyebrow mb-3">SMS setup</p>
        <h1 className="display-h2 mb-3">Twilio for this ward.</h1>
        <p className="text-ink-700">
          Create a Twilio account at twilio.com, buy a phone number, and paste the credentials below.
          Your Auth Token is encrypted at rest.
        </p>
      </div>

      <form action={saveTwilio} className="space-y-4 card p-6">
        <input type="hidden" name="wardId" value={ward.id} />
        <div>
          <label className="label">Account SID</label>
          <input name="accountSid" defaultValue={ward.twilioAccountSid ?? ''} required className="input" placeholder="AC..." />
        </div>
        <div>
          <label className="label">Auth Token {configured && <span className="text-ink-500 font-normal">(leave blank to keep existing)</span>}</label>
          <input name="authToken" type="password" className="input" placeholder={configured ? '••••••••' : ''} />
        </div>
        <div>
          <label className="label">From Number</label>
          <input name="fromNumber" defaultValue={ward.twilioFromNumber ?? ''} required className="input" placeholder="+12085551234" />
        </div>
        <button type="submit" className="btn-primary">Save</button>
      </form>

      {configured && (
        <form action={sendTestSms} className="space-y-4 card p-6">
          <input type="hidden" name="wardId" value={ward.id} />
          <h2 className="font-display text-xl tracking-tightest">Send a test message</h2>
          <div>
            <label className="label">Your phone</label>
            <input name="phone" required className="input" placeholder="+12085551234" />
          </div>
          <button type="submit" className="btn-secondary">Send test SMS</button>
        </form>
      )}
    </div>
  );
}
