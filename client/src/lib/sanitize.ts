import DOMPurify from 'dompurify';
import { useMemo } from 'react';

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [] as string[],
  ALLOWED_ATTR: [] as string[],
  KEEP_CONTENT: true,
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
  RETURN_DOM_IMPORT: false,
};

export function sanitizeText(text: string | null | undefined): string {
  if (!text) return '';
  return DOMPurify.sanitize(text, SANITIZE_CONFIG) as string;
}

export function sanitizeHtml(html: string | null | undefined, allowedTags?: string[]): string {
  if (!html) return '';
  
  const config = allowedTags
    ? {
        ALLOWED_TAGS: allowedTags,
        ALLOWED_ATTR: ['href', 'target', 'rel'],
        KEEP_CONTENT: true,
      }
    : SANITIZE_CONFIG;

  return DOMPurify.sanitize(html, config) as string;
}

export function useSanitizedText(text: string | null | undefined): string {
  return useMemo(() => sanitizeText(text), [text]);
}

export function useSanitizedHtml(html: string | null | undefined, allowedTags?: string[]): string {
  return useMemo(() => sanitizeHtml(html, allowedTags), [html, allowedTags]);
}
