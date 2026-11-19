CREATE TABLE IF NOT EXISTS `users` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `email` text NOT NULL UNIQUE,
  `password_hash` text NOT NULL,
  `name` text NOT NULL,
  `avatar_url` text,
  `phone` text,
  `global_role` text DEFAULT 'user' NOT NULL,
  `is_active` integer DEFAULT 1 NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `event_memberships` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` integer NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `event_id` integer NOT NULL REFERENCES `events`(`id`) ON DELETE CASCADE,
  `role` text DEFAULT 'coorganizador' NOT NULL,
  `permissions` text DEFAULT '[]' NOT NULL,
  `status` text DEFAULT 'ativo' NOT NULL,
  `created_at` text NOT NULL,
  UNIQUE(`user_id`, `event_id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `invitations` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `event_id` integer NOT NULL REFERENCES `events`(`id`) ON DELETE CASCADE,
  `email` text,
  `role` text DEFAULT 'coorganizador' NOT NULL,
  `permissions` text DEFAULT '[]' NOT NULL,
  `token` text NOT NULL UNIQUE,
  `expires_at` text NOT NULL,
  `status` text DEFAULT 'pendente' NOT NULL,
  `invited_by` integer REFERENCES `users`(`id`),
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `password_resets` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` integer NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `token` text NOT NULL UNIQUE,
  `expires_at` text NOT NULL,
  `used_at` text,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `event_id` integer REFERENCES `events`(`id`) ON DELETE CASCADE,
  `user_id` integer REFERENCES `users`(`id`),
  `user_name` text,
  `action` text NOT NULL,
  `entity` text NOT NULL,
  `entity_id` text,
  `details` text,
  `ip_address` text,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `screen_settings` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `event_id` integer NOT NULL UNIQUE REFERENCES `events`(`id`) ON DELETE CASCADE,
  `active_scene_id` text DEFAULT 'welcome' NOT NULL,
  `auto_rotate` integer DEFAULT 1 NOT NULL,
  `rotate_interval` integer DEFAULT 12 NOT NULL,
  `theme` text DEFAULT 'midnight_gold' NOT NULL,
  `background_style` text DEFAULT 'particles' NOT NULL,
  `custom_logo_url` text,
  `custom_headline` text,
  `hold_scene` integer DEFAULT 0 NOT NULL,
  `emergency_mode` integer DEFAULT 0 NOT NULL,
  `emergency_message` text,
  `font_family` text DEFAULT 'playfair' NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `screen_scenes` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `event_id` integer NOT NULL REFERENCES `events`(`id`) ON DELETE CASCADE,
  `scene_type` text NOT NULL,
  `title` text NOT NULL,
  `subtitle` text,
  `content` text,
  `duration` integer DEFAULT 12 NOT NULL,
  `position` integer DEFAULT 0 NOT NULL,
  `is_active` integer DEFAULT 1 NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `screen_messages` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `event_id` integer NOT NULL REFERENCES `events`(`id`) ON DELETE CASCADE,
  `guest_id` integer REFERENCES `guests`(`id`) ON DELETE SET NULL,
  `category` text DEFAULT 'individual' NOT NULL,
  `text` text NOT NULL,
  `status` text DEFAULT 'pendente' NOT NULL,
  `priority` integer DEFAULT 0 NOT NULL,
  `created_by` integer REFERENCES `users`(`id`),
  `approved_by` integer REFERENCES `users`(`id`),
  `scheduled_for` text,
  `displayed_at` text,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `guestbook_messages` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `event_id` integer NOT NULL REFERENCES `events`(`id`) ON DELETE CASCADE,
  `sender_name` text NOT NULL,
  `relationship` text,
  `message` text NOT NULL,
  `photo_url` text,
  `status` text DEFAULT 'pendente' NOT NULL,
  `approved_by` integer REFERENCES `users`(`id`),
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `quotes_library` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `event_id` integer NOT NULL REFERENCES `events`(`id`) ON DELETE CASCADE,
  `category` text DEFAULT 'celebracao' NOT NULL,
  `quote` text NOT NULL,
  `author` text,
  `is_active` integer DEFAULT 1 NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `events` ADD COLUMN `owner_id` integer REFERENCES `users`(`id`);
--> statement-breakpoint
ALTER TABLE `committee_members` ADD COLUMN `user_id` integer REFERENCES `users`(`id`);
