-- Create RPC function to mark multiple sessions as paid
-- This function takes an array of session IDs and marks them as paid
-- Only updates sessions belonging to the current user (enforced by RLS)

CREATE OR REPLACE FUNCTION mark_sessions_paid(session_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update sessions to mark as paid
  -- RLS policies will ensure only the current user's sessions are updated
  UPDATE sessions 
  SET paid = true, 
      updated_at = NOW()
  WHERE id = ANY(session_ids)
    AND paid = false; -- Only update unpaid sessions
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION mark_sessions_paid(uuid[]) TO authenticated;