import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

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
  status: text('status').notNull().default('pendente'),
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
  status: text('status').notNull().default('pendente'),
  createdAt: text('created_at').notNull(),
  ipHash: text('ip_hash').notNull().default(''),
  driveStatus: text('drive_status').notNull().default('pendente'),
  driveFileId: text('drive_file_id'),
  driveError: text('drive_error').notNull().default(''),
  driveUpdatedAt: text('drive_updated_at').notNull().default(''),
});
