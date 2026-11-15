CREATE TABLE `committee_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`area` text DEFAULT 'Coordenação geral' NOT NULL,
	`responsibilities` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'ativo' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `committee_tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`member_id` integer,
	`due_date` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pendente' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `committee_members`(`id`) ON UPDATE no action ON DELETE no action
);
