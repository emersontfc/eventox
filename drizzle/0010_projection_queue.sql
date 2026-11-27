CREATE TABLE projection_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('photos', 'messages')),
  source_id INTEGER NOT NULL,
  position INTEGER NOT NULL,
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds BETWEEN 5 AND 120),
  projected_at INTEGER
);
--> statement-breakpoint
CREATE INDEX projection_queue_event_pending ON projection_queue (event_id, projected_at, position);
--> statement-breakpoint
CREATE UNIQUE INDEX projection_queue_pending_source ON projection_queue (event_id, kind, source_id) WHERE projected_at IS NULL;
--> statement-breakpoint
CREATE TABLE projection_state (
  event_id INTEGER PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  prepared_id INTEGER REFERENCES projection_queue(id) ON DELETE SET NULL,
  active_id INTEGER REFERENCES projection_queue(id) ON DELETE SET NULL,
  expires_at INTEGER
);
--> statement-breakpoint
CREATE TRIGGER projection_photo_hidden
AFTER UPDATE OF status ON gallery_media
WHEN NEW.status <> 'aprovado'
BEGIN
  DELETE FROM projection_queue WHERE event_id = NEW.event_id AND kind = 'photos' AND source_id = NEW.id;
END;
--> statement-breakpoint
CREATE TRIGGER projection_photo_deleted
AFTER DELETE ON gallery_media
BEGIN
  DELETE FROM projection_queue WHERE event_id = OLD.event_id AND kind = 'photos' AND source_id = OLD.id;
END;
--> statement-breakpoint
CREATE TRIGGER projection_message_hidden
AFTER UPDATE OF status ON guestbook_messages
WHEN NEW.status <> 'aprovado'
BEGIN
  DELETE FROM projection_queue WHERE event_id = NEW.event_id AND kind = 'messages' AND source_id = NEW.id;
END;
--> statement-breakpoint
CREATE TRIGGER projection_message_deleted
AFTER DELETE ON guestbook_messages
BEGIN
  DELETE FROM projection_queue WHERE event_id = OLD.event_id AND kind = 'messages' AND source_id = OLD.id;
END;
