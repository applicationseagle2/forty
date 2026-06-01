import { formatInWardTz, isoDate } from './dates';

export type MergeContext = {
  firstName?: string;
  fullName?: string;
  fastDate?: Date; // participant's individual fast date
  dayNumber?: number;
  daysUntil?: number;
  wardName?: string;
  stakeName?: string;
  fastName?: string;
  fastPurpose?: string;
  startDate?: Date;
  endDate?: Date;
  magicLink?: string;
  otherParticipantsOnDay?: string;
  wardTz?: string;
};

const FIELDS = [
  'firstName', 'fullName', 'fastDate', 'dayNumber', 'daysUntil',
  'wardName', 'stakeName', 'fastName', 'fastPurpose',
  'startDate', 'endDate', 'magicLink', 'otherParticipantsOnDay',
] as const;

export const AVAILABLE_MERGE_FIELDS = FIELDS;

export function renderTemplate(template: string, ctx: MergeContext): string {
  const tz = ctx.wardTz || 'America/Boise';
  const repl = (key: string): string => {
    switch (key) {
      case 'firstName': return ctx.firstName ?? '';
      case 'fullName': return ctx.fullName ?? '';
      case 'fastDate': return ctx.fastDate ? formatInWardTz(ctx.fastDate, tz) : '';
      case 'dayNumber': return ctx.dayNumber?.toString() ?? '';
      case 'daysUntil': return ctx.daysUntil?.toString() ?? '';
      case 'wardName': return ctx.wardName ?? '';
      case 'stakeName': return ctx.stakeName ?? '';
      case 'fastName': return ctx.fastName ?? '';
      case 'fastPurpose': return ctx.fastPurpose ?? '';
      case 'startDate': return ctx.startDate ? formatInWardTz(ctx.startDate, tz) : '';
      case 'endDate': return ctx.endDate ? formatInWardTz(ctx.endDate, tz) : '';
      case 'magicLink': return ctx.magicLink ?? '';
      case 'otherParticipantsOnDay': return ctx.otherParticipantsOnDay ?? '';
      default: return '';
    }
  };
  return template.replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (_m, key) => repl(key));
}
