import { useMutation } from "@tanstack/react-query";

interface SyncSessionParams {
  sessionId: number | string;
}

interface DeleteSyncParams {
  eventId: string;
}

/**
 * Hook to sync a session to Google Calendar (create or update)
 * Non-blocking: failures won't affect session operations
 */
export function useSyncSessionToCalendar() {
  return useMutation({
    mutationFn: async ({ sessionId }: SyncSessionParams) => {
      try {
        const response = await fetch('/api/google-calendar/sync-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });

        if (!response.ok) {
          console.warn('Google Calendar sync failed (non-blocking)');
          return null;
        }

        return response.json();
      } catch (error) {
        console.warn('Google Calendar sync error (non-blocking):', error);
        return null;
      }
    },
    // Silent failures - we don't want to show errors for optional sync
    onError: (error) => {
      console.warn('Google Calendar sync error:', error);
    },
  });
}

/**
 * Hook to delete a Google Calendar event
 * Non-blocking: failures won't affect session deletion
 */
export function useDeleteCalendarEvent() {
  return useMutation({
    mutationFn: async ({ eventId }: DeleteSyncParams) => {
      try {
        const response = await fetch(`/api/google-calendar/sync-session/${eventId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          console.warn('Google Calendar event deletion failed (non-blocking)');
          return null;
        }

        return response.json();
      } catch (error) {
        console.warn('Google Calendar deletion error (non-blocking):', error);
        return null;
      }
    },
    // Silent failures
    onError: (error) => {
      console.warn('Google Calendar deletion error:', error);
    },
  });
}

/**
 * Helper to trigger sync after session operations
 * Usage: Call this after successfully creating/updating a session in Supabase
 */
export async function triggerCalendarSync(sessionId: number | string) {
  try {
    const response = await fetch('/api/google-calendar/sync-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });

    if (response.ok) {
      console.log('✓ Google Calendar synced');
    }
  } catch (error) {
    // Silent failure - don't interrupt session operations
    console.warn('Google Calendar sync failed (non-blocking):', error);
  }
}

/**
 * Helper to trigger calendar event deletion
 * Usage: Call this after successfully deleting a session in Supabase
 */
export async function triggerCalendarDelete(eventId: string) {
  try {
    const response = await fetch(`/api/google-calendar/sync-session/${eventId}`, {
      method: 'DELETE',
    });

    if (response.ok) {
      console.log('✓ Google Calendar event deleted');
    }
  } catch (error) {
    // Silent failure
    console.warn('Google Calendar deletion failed (non-blocking):', error);
  }
}
