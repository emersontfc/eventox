CREATE TABLE live_polls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed', 'revealed')),
  active INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX live_polls_event_id_idx ON live_polls (event_id, id);
--> statement-breakpoint
CREATE UNIQUE INDEX live_polls_active_idx ON live_polls (event_id) WHERE active = 1;
--> statement-breakpoint
CREATE TABLE live_poll_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  poll_id INTEGER NOT NULL REFERENCES live_polls(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  position INTEGER NOT NULL,
  UNIQUE(poll_id, id),
  UNIQUE(poll_id, position)
);
--> statement-breakpoint
CREATE TABLE live_poll_votes (
  poll_id INTEGER NOT NULL,
  option_id INTEGER NOT NULL,
  guest_id INTEGER NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  voted_at TEXT NOT NULL,
  PRIMARY KEY (poll_id, guest_id),
  FOREIGN KEY (poll_id, option_id) REFERENCES live_poll_options(poll_id, id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX live_poll_votes_option_idx ON live_poll_votes (poll_id, option_id);
