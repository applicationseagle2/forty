import twilio from 'twilio';
import { prisma } from './prisma';
import { decrypt } from './crypto';

export async function sendSmsForWard(
  wardId: string,
  toPhone: string,
  body: string
): Promise<{ ok: true; sid: string } | { ok: false; error: string }> {
  const ward = await prisma.ward.findUnique({ where: { id: wardId } });
  if (!ward?.twilioAccountSid || !ward?.twilioAuthTokenEnc || !ward?.twilioFromNumber) {
    return { ok: false, error: 'Ward Twilio not configured' };
  }
  try {
    const token = decrypt(ward.twilioAuthTokenEnc);
    const client = twilio(ward.twilioAccountSid, token);
    const msg = await client.messages.create({
      to: toPhone,
      from: ward.twilioFromNumber,
      body,
    });
    return { ok: true, sid: msg.sid };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'Unknown Twilio error' };
  }
}

export async function testWardSms(wardId: string, toPhone: string): Promise<{ ok: boolean; error?: string }> {
  const result = await sendSmsForWard(wardId, toPhone, '40-Day Fast: SMS is configured correctly. Reply STOP to opt out.');
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}
