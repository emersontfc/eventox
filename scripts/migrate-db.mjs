import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const dbPath = process.env.DATABASE_PATH || path.resolve(process.cwd(), 'data/eventox.db');
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

console.log(`🗄️ Executando migrações em: ${dbPath}`);
const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');

// 1. Criar tabela de controlo de migrações
sqlite.exec(`CREATE TABLE IF NOT EXISTS _eventox_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  applied_at TEXT NOT NULL
)`);

const drizzleDir = path.resolve(process.cwd(), 'drizzle');
if (fs.existsSync(drizzleDir)) {
  const files = fs.readdirSync(drizzleDir).filter(f => f.endsWith('.sql')).sort();
  const appliedRows = sqlite.prepare('SELECT name FROM _eventox_migrations').all();
  const applied = new Set(appliedRows.map(r => r.name));

  for (const file of files) {
    if (applied.has(file)) continue;
    console.log(`  Applying migration: ${file}...`);
    const content = fs.readFileSync(path.join(drizzleDir, file), 'utf-8');
    const statements = content.split('--> statement-breakpoint');
    sqlite.transaction(() => {
      for (const raw of statements) {
        const stmt = raw.trim();
        if (!stmt) continue;
        try {
          sqlite.exec(stmt);
        } catch (err) {
          if (!err.message?.includes('already exists') && !err.message?.includes('duplicate column')) {
            console.warn(`    ⚠️ [${file}]: ${err.message}`);
          }
        }
      }
      sqlite.prepare('INSERT INTO _eventox_migrations (name, applied_at) VALUES (?, ?)').run(
        file,
        new Date().toISOString()
      );
    })();
  }
}

// 2. Seed Default User (Emerson Charles) if no users exist
const userCount = sqlite.prepare('SELECT count(*) as count FROM users').get().count;
if (userCount === 0) {
  console.log('👤 Criando conta de administrador inicial (Emerson Charles)...');
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync('emerson2026', salt, 64).toString('hex');
  const passwordHash = `scrypt:${salt}:${derived}`;
  const now = new Date().toISOString();

  const userResult = sqlite.prepare(`
    INSERT INTO users (email, password_hash, name, phone, global_role, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run('emerson@eventox.local', passwordHash, 'Emerson Charles', '+258 84 000 0000', 'admin', 1, now, now);

  const userId = userResult.lastInsertRowid;

  // Link event 1 (Gala do Emerson) to this owner
  const emersonEvent = sqlite.prepare("SELECT id FROM events WHERE slug = 'emerson'").get();
  if (emersonEvent) {
    sqlite.prepare('UPDATE events SET owner_id = ? WHERE id = ?').run(userId, emersonEvent.id);

    // Create owner membership
    sqlite.prepare(`
      INSERT OR IGNORE INTO event_memberships (user_id, event_id, role, permissions, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      emersonEvent.id,
      'proprietario',
      JSON.stringify(['*']),
      'ativo',
      now
    );

    // Initialize screen settings for Emerson's Gala
    sqlite.prepare(`
      INSERT OR IGNORE INTO screen_settings (event_id, active_scene_id, auto_rotate, rotate_interval, theme, background_style, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(emersonEvent.id, 'welcome', 1, 14, 'midnight_gold', 'particles', now);

    // Initialize default screen scenes
    const defaultScenes = [
      {
        scene_type: 'welcome',
        title: 'Gala de Graduação de Medicina',
        subtitle: 'Bem-vindos à celebração de Emerson Charles',
        content: JSON.stringify({ headline: 'Uma noite extraordinária de celebração e amizade' }),
        duration: 14,
        position: 1,
      },
      {
        scene_type: 'countdown',
        title: 'Contagem Regressiva Oficial',
        subtitle: 'O grande momento está a chegar',
        content: JSON.stringify({}),
        duration: 10,
        position: 2,
      },
      {
        scene_type: 'arrivals',
        title: 'Boas-Vindas aos Convidados de Honra',
        subtitle: 'Chegadas recentes à celebração',
        content: JSON.stringify({}),
        duration: 12,
        position: 3,
      },
      {
        scene_type: 'fun_quote',
        title: 'Pensamento da Noite',
        subtitle: 'Medicina, Amizade & Celebração',
        content: JSON.stringify({ quote: 'Prescrição para hoje: 500mg de celebração e zero chamadas de urgência!', author: 'Comissão de Gala' }),
        duration: 12,
        position: 4,
      },
      {
        scene_type: 'qr_code',
        title: 'Partilha as Tuas Memórias',
        subtitle: 'Envia fotos e mensagens direto do teu telemóvel',
        content: JSON.stringify({ callToAction: 'Aponta a câmara para enviar fotos ao vivo para o ecrã!' }),
        duration: 14,
        position: 5,
      },
      {
        scene_type: 'gallery_mural',
        title: 'Mural de Fotografias em Direto',
        subtitle: 'Momentos captados pelos nossos convidados',
        content: JSON.stringify({}),
        duration: 16,
        position: 6,
      },
      {
        scene_type: 'schedule',
        title: 'Programa Oficial da Gala',
        subtitle: 'Cronograma da celebração',
        content: JSON.stringify({}),
        duration: 14,
        position: 7,
      },
      {
        scene_type: 'tribute',
        title: 'Homenagem aos Pais & Mestres',
        subtitle: 'Gratidão a quem tornou esta conquista possível',
        content: JSON.stringify({ dedication: 'À minha família, professores e amigos que caminharam comigo em cada etapa desta jornada.' }),
        duration: 15,
        position: 8,
      },
      {
        scene_type: 'gratitude',
        title: 'Obrigado por Fazerem Parte Deste Sonho!',
        subtitle: 'Dr. Emerson Charles & Família',
        content: JSON.stringify({ message: 'A vossa presença torna esta noite verdadeiramente inesquecível. Um brinde à vida e à amizade!' }),
        duration: 15,
        position: 9,
      },
    ];

    for (const sc of defaultScenes) {
      sqlite.prepare(`
        INSERT INTO screen_scenes (event_id, scene_type, title, subtitle, content, duration, position, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
      `).run(emersonEvent.id, sc.scene_type, sc.title, sc.subtitle, sc.content, sc.duration, sc.position, now);
    }

    // Initialize Quotes Library (celebratory & medical themes)
    const initialQuotes = [
      {
        category: 'medico',
        quote: 'Prescrição médica para hoje: 500mg de alegria, 1 dose de brinde e descanso absoluto de chamadas de urgência!',
        author: 'Dr. Emerson Charles',
      },
      {
        category: 'medico',
        quote: 'Anos de anatomia, noites em branco e exames intermináveis. Hoje o diagnóstico é um só: Vitória!',
        author: 'Turma de Medicina',
      },
      {
        category: 'celebracao',
        quote: 'O futuro pertence àqueles que acreditam na beleza dos seus sonhos e trabalham com paixão para os realizar.',
        author: 'Eleanor Roosevelt',
      },
      {
        category: 'homenagem',
        quote: 'Nenhum médico se forma sozinho: esta conquista é de todos os pais, mestres e amigos que seguraram a nossa mão.',
        author: 'Homenagem Solene',
      },
      {
        category: 'divertido',
        quote: 'Aviso da recepção: A pista de dança está oficialmente autorizada e a energia é contagiosa!',
        author: 'Protocolo de Gala',
      },
    ];

    for (const q of initialQuotes) {
      sqlite.prepare(`
        INSERT INTO quotes_library (event_id, category, quote, author, is_active, created_at)
        VALUES (?, ?, ?, ?, 1, ?)
      `).run(emersonEvent.id, q.category, q.quote, q.author, now);
    }
  }
}

// 3. Garantir que a 'Mesa de Honra' (com 4 lugares) existe nos eventos
try {
  const allEvents = sqlite.prepare('SELECT id, slug, title FROM events').all();
  for (const ev of allEvents) {
    const existingHonra = sqlite.prepare(
      "SELECT id, name, capacity FROM guest_tables WHERE event_id = ? AND (LOWER(name) LIKE '%honra%' OR LOWER(name) LIKE '%principal%')"
    ).get(ev.id);

    if (!existingHonra) {
      const maxTableId = sqlite.prepare('SELECT MAX(id) as maxId FROM guest_tables WHERE event_id = ?').get(ev.id)?.maxId || 0;
      const nextId = maxTableId + 1;
      sqlite.prepare('INSERT INTO guest_tables (id, event_id, name, capacity) VALUES (?, ?, ?, ?)').run(
        nextId,
        ev.id,
        'Mesa de Honra',
        4
      );
      console.log(`👑 [Evento ${ev.slug}] Criada 'Mesa de Honra' com 4 lugares (ID ${nextId}).`);
    } else if (existingHonra.name.toLowerCase().includes('honra') && existingHonra.capacity !== 4) {
      sqlite.prepare('UPDATE guest_tables SET capacity = 4 WHERE id = ?').run(existingHonra.id);
      console.log(`👑 [Evento ${ev.slug}] Atualizada capacidade da 'Mesa de Honra' (ID ${existingHonra.id}) para 4 lugares.`);
    }
  }
} catch (tableErr) {
  console.warn('⚠️ Erro ao verificar Mesa de Honra:', tableErr.message);
}

sqlite.close();
console.log('✅ Migrações e seeds aplicados com sucesso!');
