import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase environment validation failed:', {
    VITE_SUPABASE_URL: supabaseUrl ? 'Set' : 'Missing',
    VITE_SUPABASE_ANON_KEY: supabaseAnonKey ? 'Set' : 'Missing',
    urlPreview: supabaseUrl?.substring(0, 30) + '...',
    keyLength: supabaseAnonKey?.length
  });
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

// Validate URL format and security
try {
  const url = new URL(supabaseUrl);
  if (url.protocol !== 'https:') {
    console.warn('⚠️ Supabase URL is not using HTTPS:', url.protocol);
  }
  if (!url.hostname.includes('supabase')) {
    console.warn('⚠️ URL does not appear to be a Supabase domain:', url.hostname);
  }
  console.log('✅ Supabase URL validation passed:', {
    protocol: url.protocol,
    hostname: url.hostname.substring(0, 20) + '...',
    isHTTPS: url.protocol === 'https:'
  });
} catch (error) {
  console.error('❌ Invalid Supabase URL format:', error.message);
  throw new Error('Invalid Supabase URL format');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // Don't persist auth for public pages
    autoRefreshToken: false,
  },
  global: {
    headers: {
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    },
  },
});