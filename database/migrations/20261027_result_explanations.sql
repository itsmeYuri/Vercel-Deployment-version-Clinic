-- Apply once before deploying the explanation UI. Existing results are unchanged.
BEGIN;
CREATE TABLE IF NOT EXISTS result_explanations (
  result_id INTEGER PRIMARY KEY REFERENCES lab_results(id) ON DELETE CASCADE,
  what_happened TEXT NOT NULL,
  possible_causes TEXT NOT NULL,
  next_steps TEXT NOT NULL,
  follow_up TEXT NOT NULL,
  source VARCHAR(40) NOT NULL DEFAULT 'Doctor',
  review_status VARCHAR(20) NOT NULL DEFAULT 'Draft' CHECK (review_status IN ('Draft', 'Approved')),
  author_id INTEGER NOT NULL REFERENCES users(id),
  reviewer_id INTEGER REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  result_updated_at TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_result_explanations_review ON result_explanations(review_status);
ALTER TABLE result_explanations ENABLE ROW LEVEL SECURITY;
COMMIT;
