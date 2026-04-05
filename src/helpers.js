export const NEWSLETTER_TIMEZONE = 'America/Chicago';
const ISSUE_BASE_DATE = '2025-01-01';

function getDateParts(date, timeZone = NEWSLETTER_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: values.year,
    month: values.month,
    day: values.day,
  };
}

function toUtcDate(dateString) {
  return new Date(`${dateString}T00:00:00Z`);
}

export function formatISODate(date = new Date(), timeZone = NEWSLETTER_TIMEZONE) {
  const { year, month, day } = getDateParts(date, timeZone);
  return `${year}-${month}-${day}`;
}

export function formatDisplayDate(date = new Date(), timeZone = NEWSLETTER_TIMEZONE) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function computeIssueNumber(dateString) {
  const start = toUtcDate(ISSUE_BASE_DATE);
  const target = toUtcDate(dateString);

  if (target < start) return 1;

  let businessDays = 0;
  for (const cursor = new Date(start); cursor <= target; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) businessDays += 1;
  }

  return businessDays + 1;
}

export function formatCompactCurrency(value, digits = 2) {
  if (!Number.isFinite(value)) return 'N/A';

  const abs = Math.abs(value);
  const units = [
    { value: 1e12, suffix: 'T' },
    { value: 1e9, suffix: 'B' },
    { value: 1e6, suffix: 'M' },
    { value: 1e3, suffix: 'K' },
  ];

  for (const unit of units) {
    if (abs >= unit.value) {
      const formatted = (value / unit.value).toFixed(digits).replace(/\.0+$|(\.\d*[1-9])0+$/, '$1');
      return `$${formatted}${unit.suffix}`;
    }
  }

  return formatCurrency(value, 0);
}

export function formatCurrency(value, digits = 0) {
  if (!Number.isFinite(value)) return 'N/A';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatPercent(value, digits = 1) {
  if (!Number.isFinite(value)) return 'N/A';
  return `${value.toFixed(digits)}%`;
}

export function formatSignedPercent(value, digits = 1) {
  if (!Number.isFinite(value)) return 'N/A';
  const sign = value > 0 ? '+' : value < 0 ? '' : '';
  return `${sign}${value.toFixed(digits)}%`;
}

export function directionFromChange(value, flatThreshold = 0.5) {
  if (!Number.isFinite(value) || Math.abs(value) < flatThreshold) return 'flat';
  return value > 0 ? 'up' : 'down';
}

export function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function truncateText(value, maxLength = 280) {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}
