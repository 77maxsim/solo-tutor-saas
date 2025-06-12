-- Add dashboard_card_order column to tutors table
ALTER TABLE tutors ADD COLUMN IF NOT EXISTS dashboard_card_order JSONB;

-- Add comment to describe the column
COMMENT ON COLUMN tutors.dashboard_card_order IS 'Stores the order of dashboard cards as a JSON array of card objects with id and title';