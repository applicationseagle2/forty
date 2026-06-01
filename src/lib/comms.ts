import { prisma } from './prisma';
import { sendEmail, baseTemplate, experienceReplyTo } from './email';
import { sendSmsForWard } from './sms';
import { renderTemplate, type MergeContext } from './merge';
import { dateForDayNumber, endDate, todayInTz, isoDate, formatInWardTz, FAST_LENGTH } from './dates';
import { differenceInCalendarDays } from 'date-fns';
import { signExperienceToken } from './tokens';

const APP_URL = () => process.env.APP_URL || 'http://localhost:3000';

function magicLinkFor(token: string): string {
  return `${APP_URL()}/m/${token}`;
}

function buildContextForParticipant(signup: any, participant: any): MergeContext {
  const fast = signup.fast;
  const ward = fast.ward;
  return {
    firstName: participant.name.split(' ')[0],
    fullName: participant.name,
    fastDate: dateForDayNumber(fast.startDate, signup.dayNumber),
    dayNumber: signup.dayNumber,
    daysUntil: undefined, // filled in at send time
    wardName: ward.name,
    stakeName: ward.stake?.name,
    fastName: fast.name,
    fastPurpose: fast.purpose,
    startDate: fast.startDate,
    endDate: endDate(fast.startDate),
    magicLink: magicLinkFor(signup.magicToken),
    otherParticipantsOnDay: signup.participants
      .filter((p: any) => p.id !== participant.id)
      .map((p: any) => p.name)
      .join(', '),
    wardTz: ward.timezone,
  };
}

// ============== Confirmation on signup ==============

export async function sendConfirmation(signupId: string): Promise<void> {
  const signup = await prisma.signup.findUnique({
    where: { id: signupId },
    include: { fast: { include: { ward: { include: { stake: true } } } }, participants: true },
  });
  if (!signup) return;
  const dateStr = formatInWardTz(
    dateForDayNumber(signup.fast.startDate, signup.dayNumber),
    signup.fast.ward.timezone,
    'EEEE, MMMM d, yyyy'
  );
  const magicLink = magicLinkFor(signup.magicToken);

  for (const p of signup.participants) {
    const ctx = buildContextForParticipant(signup, p);

    if (p.email && p.emailOptIn) {
      const html = baseTemplate(`
        <p style="font-family:Georgia,serif;color:#6B5F52;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;">${signup.fast.ward.name}</p>
        <h1 style="font-family:Georgia,serif;font-weight:400;color:#1A1612;font-size:28px;margin:12px 0 24px;">${signup.fast.name}</h1>
        <p>${ctx.firstName}, thank you for committing to fast on:</p>
        <p style="font-family:Georgia,serif;font-size:22px;color:#4A5B36;margin:16px 0;">${dateStr}</p>
        <p>${signup.fast.purpose}</p>
        <p style="margin-top:32px;">
          <a href="${magicLink}" style="display:inline-block;padding:14px 24px;background:#4A5B36;color:#FBF8F3;text-decoration:none;border-radius:4px;">Manage my signup</a>
        </p>
        <p style="color:#6B5F52;font-size:13px;">Save this link — it's how you'll edit your details or share what you experienced.</p>
      `);
      await sendAndLog({
        signupId: signup.id,
        channel: 'EMAIL',
        to: { email: p.email },
        subject: `Your fast day: ${dateStr}`,
        body: html,
      });
    }

    if (p.phone && p.smsOptIn) {
      const body = `${signup.fast.ward.name}: You're signed up to fast on ${dateStr}. Manage: ${magicLink}`;
      await sendAndLog({
        signupId: signup.id,
        wardId: signup.fast.wardId,
        channel: 'SMS',
        to: { phone: p.phone },
        body,
      });
    }
  }
}

// ============== Generic send + log ==============

type SendArgs = {
  signupId?: string;
  wardId?: string; // required for SMS
  channel: 'EMAIL' | 'SMS';
  to: { email?: string; phone?: string };
  subject?: string;
  body: string;
  replyTo?: string;
  broadcastReminderId?: string;
  individualReminderId?: string;
  experienceFollowUpId?: string;
};

async function sendAndLog(args: SendArgs): Promise<void> {
  const log = await prisma.messageLog.create({
    data: {
      signupId: args.signupId,
      channel: args.channel,
      participantEmail: args.to.email,
      participantPhone: args.to.phone,
      subject: args.subject,
      body: args.body,
      status: 'PENDING',
      broadcastReminderId: args.broadcastReminderId,
      individualReminderId: args.individualReminderId,
      experienceFollowUpId: args.experienceFollowUpId,
    },
  });
  try {
    if (args.channel === 'EMAIL' && args.to.email) {
      await sendEmail({
        to: args.to.email,
        subject: args.subject || '',
        html: args.body,
        replyTo: args.replyTo,
      });
    } else if (args.channel === 'SMS' && args.to.phone && args.wardId) {
      const r = await sendSmsForWard(args.wardId, args.to.phone, args.body);
      if (!r.ok) throw new Error(r.error);
    } else {
      throw new Error('Missing recipient or ward');
    }
    await prisma.messageLog.update({
      where: { id: log.id },
      data: { status: 'SENT', sentAt: new Date() },
    });
  } catch (err: any) {
    await prisma.messageLog.update({
      where: { id: log.id },
      data: { status: 'FAILED', error: err?.message ?? 'Unknown' },
    });
  }
}

// ============== Cron entry point ==============

export async function runDailyJob(): Promise<{
  broadcasts: number;
  individuals: number;
  followUps: number;
  unclaimedAlerts: number;
}> {
  let broadcasts = 0;
  let individuals = 0;
  let followUps = 0;
  let unclaimedAlerts = 0;

  const activeFasts = await prisma.fast.findMany({
    where: { status: 'ACTIVE' },
    include: {
      ward: { include: { stake: true } },
      broadcastReminders: true,
      individualReminders: true,
      experienceFollowUps: true,
      signups: { include: { participants: true } },
    },
  });

  for (const fast of activeFasts) {
    const todayInWard = todayInTz(fast.ward.timezone);
    const fastStart = todayInTz(fast.ward.timezone); // baseline; will compare via diff
    const daysSinceStart = differenceInCalendarDays(todayInWard, fast.startDate);

    // ===== Broadcast reminders =====
    for (const br of fast.broadcastReminders) {
      if (br.sentAt) continue;
      if (br.daysOffset !== daysSinceStart) continue;
      for (const signup of fast.signups) {
        for (const p of signup.participants) {
          const ctx = buildContextForParticipant({ ...signup, fast }, p);
          await dispatchToParticipant({
            channels: br.channels,
            participant: p,
            ctx,
            template: br.template,
            subject: br.subject || undefined,
            wardId: fast.wardId,
            signupId: signup.id,
            broadcastReminderId: br.id,
          });
        }
      }
      await prisma.broadcastReminder.update({ where: { id: br.id }, data: { sentAt: new Date() } });
      broadcasts++;
    }

    // ===== Individual reminders =====
    for (const ir of fast.individualReminders) {
      // For each signup, check whether today equals their fast date + offset
      for (const signup of fast.signups) {
        const theirDate = dateForDayNumber(fast.startDate, signup.dayNumber);
        const diff = differenceInCalendarDays(todayInWard, theirDate);
        if (diff !== ir.daysOffset) continue;
        for (const p of signup.participants) {
          const ctx = buildContextForParticipant({ ...signup, fast }, p);
          ctx.daysUntil = Math.max(0, -ir.daysOffset);
          await dispatchToParticipant({
            channels: ir.channels,
            participant: p,
            ctx,
            template: ir.template,
            subject: ir.subject || undefined,
            wardId: fast.wardId,
            signupId: signup.id,
            individualReminderId: ir.id,
          });
          individuals++;
        }
      }
    }

    // ===== Experience follow-ups =====
    for (const ef of fast.experienceFollowUps) {
      for (const signup of fast.signups) {
        const theirDate = dateForDayNumber(fast.startDate, signup.dayNumber);
        const diff = differenceInCalendarDays(todayInWard, theirDate);
        if (diff !== ef.daysOffset) continue;
        for (const p of signup.participants) {
          const ctx = buildContextForParticipant({ ...signup, fast }, p);
          // Personalize reply-to for email so inbound parse can resolve back to signup
          const replyToken = await signExperienceToken(signup.id);
          const replyTo = experienceReplyTo(replyToken);
          await dispatchToParticipant({
            channels: ef.channels,
            participant: p,
            ctx,
            template: ef.template,
            subject: ef.subject || undefined,
            wardId: fast.wardId,
            signupId: signup.id,
            experienceFollowUpId: ef.id,
            replyTo,
          });
          followUps++;
        }
      }
    }

    // ===== Unclaimed-day alerts =====
    // Within the 40-day window, find days within 7 days from now with no primary signup.
    const claimedDays = new Set(fast.signups.filter((s) => s.isPrimary).map((s) => s.dayNumber));
    for (let d = 1; d <= FAST_LENGTH; d++) {
      const theirDate = dateForDayNumber(fast.startDate, d);
      const daysAway = differenceInCalendarDays(theirDate, todayInWard);
      if (daysAway === 7 && !claimedDays.has(d)) {
        // Send a single notice to the ward signup list. Implementation: mark with a sentinel via a separate
        // broadcast-style approach. For MVP we just email all ward admins.
        const admins = await prisma.adminUser.findMany({
          where: {
            OR: [
              { wardId: fast.wardId, role: 'WARD_ADMIN' },
              { stakeId: fast.ward.stakeId, role: 'STAKE_ADMIN' },
            ],
          },
        });
        for (const a of admins) {
          await sendAndLog({
            channel: 'EMAIL',
            to: { email: a.email },
            subject: `Day ${d} of "${fast.name}" is still open`,
            body: baseTemplate(`
              <p>Day ${d} (${formatInWardTz(theirDate, fast.ward.timezone)}) of the fast "${fast.name}" has no primary signup yet — it's 7 days away.</p>
              <p>Consider a quick broadcast to your ward to invite someone to claim it.</p>
              <p><a href="${APP_URL()}/admin/fasts/${fast.id}">Open in admin →</a></p>
            `),
          });
        }
        unclaimedAlerts++;
      }
    }

    // ===== Auto-complete fast =====
    if (daysSinceStart >= FAST_LENGTH) {
      await prisma.fast.update({ where: { id: fast.id }, data: { status: 'COMPLETED' } });
    }
  }

  return { broadcasts, individuals, followUps, unclaimedAlerts };
}

async function dispatchToParticipant(args: {
  channels: 'EMAIL' | 'SMS' | 'BOTH';
  participant: any;
  ctx: MergeContext;
  template: string;
  subject?: string;
  wardId: string;
  signupId: string;
  replyTo?: string;
  broadcastReminderId?: string;
  individualReminderId?: string;
  experienceFollowUpId?: string;
}): Promise<void> {
  const rendered = renderTemplate(args.template, args.ctx);
  const subject = args.subject ? renderTemplate(args.subject, args.ctx) : undefined;

  const wantEmail = args.channels === 'EMAIL' || args.channels === 'BOTH';
  const wantSms = args.channels === 'SMS' || args.channels === 'BOTH';

  if (wantEmail && args.participant.email && args.participant.emailOptIn) {
    const html = baseTemplate(`<div style="white-space:pre-wrap">${escapeHtml(rendered)}</div>`);
    await sendAndLog({
      signupId: args.signupId,
      channel: 'EMAIL',
      to: { email: args.participant.email },
      subject,
      body: html,
      replyTo: args.replyTo,
      broadcastReminderId: args.broadcastReminderId,
      individualReminderId: args.individualReminderId,
      experienceFollowUpId: args.experienceFollowUpId,
    });
  }
  if (wantSms && args.participant.phone && args.participant.smsOptIn) {
    await sendAndLog({
      signupId: args.signupId,
      wardId: args.wardId,
      channel: 'SMS',
      to: { phone: args.participant.phone },
      body: rendered,
      broadcastReminderId: args.broadcastReminderId,
      individualReminderId: args.individualReminderId,
      experienceFollowUpId: args.experienceFollowUpId,
    });
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
