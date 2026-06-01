import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

export const FAST_LENGTH = 40;

/** Returns the calendar date (YYYY-MM-DD) for a given day number (1..40) given a fast start. */
export function dateForDayNumber(startDate: Date, dayNumber: number): Date {
  return addDays(startDate, dayNumber - 1);
}

/** Returns 1..40 if the date falls within the fast, else null. */
export function dayNumberForDate(startDate: Date, date: Date): number | null {
  const diff = differenceInCalendarDays(date, startDate);
  if (diff < 0 || diff >= FAST_LENGTH) return null;
  return diff + 1;
}

export function endDate(startDate: Date): Date {
  return addDays(startDate, FAST_LENGTH - 1);
}

/** Today as a Date representing midnight in the given IANA timezone. */
export function todayInTz(tz: string): Date {
  const nowInTz = toZonedTime(new Date(), tz);
  nowInTz.setHours(0, 0, 0, 0);
  return nowInTz;
}

export function formatDate(date: Date, fmt = 'EEEE, MMMM d, yyyy'): string {
  return format(date, fmt);
}

export function formatInWardTz(date: Date, tz: string, fmt = 'EEEE, MMMM d, yyyy'): string {
  return formatInTimeZone(date, tz, fmt);
}

export function isoDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function fromIsoDate(iso: string): Date {
  return parseISO(iso);
}
