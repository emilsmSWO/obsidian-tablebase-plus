export const DEFAULT_DATETIME_FORMAT = "YYYY-MM-DD HH:mm";

interface DatetimeFormatDescriptor {
  format: string;
  label: string;
}

// A format is any text built from these tokens ("HH" and "hh" are both 24-hour),
// so a date-only or time-only column is just a format without the other half.
export const DATETIME_FORMAT_OPTIONS: DatetimeFormatDescriptor[] = [
  { format: "YYYY-MM-DD HH:mm", label: "YYYY-MM-DD HH:mm" },
  { format: "YYYY-MM-DD HH:mm:ss", label: "YYYY-MM-DD HH:mm:ss" },
  { format: "DD.MM.YYYY HH:mm", label: "DD.MM.YYYY HH:mm" },
  { format: "DD/MM/YYYY HH:mm", label: "DD/MM/YYYY HH:mm" },
  { format: "MM/DD/YYYY HH:mm", label: "MM/DD/YYYY HH:mm" },
  { format: "YYYY-MM-DDTHH:mm:ss", label: "YYYY-MM-DDTHH:mm:ss (ISO)" },
  { format: "YYYY-MM-DD", label: "YYYY-MM-DD (date only)" },
  { format: "DD.MM.YYYY", label: "DD.MM.YYYY (date only)" },
  { format: "HH:mm", label: "HH:mm (time only)" },
  { format: "HH:mm:ss", label: "HH:mm:ss (time only)" },
];

const TOKEN = /YYYY|MM|DD|HH|hh|mm|ss/g;

/** Tells a datetime format apart from other header parameters such as "sum" or "w=300". */
function isDatetimeFormat(param: string): boolean {
  return /YYYY|MM|DD|HH|hh|mm|ss/.test(param) && !/[\]|]/.test(param);
}

const AUTOUPDATE_PARAM = "autoupdate";

/** Reads the format and the "autoupdate" flag out of "[datetime:FORMAT,autoupdate,...]". */
export function parseDatetimeParams(params: string | undefined): {
  format?: string;
  autoUpdate: boolean;
} {
  let format: string | undefined;
  let autoUpdate = false;
  for (const param of (params ?? "").split(",")) {
    const value = param.trim();
    if (value.toLowerCase() === AUTOUPDATE_PARAM) autoUpdate = true;
    else if (isDatetimeFormat(value)) format = value;
  }
  return { format, autoUpdate };
}

export function hasDatePart(format: string): boolean {
  return /YYYY|MM|DD/.test(format);
}

export function hasTimePart(format: string): boolean {
  return /HH|hh|mm|ss/.test(format);
}

const pad = (value: number, length = 2): string => String(value).padStart(length, "0");

export function formatDatetime(date: Date, format: string = DEFAULT_DATETIME_FORMAT): string {
  if (!date || isNaN(date.getTime())) return "";
  return format.replace(TOKEN, (token) => {
    switch (token) {
      case "YYYY":
        return pad(date.getFullYear(), 4);
      case "MM":
        return pad(date.getMonth() + 1);
      case "DD":
        return pad(date.getDate());
      case "mm":
        return pad(date.getMinutes());
      case "ss":
        return pad(date.getSeconds());
      default:
        return pad(date.getHours());
    }
  });
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\/-]/g, "\\$&");

/**
 * Parses a value written in `format`. Parts the format leaves out default to
 * 1970-01-01 and 00:00:00, which keeps time-only values sortable.
 */
export function parseDatetime(str: string, format: string = DEFAULT_DATETIME_FORMAT): Date | null {
  const value = (str ?? "").trim();
  if (!value) return null;

  const tokens: string[] = [];
  let source = "";
  let last = 0;
  for (const match of format.matchAll(TOKEN)) {
    source += escapeRegExp(format.slice(last, match.index));
    source += match[0] === "YYYY" ? "(\\d{4})" : "(\\d{1,2})";
    tokens.push(match[0]);
    last = (match.index ?? 0) + match[0].length;
  }
  source += escapeRegExp(format.slice(last));
  if (tokens.length === 0) return null;

  const found = new RegExp(`^${source}$`).exec(value);
  if (!found) return null;

  const part = { YYYY: 1970, MM: 1, DD: 1, HH: 0, mm: 0, ss: 0 };
  tokens.forEach((token, i) => {
    part[token === "hh" ? "HH" : (token as keyof typeof part)] = Number(found[i + 1]);
  });

  const date = new Date(part.YYYY, part.MM - 1, part.DD, part.HH, part.mm, part.ss);
  const valid =
    date.getFullYear() === part.YYYY &&
    date.getMonth() === part.MM - 1 &&
    date.getDate() === part.DD &&
    date.getHours() === part.HH &&
    date.getMinutes() === part.mm &&
    date.getSeconds() === part.ss;
  return valid ? date : null;
}

export function compareDatetimeStrings(a: string, b: string, format?: string): number {
  const dateA = parseDatetime(a, format);
  const dateB = parseDatetime(b, format);
  if (!dateA && !dateB) return a.localeCompare(b);
  if (!dateA) return 1;
  if (!dateB) return -1;
  return dateA.getTime() - dateB.getTime();
}

/** Re-renders a stored value in `format` (padding, etc.); unparseable text is returned untouched. */
export function normalizeDatetime(value: string, format?: string): string {
  const parsed = parseDatetime(value, format);
  return parsed ? formatDatetime(parsed, format) : value;
}
