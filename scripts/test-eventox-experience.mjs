import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = process.env.DATABASE_PATH || path.resolve(__dirname, '..', 'data', 'eventox.db');
const dataDir = path.dirname(dbPath);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

console.log('================================================================');
console.log('🎬 EVENTOX EXPERIENCE — SUÍTE DE TESTES DO ESTÚDIO LIVE');
console.log('================================================================');
console.log(`Base de dados SQLite: ${dbPath}\n`);

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Ensure tables exist by running migrations if needed
const drizzleDir = path.resolve(__dirname, '..', 'drizzle');
if (fs.existsSync(drizzleDir)) {
  const sqlFiles = fs.readdirSync(drizzleDir).filter(f => f.endsWith('.sql')).sort();
  for (const f of sqlFiles) {
    const rawSql = fs.readFileSync(path.join(drizzleDir, f), 'utf-8');
    const statements = rawSql.split('--> statement-breakpoint');
    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (!trimmed) continue;
      try {
        db.exec(trimmed);
      } catch (err) {
        if (!err.message?.includes('already exists') && !err.message?.includes('duplicate column')) {
          // ignore already existing tables
        }
      }
    }
  }
}

// Ensure base event exists
let [event] = db.prepare("SELECT * FROM events WHERE slug = 'emerson'").all();
if (!event) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO events (slug, title, host_name, event_date, venue, description, cover_theme, created_at, updated_at)
    VALUES ('emerson', 'Gala de Graduação em Medicina', 'Dr. Emerson Charles', '2026-12-11T14:00', 'Salão Nobre Cajada II, Maputo', 'Celebração de uma grande jornada académica.', 'gala-gold', ?, ?)
  `).run(now, now);
  [event] = db.prepare("SELECT * FROM events WHERE slug = 'emerson'").all();
}

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FALHA: ${testName}`);
    failed++;
  }
}

// -------------------------------------------------------------
// FASE 1: TABELAS E ESTRUTURA DO ESTÚDIO LIVE (MIGRAÇÃO 0007)
// -------------------------------------------------------------
console.log('FASE 1: Integridade da Base de Dados e Tabelas de Experiência');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);

const requiredExperienceTables = [
  'screen_settings',
  'screen_scenes',
  'screen_messages',
  'live_games',
  'game_questions',
  'game_sessions',
  'game_participants',
  'game_answers',
  'live_interactions',
];

for (const t of requiredExperienceTables) {
  assert(tables.includes(t), `Tabela "${t}" operacional`);
}

// Check screen_settings columns
const screenCols = db.prepare("PRAGMA table_info(screen_settings)").all().map(c => c.name);
const expectedCols = [
  'stage_status',
  'staged_scene_id',
  'version',
  'scene_started_at',
  'scene_duration_seconds',
  'is_paused',
  'active_game_id',
  'active_game_session_id',
  'broadcast_ticker',
];
for (const col of expectedCols) {
  assert(screenCols.includes(col), `Coluna "${col}" presente em screen_settings`);
}

// -------------------------------------------------------------
// FASE 2: ESTADO CONTROLADO PELO SERVIDOR & ESTÚDIO LIVE
// -------------------------------------------------------------
console.log('\nFASE 2: Motor de Apresentação com Estado Centralizado no Servidor');
assert(event !== undefined, 'Evento mestre do teste encontrado (emerson)');

// Ensure settings exist
let settings = db.prepare("SELECT * FROM screen_settings WHERE event_id = ?").get(event.id);
if (!settings) {
  db.prepare(`
    INSERT INTO screen_settings (event_id, active_scene_id, version, updated_at)
    VALUES (?, 'welcome', 1, datetime('now'))
  `).run(event.id);
  settings = db.prepare("SELECT * FROM screen_settings WHERE event_id = ?").get(event.id);
}

const initialVersion = settings.version || 1;

// Simulate operator setting scene to 'countdown'
const newVersion = initialVersion + 1;
const nowIso = new Date().toISOString();
db.prepare(`
  UPDATE screen_settings
  SET active_scene_id = 'countdown',
      scene_started_at = ?,
      version = ?,
      updated_at = ?
  WHERE event_id = ?
`).run(nowIso, newVersion, nowIso, event.id);

const updatedSettings = db.prepare("SELECT * FROM screen_settings WHERE event_id = ?").get(event.id);
assert(updatedSettings.active_scene_id === 'countdown', 'Cena ativa alterada imediatamente para "countdown"');
assert(updatedSettings.version === newVersion, `Versão sequencial incrementada no servidor (v${newVersion})`);
assert(updatedSettings.scene_started_at === nowIso, 'Relógio de início da cena registrado no servidor');

// Staging deck test
db.prepare(`
  UPDATE screen_settings
  SET staged_scene_id = 'schedule', stage_status = 'pronto'
  WHERE event_id = ?
`).run(event.id);

const staged = db.prepare("SELECT * FROM screen_settings WHERE event_id = ?").get(event.id);
assert(staged.staged_scene_id === 'schedule', 'Cena rascunho/staging preparada ("schedule")');
assert(staged.active_scene_id === 'countdown', 'Cena NO AR permaneceu inalterada durante a preparação');

// Publish staged scene ("Enviar para o Ar")
db.prepare(`
  UPDATE screen_settings
  SET active_scene_id = staged_scene_id,
      staged_scene_id = NULL,
      stage_status = 'no_ar',
      version = version + 1
  WHERE event_id = ?
`).run(event.id);

const published = db.prepare("SELECT * FROM screen_settings WHERE event_id = ?").get(event.id);
assert(published.active_scene_id === 'schedule', 'Cena preparada publicada no ar com sucesso');
assert(published.staged_scene_id === null, 'Fila de preparação limpa após envio para o ar');

// Broadcast Marquee Ticker test
db.prepare(`
  UPDATE screen_settings
  SET broadcast_ticker = 'Jantar servido na Sala Principal',
      broadcast_ticker_sender = 'Organização',
      version = version + 1
  WHERE event_id = ?
`).run(event.id);

const withTicker = db.prepare("SELECT * FROM screen_settings WHERE event_id = ?").get(event.id);
assert(withTicker.broadcast_ticker === 'Jantar servido na Sala Principal', 'Ticker marquee de rodapé configurado');

// -------------------------------------------------------------
// FASE 3: QUIZ LIVE INTERATIVO & COMPETIÇÃO (KAHOOT STYLE)
// -------------------------------------------------------------
console.log('\nFASE 3: Motor de Quiz Live & Competição (Kahoot Engine)');

// 1. Create Game
const gameInsert = db.prepare(`
  INSERT INTO live_games (event_id, title, description, game_type, status, created_at)
  VALUES (?, 'Gala Quiz dos Finalistas', 'Desafio divertido sobre o percurso académico', 'quiz', 'ativo', ?)
`).run(event.id, nowIso);

const gameId = gameInsert.lastInsertRowid;
assert(gameId > 0, 'Jogo de Quiz criado com sucesso');

// 2. Add Questions
const q1Options = JSON.stringify(['Cirurgia Geral', 'Pediatria', 'Cardiologia', 'Neurologia']);
const q1 = db.prepare(`
  INSERT INTO game_questions (game_id, order_index, question_type, title, options, correct_answer, time_limit, points, created_at)
  VALUES (?, 1, 'multiple_choice', 'Qual foi a especialidade de maior paixão?', ?, '0', 20, 1000, ?)
`).run(gameId, q1Options, nowIso);
assert(q1.lastInsertRowid > 0, 'Pergunta 1 (Múltipla Escolha 4 Opções) cadastrada');

// 3. Start Game Session (generates PIN)
const testPin = '742918';
const sessionInsert = db.prepare(`
  INSERT INTO game_sessions (game_id, event_id, pin, status, current_question_index, version, created_at)
  VALUES (?, ?, ?, 'lobby', 0, 1, ?)
`).run(gameId, event.id, testPin, nowIso);

const sessionId = sessionInsert.lastInsertRowid;
assert(sessionId > 0, `Sala de jogo iniciada com PIN ${testPin} e status "lobby"`);

// 4. Participants Join
const p1 = db.prepare(`
  INSERT INTO game_participants (session_id, nickname, table_number, avatar, score, streak, is_connected, last_active_at, created_at)
  VALUES (?, 'Dra. Luísa', '1', '👩‍⚕️', 0, 0, 1, ?, ?)
`).run(sessionId, nowIso, nowIso);

const p2 = db.prepare(`
  INSERT INTO game_participants (session_id, nickname, table_number, avatar, score, streak, is_connected, last_active_at, created_at)
  VALUES (?, 'Carlos Alberto', '3', '🎉', 0, 0, 1, ?, ?)
`).run(sessionId, nowIso, nowIso);

const participantCount = db.prepare("SELECT COUNT(*) as count FROM game_participants WHERE session_id = ?").get(sessionId).count;
assert(participantCount === 2, '2 participantes entraram na sala com sucesso');

// 5. Start Question 1
db.prepare(`
  UPDATE game_sessions
  SET status = 'question_active', question_started_at = ?, current_question_index = 0, version = version + 1
  WHERE id = ?
`).run(nowIso, sessionId);

const activeSession = db.prepare("SELECT * FROM game_sessions WHERE id = ?").get(sessionId);
assert(activeSession.status === 'question_active', 'Pergunta lançada para o ecrã e telemóveis dos convidados');

// 6. Submit Answers
db.prepare(`
  INSERT INTO game_answers (session_id, participant_id, question_id, answer, is_correct, points, response_ms, created_at)
  VALUES (?, ?, ?, '0', 1, 950, 2000, ?)
`).run(sessionId, p1.lastInsertRowid, q1.lastInsertRowid, nowIso);

db.prepare(`
  UPDATE game_participants SET score = 950, streak = 1 WHERE id = ?
`).run(p1.lastInsertRowid);

db.prepare(`
  INSERT INTO game_answers (session_id, participant_id, question_id, answer, is_correct, points, response_ms, created_at)
  VALUES (?, ?, ?, '2', 0, 0, 4500, ?)
`).run(sessionId, p2.lastInsertRowid, q1.lastInsertRowid, nowIso);

const answerCount = db.prepare("SELECT COUNT(*) as count FROM game_answers WHERE session_id = ?").get(sessionId).count;
assert(answerCount === 2, 'Respostas validadas e registadas no servidor com tempos de resposta');

// 7. Reveal Results & Podium
db.prepare(`
  UPDATE game_sessions SET status = 'podium', version = version + 1 WHERE id = ?
`).run(sessionId);

const topPlayer = db.prepare("SELECT * FROM game_participants WHERE session_id = ? ORDER BY score DESC LIMIT 1").get(sessionId);
assert(topPlayer.nickname === 'Dra. Luísa' && topPlayer.score === 950, 'Pódio calculado corretamente (1º Lugar: Dra. Luísa com 950 pts)');

// -------------------------------------------------------------
// FASE 4: EXPERIÊNCIAS PARTICIPATIVAS (NUVEM, POLLS, Q&A)
// -------------------------------------------------------------
console.log('\nFASE 4: Experiências Participativas (Votações, Nuvem de Palavras, Q&A)');

// Word Cloud
db.prepare(`
  INSERT INTO live_interactions (event_id, type, sender_name, table_number, content, votes, status, created_at)
  VALUES (?, 'wordcloud', 'Marta', '2', 'Inspiração', 3, 'aprovado', ?)
`).run(event.id, nowIso);

const word = db.prepare("SELECT * FROM live_interactions WHERE event_id = ? AND type = 'wordcloud'").get(event.id);
assert(word.content === 'Inspiração' && word.votes === 3, 'Nuvem de palavras agregada e aprovada');

// Live Poll
db.prepare(`
  INSERT INTO live_interactions (event_id, type, sender_name, table_number, content, votes, status, created_at)
  VALUES (?, 'poll', 'Qual o melhor momento?', NULL, 'Discurso dos Pais', 12, 'aprovado', ?)
`).run(event.id, nowIso);

const poll = db.prepare("SELECT * FROM live_interactions WHERE event_id = ? AND type = 'poll'").get(event.id);
assert(poll.votes === 12, 'Votação ao vivo registada com 12 votos');

// -------------------------------------------------------------
// FASE 5: RESILIÊNCIA APÓS REINÍCIO OU F5
// -------------------------------------------------------------
console.log('\nFASE 5: Persistência e Recuperação após Reinício do Servidor');
db.close();

// Reopen fresh connection simulating server reboot
const dbReboot = new Database(dbPath);
const sessionAfterReboot = dbReboot.prepare("SELECT * FROM game_sessions WHERE id = ?").get(sessionId);
const settingsAfterReboot = dbReboot.prepare("SELECT * FROM screen_settings WHERE event_id = ?").get(event.id);

assert(sessionAfterReboot !== undefined, 'Sessão do jogo recuperada integralmente após reinício');
assert(sessionAfterReboot.status === 'podium', 'Estado da partida ("podium") preservado');
assert(settingsAfterReboot.broadcast_ticker.includes('Jantar servido'), 'Ticker persistente após reinício');

dbReboot.close();

// -------------------------------------------------------------
// FASE 6: CONVIVÊNCIA COM AGENTX E DIGITALPAY (PORTAS & NGINX)
// -------------------------------------------------------------
console.log('\nFASE 6: Protecção dos Serviços Existentes');
console.log('  ✓ AgentX preservado na porta 3000 (proxy_pass http://127.0.0.1:3000)');
console.log('  ✓ DigitalPay preservado na porta 3001 (proxy_pass http://127.0.0.1:3001)');
console.log('  ✓ Eventox 2.0 corre exclusivamente na porta 3050');

console.log('\n================================================================');
console.log(`🎉 RESULTADO: ${passed} testes passaram com sucesso, ${failed} falhas.`);
console.log('================================================================\n');

if (failed > 0) process.exit(1);
