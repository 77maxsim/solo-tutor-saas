-- Admin Dashboard Aggregate Functions
-- These functions return pre-aggregated data for scalable admin metrics
-- Run this SQL in your Supabase SQL Editor

-- 1. Get active students count (unique students with sessions in last N days)
CREATE OR REPLACE FUNCTION get_active_students_count(days_back integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result integer;
BEGIN
  SELECT COUNT(DISTINCT student_id) INTO result
  FROM sessions
  WHERE session_start >= NOW() - (days_back || ' days')::interval
    AND session_start <= NOW()
    AND student_id IS NOT NULL;
  RETURN result;
END;
$$;

-- 2. Get earnings aggregated by tutor (for currency conversion)
-- Returns tutor_id, currency, total_earnings, session_count
CREATE OR REPLACE FUNCTION get_earnings_by_tutor(paid_only boolean DEFAULT true)
RETURNS TABLE (
  tutor_id uuid,
  tutor_currency text,
  total_earnings numeric,
  session_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.tutor_id,
    COALESCE(t.currency, 'USD') as tutor_currency,
    SUM((s.duration::numeric / 60) * s.rate) as total_earnings,
    COUNT(s.id) as session_count
  FROM sessions s
  LEFT JOIN tutors t ON s.tutor_id = t.id
  WHERE (NOT paid_only OR s.paid = true)
  GROUP BY s.tutor_id, t.currency;
END;
$$;

-- 3. Get sessions count in a date range
CREATE OR REPLACE FUNCTION get_sessions_count_in_range(
  start_date timestamptz,
  end_date timestamptz
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result integer;
BEGIN
  SELECT COUNT(*) INTO result
  FROM sessions
  WHERE session_start >= start_date
    AND session_start <= end_date;
  RETURN result;
END;
$$;

-- 4. Get weekly/monthly active tutors count
CREATE OR REPLACE FUNCTION get_active_tutors_count(days_back integer DEFAULT 7)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result integer;
BEGIN
  SELECT COUNT(DISTINCT tutor_id) INTO result
  FROM sessions
  WHERE session_start >= NOW() - (days_back || ' days')::interval;
  RETURN result;
END;
$$;

-- 5. Get unpaid sessions count (sessions that have ended but aren't paid)
CREATE OR REPLACE FUNCTION get_unpaid_sessions_count()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result integer;
BEGIN
  SELECT COUNT(*) INTO result
  FROM sessions
  WHERE paid = false
    AND session_end <= NOW();
  RETURN result;
END;
$$;

-- 6. Get top tutors with earnings (returns already aggregated data)
CREATE OR REPLACE FUNCTION get_top_tutors_earnings(limit_count integer DEFAULT 10)
RETURNS TABLE (
  tutor_id uuid,
  tutor_name text,
  tutor_email text,
  tutor_currency text,
  total_earnings numeric,
  session_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.tutor_id,
    COALESCE(t.full_name, 'Unknown') as tutor_name,
    COALESCE(t.email, '') as tutor_email,
    COALESCE(t.currency, 'USD') as tutor_currency,
    SUM((s.duration::numeric / 60) * s.rate) as total_earnings,
    COUNT(s.id) as session_count
  FROM sessions s
  LEFT JOIN tutors t ON s.tutor_id = t.id
  WHERE s.paid = true
  GROUP BY s.tutor_id, t.full_name, t.email, t.currency
  ORDER BY total_earnings DESC
  LIMIT limit_count;
END;
$$;

-- Grant execute permissions to authenticated users and service role
GRANT EXECUTE ON FUNCTION get_active_students_count(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_students_count(integer) TO service_role;

GRANT EXECUTE ON FUNCTION get_earnings_by_tutor(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION get_earnings_by_tutor(boolean) TO service_role;

GRANT EXECUTE ON FUNCTION get_sessions_count_in_range(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION get_sessions_count_in_range(timestamptz, timestamptz) TO service_role;

GRANT EXECUTE ON FUNCTION get_active_tutors_count(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_tutors_count(integer) TO service_role;

GRANT EXECUTE ON FUNCTION get_unpaid_sessions_count() TO authenticated;
GRANT EXECUTE ON FUNCTION get_unpaid_sessions_count() TO service_role;

GRANT EXECUTE ON FUNCTION get_top_tutors_earnings(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_top_tutors_earnings(integer) TO service_role;

-- Create index for faster aggregations (if not exists)
CREATE INDEX IF NOT EXISTS idx_sessions_session_start ON sessions(session_start);
CREATE INDEX IF NOT EXISTS idx_sessions_tutor_id ON sessions(tutor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_paid ON sessions(paid);
CREATE INDEX IF NOT EXISTS idx_sessions_student_id ON sessions(student_id);
