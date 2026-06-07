export const toISO = (d: Date): string => {
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Returns Infinity for missing/invalid dates so undefined dueDate tasks are
// never treated as urgent (NaN comparisons in sort/filter are undefined behaviour).
export const daysUntil = (iso?: string): number => {
  if (!iso) return Infinity;
  const ms = new Date(iso + 'T23:59:59').getTime();
  if (isNaN(ms)) return Infinity;
  return Math.ceil((ms - Date.now()) / 86400000);
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const occursOnISO = (event: any, iso: string): boolean => {
  if (!ISO_DATE_RE.test(iso) || !ISO_DATE_RE.test(event?.date ?? '')) return false;
  if (iso < event.date) return false;
  if (event.recurrenceEndDate && iso > event.recurrenceEndDate) return false;
  switch (event.recurrence) {
    case 'none':    return iso === event.date;
    case 'daily':   return true;
    case 'weekly': {
      const diff = Math.round(
        (new Date(iso + 'T12:00:00').getTime() - new Date(event.date + 'T12:00:00').getTime()) / 86400000,
      );
      return diff % 7 === 0;
    }
    case 'monthly': return iso.slice(8) === event.date.slice(8);
    case 'yearly':  return iso.slice(5) === event.date.slice(5);
    default:        return false;
  }
};

// Returns null when the password is valid, or a Hebrew error message string.
export const validatePassword = (p: string): string | null => {
  if (p.length < 8)             return 'הסיסמה חייבת להכיל לפחות 8 תווים';
  if (!/[A-Z]/.test(p))         return 'הסיסמה חייבת להכיל לפחות אות גדולה אחת (A–Z)';
  if (/[֐-׿יִ-ﭏ]/.test(p))   return 'הסיסמה יכולה להכיל תווים לועזיים בלבד';
  return null;
};

export const hexToRgba = (hex: string, a: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
};
