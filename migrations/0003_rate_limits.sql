-- Fixed-window counters for abuse protection on a public demo (no external service needed).
CREATE TABLE rate_limits (
  key TEXT NOT NULL,
  bucket INTEGER NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  expires INTEGER NOT NULL,
  PRIMARY KEY (key, bucket)
);
