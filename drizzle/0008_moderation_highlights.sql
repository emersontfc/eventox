ALTER TABLE gallery_media ADD COLUMN featured INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE guestbook_messages ADD COLUMN featured INTEGER NOT NULL DEFAULT 0;
