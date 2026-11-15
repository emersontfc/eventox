ALTER TABLE `gallery_media` ADD `drive_status` text DEFAULT 'pendente' NOT NULL;--> statement-breakpoint
ALTER TABLE `gallery_media` ADD `drive_file_id` text;--> statement-breakpoint
ALTER TABLE `gallery_media` ADD `drive_error` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `gallery_media` ADD `drive_updated_at` text DEFAULT '' NOT NULL;