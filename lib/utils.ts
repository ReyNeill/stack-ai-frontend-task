import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes?: number): string {
  if (!bytes || Number.isNaN(bytes)) {
    return '—';
  }

  const thresholds = [
    { unit: 'GB', value: 1024 ** 3 },
    { unit: 'MB', value: 1024 ** 2 },
    { unit: 'KB', value: 1024 },
  ];

  for (const { unit, value } of thresholds) {
    if (bytes >= value) {
      return `${(bytes / value).toFixed(1)} ${unit}`;
    }
  }

  return `${bytes} B`;
}

export function formatDate(input?: string): string {
  if (!input) {
    return '—';
  }

  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
