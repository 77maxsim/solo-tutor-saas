import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

const QUERY_TIMEOUT = 30000;

function fetchWithTimeout(url: string | URL | Request, options: RequestInit = {}): Promise<Response> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(options.signal.reason || new Error('Request was aborted'));
      return;
    }

    const controller = new AbortController();
    let abortedByTimeout = false;
    
    const timeoutId = setTimeout(() => {
      abortedByTimeout = true;
      controller.abort();
    }, QUERY_TIMEOUT);

    if (options.signal) {
      const originalSignal = options.signal;
      originalSignal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        controller.abort();
      });
    }

    fetch(url, { ...options, signal: controller.signal })
      .then(response => {
        clearTimeout(timeoutId);
        resolve(response);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          if (abortedByTimeout) {
            reject(new Error(`Request timeout after ${QUERY_TIMEOUT}ms`));
          } else {
            reject(options.signal?.reason || error);
          }
        } else {
          reject(error);
        }
      });
  });
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'supabase.auth.token'
  },
  global: {
    fetch: fetchWithTimeout,
  }
})