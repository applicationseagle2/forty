import Anthropic from '@anthropic-ai/sdk';
import { AVAILABLE_MERGE_FIELDS } from './merge';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type DraftArgs = {
  reminderType: 'broadcast' | 'individual' | 'experienceFollowUp';
  fastPurpose: string;
  fastName: string;
  wardName: string;
  daysOffset: number; // for individual: -3, 0, +1, etc; for broadcast: relative to start
  tone?: string; // user-supplied tone like "warm and encouraging"
  channel: 'EMAIL' | 'SMS' | 'BOTH';
};

export async function draftMessage(args: DraftArgs): Promise<{ subject?: string; body: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      subject: 'Reminder',
      body: '[AI drafting disabled — ANTHROPIC_API_KEY not configured]',
    };
  }

  const fields = AVAILABLE_MERGE_FIELDS.map((f) => `{{${f}}}`).join(', ');
  const offsetDesc =
    args.reminderType === 'individual'
      ? args.daysOffset < 0
        ? `${Math.abs(args.daysOffset)} days before the participant's fast day`
        : args.daysOffset === 0
          ? `on the morning of the participant's fast day`
          : `${args.daysOffset} days after the participant's fast day`
      : args.daysOffset < 0
        ? `${Math.abs(args.daysOffset)} days before the fast begins`
        : `${args.daysOffset} days after the fast begins (day ${args.daysOffset + 1} of 40)`;

  const channelDesc =
    args.channel === 'SMS' ? 'an SMS text (keep under 320 characters, no subject line)' :
    args.channel === 'EMAIL' ? 'an email (provide a subject and a body, body 100–250 words)' :
    'an email and SMS pair (provide subject, email body 100–250 words, and a shorter SMS version under 320 characters)';

  const prompt = `You are helping a Ward Admin in a 40-day congregational fast craft a message to participants.

Context:
- Fast name: ${args.fastName}
- Fast purpose: ${args.fastPurpose}
- Ward: ${args.wardName}
- Timing: this message goes out ${offsetDesc}
- Tone: ${args.tone || 'warm, sincere, encouraging, faith-affirming but not preachy'}
- Format: ${channelDesc}

Available merge fields you may include in the message: ${fields}. Use {{firstName}} at minimum so the message feels personal. Always include {{magicLink}} if it's an email so participants can manage their signup or share an experience.

Return your draft as JSON only, in this exact shape:
{ "subject": "...", "body": "..." }

For SMS-only, set "subject" to null. Do not include any prose outside the JSON.`;

  const resp = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = resp.content
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('');

  // Extract JSON
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    return { body: text.trim() };
  }
  try {
    const parsed = JSON.parse(match[0]);
    return { subject: parsed.subject ?? undefined, body: parsed.body ?? '' };
  } catch {
    return { body: text.trim() };
  }
}
