ALTER TABLE `screen_settings` ADD COLUMN `stage_status` text DEFAULT 'no_ar' NOT NULL;
--> statement-breakpoint
ALTER TABLE `screen_settings` ADD COLUMN `staged_scene_id` text;
--> statement-breakpoint
ALTER TABLE `screen_settings` ADD COLUMN `version` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `screen_settings` ADD COLUMN `scene_started_at` text;
--> statement-breakpoint
ALTER TABLE `screen_settings` ADD COLUMN `scene_duration_seconds` integer DEFAULT 12 NOT NULL;
--> statement-breakpoint
ALTER TABLE `screen_settings` ADD COLUMN `is_paused` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `screen_settings` ADD COLUMN `active_game_id` integer;
--> statement-breakpoint
ALTER TABLE `screen_settings` ADD COLUMN `active_game_session_id` integer;
--> statement-breakpoint
ALTER TABLE `screen_settings` ADD COLUMN `broadcast_ticker` text;
--> statement-breakpoint
ALTER TABLE `screen_settings` ADD COLUMN `broadcast_ticker_sender` text;
--> statement-breakpoint
ALTER TABLE `screen_settings` ADD COLUMN `broadcast_ticker_at` text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `live_games` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `event_id` integer NOT NULL REFERENCES `events`(`id`) ON DELETE CASCADE,
  `title` text NOT NULL,
  `description` text,
  `game_type` text DEFAULT 'quiz' NOT NULL,
  `settings` text,
  `status` text DEFAULT 'ativo' NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `game_questions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `game_id` integer NOT NULL REFERENCES `live_games`(`id`) ON DELETE CASCADE,
  `order_index` integer DEFAULT 0 NOT NULL,
  `question_type` text DEFAULT 'multiple_choice' NOT NULL,
  `title` text NOT NULL,
  `media_url` text,
  `options` text NOT NULL,
  `correct_answer` text NOT NULL,
  `time_limit` integer DEFAULT 20 NOT NULL,
  `points` integer DEFAULT 1000 NOT NULL,
  `explanation` text,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `game_sessions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `game_id` integer NOT NULL REFERENCES `live_games`(`id`) ON DELETE CASCADE,
  `event_id` integer NOT NULL REFERENCES `events`(`id`) ON DELETE CASCADE,
  `pin` text NOT NULL,
  `status` text DEFAULT 'lobby' NOT NULL,
  `current_question_index` integer DEFAULT 0 NOT NULL,
  `question_started_at` text,
  `version` integer DEFAULT 1 NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `game_participants` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `session_id` integer NOT NULL REFERENCES `game_sessions`(`id`) ON DELETE CASCADE,
  `nickname` text NOT NULL,
  `table_number` text,
  `avatar` text,
  `score` integer DEFAULT 0 NOT NULL,
  `streak` integer DEFAULT 0 NOT NULL,
  `is_connected` integer DEFAULT 1 NOT NULL,
  `last_active_at` text NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `game_answers` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `session_id` integer NOT NULL REFERENCES `game_sessions`(`id`) ON DELETE CASCADE,
  `participant_id` integer NOT NULL REFERENCES `game_participants`(`id`) ON DELETE CASCADE,
  `question_id` integer NOT NULL REFERENCES `game_questions`(`id`) ON DELETE CASCADE,
  `answer` text NOT NULL,
  `is_correct` integer DEFAULT 0 NOT NULL,
  `points` integer DEFAULT 0 NOT NULL,
  `response_ms` integer DEFAULT 0 NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `live_interactions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `event_id` integer NOT NULL REFERENCES `events`(`id`) ON DELETE CASCADE,
  `type` text NOT NULL,
  `sender_name` text NOT NULL,
  `table_number` text,
  `content` text NOT NULL,
  `votes` integer DEFAULT 0 NOT NULL,
  `status` text DEFAULT 'aprovado' NOT NULL,
  `displayed_at` text,
  `created_at` text NOT NULL
);
