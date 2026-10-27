-- Apply once to a local MySQL database before enabling explanation UI.
CREATE TABLE IF NOT EXISTS result_explanations (
  result_id INTEGER PRIMARY KEY,
  what_happened TEXT NOT NULL,
  possible_causes TEXT NOT NULL,
  next_steps TEXT NOT NULL,
  follow_up TEXT NOT NULL,
  source VARCHAR(40) NOT NULL DEFAULT 'Doctor',
  review_status VARCHAR(20) NOT NULL DEFAULT 'Draft',
  author_id INTEGER NOT NULL,
  reviewer_id INTEGER NULL,
  approved_at DATETIME NULL,
  result_updated_at DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_result_explanations_review (review_status),
  CONSTRAINT fk_result_explanations_result FOREIGN KEY (result_id) REFERENCES lab_results(id) ON DELETE CASCADE,
  CONSTRAINT fk_result_explanations_author FOREIGN KEY (author_id) REFERENCES users(id),
  CONSTRAINT fk_result_explanations_reviewer FOREIGN KEY (reviewer_id) REFERENCES users(id)
);
