import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  phone: text('phone'),
  globalRole: text('global_role').notNull().default('user'), // 'admin' | 'user'
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const events = sqliteTable('events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  hostName: text('host_name').notNull(),
  eventDate: text('event_date').notNull(),
  venue: text('venue').notNull(),
  passcode: text('passcode').notNull().default('1234'),
  description: text('description').notNull().default(''),
  coverTheme: text('cover_theme').notNull().default('gold'),
  photoAlbumUrl: text('photo_album_url').notNull().default(''),
  ownerId: integer('owner_id').references(() => users.id),
  createdAt: text('created_at').notNull(),
});

export const eventMemberships = sqliteTable('event_memberships', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  eventId: integer('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('coorganizador'), // 'proprietario' | 'coorganizador' | 'recepcao' | 'catering' | 'audiovisual' | 'fotografia' | 'comissao'
  permissions: text('permissions').notNull().default('[]'), // JSON array of custom permissions
  status: text('status').notNull().default('ativo'), // 'ativo' | 'suspenso' | 'bloqueado'
  createdAt: text('created_at').notNull(),
}, (table) => [
  uniqueIndex('memberships_user_event_unique').on(table.userId, table.eventId),
]);

export const invitations = sqliteTable('invitations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventId: integer('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  email: text('email'),
  role: text('role').notNull().default('coorganizador'),
  permissions: text('permissions').notNull().default('[]'),
  token: text('token').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  status: text('status').notNull().default('pendente'), // 'pendente' | 'aceite' | 'revogado' | 'expirado'
  invitedBy: integer('invited_by').references(() => users.id),
  createdAt: text('created_at').notNull(),
});

export const passwordResets = sqliteTable('password_resets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  usedAt: text('used_at'),
  createdAt: text('created_at').notNull(),
});

export const auditLogs = sqliteTable('audit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventId: integer('event_id').references(() => events.id, { onDelete: 'cascade' }),
  userId: integer('user_id').references(() => users.id),
  userName: text('user_name'),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: text('entity_id'),
  details: text('details'),
  ipAddress: text('ip_address'),
  createdAt: text('created_at').notNull(),
});

export const guestTables = sqliteTable('guest_tables', {
  id: integer('id').primaryKey(),
  eventId: integer('event_id').notNull().default(1).references(() => events.id),
  name: text('name').notNull(),
  capacity: integer('capacity').notNull().default(10),
});

export const guests = sqliteTable('guests', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventId: integer('event_id').notNull().default(1).references(() => events.id),
  name: text('name').notNull(),
  phone: text('phone').notNull().default(''),
  tableId: integer('table_id').notNull().references(() => guestTables.id),
  seat: integer('seat').notNull(),
  status: text('status').notNull().default('pendente'), // 'pendente' | 'confirmado' | 'presente' | 'recusado'
  notes: text('notes').notNull().default(''),
  createdAt: text('created_at').notNull().default(''),
}, (table) => [uniqueIndex('guests_event_table_seat_unique').on(table.eventId, table.tableId, table.seat)]);

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const menuItems = sqliteTable('menu_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventId: integer('event_id').notNull().default(1).references(() => events.id),
  name: text('name').notNull(),
  category: text('category').notNull().default('comida'),
  description: text('description').notNull().default(''),
  stock: integer('stock').notNull().default(0),
  unit: text('unit').notNull().default('unidade'),
  available: integer('available', { mode: 'boolean' }).notNull().default(true),
});

export const orders = sqliteTable('orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventId: integer('event_id').notNull().default(1).references(() => events.id),
  tableId: integer('table_id').notNull().references(() => guestTables.id),
  itemId: integer('item_id').notNull().references(() => menuItems.id),
  quantity: integer('quantity').notNull(),
  status: text('status').notNull().default('pendente'),
  note: text('note').notNull().default(''),
  createdAt: text('created_at').notNull(),
});

export const playlist = sqliteTable('playlist', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventId: integer('event_id').notNull().default(1).references(() => events.id),
  title: text('title').notNull(),
  artist: text('artist').notNull().default(''),
  url: text('url').notNull().default(''),
  position: integer('position').notNull().default(0),
  status: text('status').notNull().default('fila'),
});

export const committeeMembers = sqliteTable('committee_members', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventId: integer('event_id').notNull().default(1).references(() => events.id),
  name: text('name').notNull(),
  role: text('role').notNull(),
  area: text('area').notNull().default('Coordenação geral'),
  responsibilities: text('responsibilities').notNull().default(''),
  phone: text('phone').notNull().default(''),
  email: text('email').notNull().default(''),
  status: text('status').notNull().default('ativo'),
  userId: integer('user_id').references(() => users.id),
});

export const committeeTasks = sqliteTable('committee_tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventId: integer('event_id').notNull().default(1).references(() => events.id),
  title: text('title').notNull(),
  memberId: integer('member_id').references(() => committeeMembers.id),
  dueDate: text('due_date').notNull().default(''),
  status: text('status').notNull().default('pendente'),
  notes: text('notes').notNull().default(''),
});

export const galleryMedia = sqliteTable('gallery_media', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventId: integer('event_id').notNull().default(1),
  key: text('storage_key').notNull().unique(),
  mime: text('mime').notNull(),
  size: integer('size').notNull(),
  originalName: text('original_name').notNull(),
  uploader: text('uploader').notNull(),
  album: text('album').notNull().default('Momentos especiais'),
  featured: integer('featured', { mode: 'boolean' }).notNull().default(false),
  status: text('status').notNull().default('pendente'),
  createdAt: text('created_at').notNull(),
  ipHash: text('ip_hash').notNull().default(''),
  driveStatus: text('drive_status').notNull().default('pendente'),
  driveFileId: text('drive_file_id'),
  driveError: text('drive_error').notNull().default(''),
  driveUpdatedAt: text('drive_updated_at').notNull().default(''),
});

export const screenSettings = sqliteTable('screen_settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventId: integer('event_id').notNull().unique().references(() => events.id, { onDelete: 'cascade' }),
  activeSceneId: text('active_scene_id').notNull().default('welcome'),
  autoRotate: integer('auto_rotate', { mode: 'boolean' }).notNull().default(true),
  rotateInterval: integer('rotate_interval').notNull().default(12), // seconds
  theme: text('theme').notNull().default('midnight_gold'), // 'midnight_gold' | 'royal_wine' | 'cinematic_dark' | 'clean_luxury'
  backgroundStyle: text('background_style').notNull().default('particles'), // 'particles' | 'gradient' | 'ambient' | 'minimal'
  customLogoUrl: text('custom_logo_url'),
  customHeadline: text('custom_headline'),
  holdScene: integer('hold_scene', { mode: 'boolean' }).notNull().default(false),
  emergencyMode: integer('emergency_mode', { mode: 'boolean' }).notNull().default(false),
  emergencyMessage: text('emergency_message'),
  fontFamily: text('font_family').notNull().default('playfair'),
  stageStatus: text('stage_status').notNull().default('no_ar'), // 'rascunho' | 'pronto' | 'no_ar' | 'pausado' | 'concluido'
  stagedSceneId: text('staged_scene_id'),
  version: integer('version').notNull().default(1),
  sceneStartedAt: text('scene_started_at'),
  sceneDurationSeconds: integer('scene_duration_seconds').notNull().default(12),
  isPaused: integer('is_paused', { mode: 'boolean' }).notNull().default(false),
  activeGameId: integer('active_game_id'),
  activeGameSessionId: integer('active_game_session_id'),
  broadcastTicker: text('broadcast_ticker'),
  broadcastTickerSender: text('broadcast_ticker_sender'),
  broadcastTickerAt: text('broadcast_ticker_at'),
  updatedAt: text('updated_at').notNull(),
});

export const screenScenes = sqliteTable('screen_scenes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventId: integer('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  sceneType: text('scene_type').notNull(), // 'welcome' | 'countdown' | 'arrivals' | 'fun_quote' | 'gallery_mural' | 'qr_code' | 'schedule' | 'tribute' | 'gratitude' | 'emergency' | 'quiz' | 'poll' | 'wordcloud' | 'qa'
  title: text('title').notNull(),
  subtitle: text('subtitle'),
  content: text('content'), // JSON payload for scene specific configurations
  duration: integer('duration').notNull().default(12),
  position: integer('position').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
});

export const screenMessages = sqliteTable('screen_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventId: integer('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  guestId: integer('guest_id').references(() => guests.id, { onDelete: 'set null' }),
  category: text('category').notNull().default('individual'), // 'casal' | 'individual' | 'familia' | 'honra' | 'equipa' | 'personalizado'
  text: text('text').notNull(),
  status: text('status').notNull().default('pendente'), // 'pendente' | 'aprovado' | 'exibido' | 'cancelado'
  priority: integer('priority').notNull().default(0),
  createdBy: integer('created_by').references(() => users.id),
  approvedBy: integer('approved_by').references(() => users.id),
  scheduledFor: text('scheduled_for'),
  displayedAt: text('displayed_at'),
  createdAt: text('created_at').notNull(),
});

export const guestbookMessages = sqliteTable('guestbook_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventId: integer('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  senderName: text('sender_name').notNull(),
  relationship: text('relationship'), // 'Família' | 'Colega' | 'Amigo' | 'Mestre'
  message: text('message').notNull(),
  photoUrl: text('photo_url'),
  featured: integer('featured', { mode: 'boolean' }).notNull().default(false),
  status: text('status').notNull().default('pendente'), // 'pendente' | 'aprovado' | 'rejeitado'
  approvedBy: integer('approved_by').references(() => users.id),
  createdAt: text('created_at').notNull(),
});

export const quotesLibrary = sqliteTable('quotes_library', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventId: integer('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  category: text('category').notNull().default('celebracao'), // 'medico' | 'divertido' | 'inspirador' | 'homenagem'
  quote: text('quote').notNull(),
  author: text('author'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
});

export const liveGames = sqliteTable('live_games', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventId: integer('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  gameType: text('game_type').notNull().default('quiz'), // 'quiz' | 'trivia' | 'table_battle' | 'couples'
  settings: text('settings'), // JSON string: { timePerQuestion: 20, randomOrder: false, showLeaderboard: true }
  status: text('status').notNull().default('ativo'), // 'ativo' | 'arquivado'
  createdAt: text('created_at').notNull(),
});

export const gameQuestions = sqliteTable('game_questions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gameId: integer('game_id').notNull().references(() => liveGames.id, { onDelete: 'cascade' }),
  orderIndex: integer('order_index').notNull().default(0),
  questionType: text('question_type').notNull().default('multiple_choice'), // 'multiple_choice' | 'true_false' | 'short_answer' | 'picture'
  title: text('title').notNull(),
  mediaUrl: text('media_url'),
  options: text('options').notNull(), // JSON array: ["Opção A", "Opção B", "Opção C", "Opção D"]
  correctAnswer: text('correct_answer').notNull(), // "0", "1", or text
  timeLimit: integer('time_limit').notNull().default(20), // seconds
  points: integer('points').notNull().default(1000),
  explanation: text('explanation'),
  createdAt: text('created_at').notNull(),
});

export const gameSessions = sqliteTable('game_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gameId: integer('game_id').notNull().references(() => liveGames.id, { onDelete: 'cascade' }),
  eventId: integer('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  pin: text('pin').notNull(), // 6-digit random code
  status: text('status').notNull().default('lobby'), // 'lobby' | 'question_active' | 'question_ended' | 'podium' | 'concluded'
  currentQuestionIndex: integer('current_question_index').notNull().default(0),
  questionStartedAt: text('question_started_at'),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
});

export const gameParticipants = sqliteTable('game_participants', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id').notNull().references(() => gameSessions.id, { onDelete: 'cascade' }),
  nickname: text('nickname').notNull(),
  tableNumber: text('table_number'),
  avatar: text('avatar'),
  score: integer('score').notNull().default(0),
  streak: integer('streak').notNull().default(0),
  isConnected: integer('is_connected', { mode: 'boolean' }).notNull().default(true),
  lastActiveAt: text('last_active_at').notNull(),
  createdAt: text('created_at').notNull(),
});

export const gameAnswers = sqliteTable('game_answers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id').notNull().references(() => gameSessions.id, { onDelete: 'cascade' }),
  participantId: integer('participant_id').notNull().references(() => gameParticipants.id, { onDelete: 'cascade' }),
  questionId: integer('question_id').notNull().references(() => gameQuestions.id, { onDelete: 'cascade' }),
  answer: text('answer').notNull(),
  isCorrect: integer('is_correct', { mode: 'boolean' }).notNull().default(false),
  points: integer('points').notNull().default(0),
  responseMs: integer('response_ms').notNull().default(0),
  createdAt: text('created_at').notNull(),
});

export const liveInteractions = sqliteTable('live_interactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventId: integer('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'wordcloud' | 'poll' | 'qa' | 'song_vote' | 'tribute'
  senderName: text('sender_name').notNull(),
  tableNumber: text('table_number'),
  content: text('content').notNull(),
  votes: integer('votes').notNull().default(0),
  status: text('status').notNull().default('aprovado'), // 'pendente' | 'aprovado' | 'rejeitado' | 'exibido'
  displayedAt: text('displayed_at'),
  createdAt: text('created_at').notNull(),
});
