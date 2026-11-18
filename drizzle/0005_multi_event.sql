CREATE TABLE IF NOT EXISTS `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL UNIQUE,
	`title` text NOT NULL,
	`host_name` text NOT NULL,
	`event_date` text NOT NULL,
	`venue` text NOT NULL,
	`passcode` text DEFAULT '1234' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`cover_theme` text DEFAULT 'gold' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `guest_tables` ADD `event_id` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `guests` ADD `event_id` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `menu_items` ADD `event_id` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `orders` ADD `event_id` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `playlist` ADD `event_id` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `committee_members` ADD `event_id` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `committee_tasks` ADD `event_id` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `gallery_media` ADD `event_id` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
INSERT OR IGNORE INTO `events` (`id`, `slug`, `title`, `host_name`, `event_date`, `venue`, `passcode`, `description`, `cover_theme`, `created_at`) 
VALUES (1, 'emerson', 'Gala de Graduação', 'Emerson Charles', '2026-12-11T14:00', 'Salão de Eventos Cajada II', 'emerson2026', 'A celebração de uma grande jornada académica e o início de um novo capítulo.', 'gold', '2026-11-18T20:00:00Z');
--> statement-breakpoint
INSERT OR IGNORE INTO `guest_tables` (`id`, `event_id`, `name`, `capacity`) VALUES 
(1, 1, 'Cirurgia Geral', 10),
(2, 1, 'Medicina Interna', 10),
(3, 1, 'Pediatria', 10),
(4, 1, 'Ginecologia e Obstetrícia', 10),
(5, 1, 'Cuidados Intensivos', 10),
(6, 1, 'Medicina de Emergência', 10),
(7, 1, 'Cardiologia', 10),
(8, 1, 'Neurologia', 10),
(9, 1, 'Saúde Coletiva', 10),
(10, 1, 'Anestesiologia', 10);
