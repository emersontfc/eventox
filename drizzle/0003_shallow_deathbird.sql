CREATE TABLE `gallery_media` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`storage_key` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`original_name` text NOT NULL,
	`uploader` text NOT NULL,
	`album` text DEFAULT 'Momentos especiais' NOT NULL,
	`status` text DEFAULT 'pendente' NOT NULL,
	`created_at` text NOT NULL,
	`ip_hash` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gallery_media_storage_key_unique` ON `gallery_media` (`storage_key`);