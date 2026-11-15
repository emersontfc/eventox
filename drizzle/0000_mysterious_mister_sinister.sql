CREATE TABLE `guest_tables` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`capacity` integer DEFAULT 10 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `guests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`table_id` integer NOT NULL,
	`seat` integer NOT NULL,
	`status` text DEFAULT 'pendente' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`table_id`) REFERENCES `guest_tables`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `guests_table_seat_unique` ON `guests` (`table_id`,`seat`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
