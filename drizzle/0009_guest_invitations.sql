CREATE TABLE guest_invitations (
  token TEXT PRIMARY KEY NOT NULL,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_id INTEGER NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  companion_id INTEGER REFERENCES guests(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  CHECK (companion_id IS NULL OR companion_id <> guest_id)
);
--> statement-breakpoint
CREATE INDEX guest_invitations_event_idx ON guest_invitations(event_id);
--> statement-breakpoint
CREATE UNIQUE INDEX guest_invitations_guest_idx ON guest_invitations(guest_id);
--> statement-breakpoint
CREATE UNIQUE INDEX guest_invitations_companion_idx ON guest_invitations(companion_id);
