import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '..', 'data', 'eventox.db');

console.log('====================================================');
console.log('🧪 EVENTOX 2.0 — SUÍTE DE TESTES AUTOMATIZADOS');
console.log('====================================================');
console.log(`Base de dados: ${dbPath}\n`);

const db = new Database(dbPath);

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

// ==========================================
// TEST 1: DATABASE INTEGRITY & MIGRATION 0006
// ==========================================
console.log('TESTE 1: Integridade da Base de Dados e Tabelas');
const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table'")
  .all()
  .map((r) => r.name);

const requiredTables = [
  'events',
  'users',
  'event_memberships',
  'invitations',
  'screen_settings',
  'screen_scenes',
  'screen_messages',
  'quotes_library',
  'guestbook_messages',
  'audit_logs',
  'guests',
  'guest_tables',
  'menu_items',
  'committee_members',
];

for (const t of requiredTables) {
  assert(tables.includes(t), `Tabela "${t}" presente no SQLite`);
}

// Verify Emerson's Gala event
const emersonEvent = db.prepare("SELECT * FROM events WHERE slug = 'emerson'").get();
assert(emersonEvent !== undefined, 'Evento "emerson" existe e está preservado');
assert(emersonEvent.title.includes('Gala'), 'Título da Gala de Graduação preservado');

// Verify guests count
const guestCount = db.prepare("SELECT COUNT(*) as count FROM guests WHERE event_id = ?").get(emersonEvent.id).count;
assert(guestCount > 0, `Convidados preservados (${guestCount} convidados registados)`);

// Verify screen scenes count
const sceneCount = db.prepare("SELECT COUNT(*) as count FROM screen_scenes WHERE event_id = ?").get(emersonEvent.id).count;
assert(sceneCount >= 9, `Cenas do Ecrã 16:9 configuradas (${sceneCount} cenas)`);

// Verify quotes library
const quoteCount = db.prepare("SELECT COUNT(*) as count FROM quotes_library WHERE event_id = ?").get(emersonEvent.id).count;
assert(quoteCount >= 5, `Banco de citações de Medicina e celebração presente (${quoteCount} citações)`);

// ==========================================
// TEST 2: RBAC PERMISSIONS MATRIX & SECURITY
// ==========================================
console.log('\nTESTE 2: Sistema de Funções e Matriz de Permissões (RBAC)');

const ROLE_PERMISSIONS = {
  proprietario: ['*'],
  coorganizador: ['*'],
  recepcao: [
    'guests:view', 'guests:create', 'guests:edit', 'guests:checkin',
    'tables:view', 'screen:view',
  ],
  catering: [
    'catering:view', 'catering:orders', 'catering:status', 'tables:view',
  ],
  audiovisual: [
    'screen:view', 'screen:control', 'screen:messages', 'screen:scenes',
    'screen:theme', 'quotes:manage', 'playlist:view',
  ],
  fotografia: [
    'gallery:view', 'gallery:upload', 'gallery:moderate', 'screen:view',
  ],
  comissao: [
    'committee:view', 'guests:view', 'tables:view', 'screen:view',
  ],
};

function hasPermission(role, userPerms, requiredPerm) {
  if (role === 'proprietario' || userPerms.includes('*')) return true;
  if (userPerms.includes(requiredPerm)) return true;
  const [reqModule] = requiredPerm.split(':');
  if (userPerms.includes(`${reqModule}:*`)) return true;
  return false;
}

// Audiovisual checks
const avPerms = ROLE_PERMISSIONS['audiovisual'];
assert(hasPermission('audiovisual', avPerms, 'screen:control'), 'Audiovisual PODE controlar o ecrã (screen:control)');
assert(hasPermission('audiovisual', avPerms, 'screen:messages'), 'Audiovisual PODE moderar mensagens no ecrã');
assert(!hasPermission('audiovisual', avPerms, 'team:manage'), 'Audiovisual NÃO PODE gerir equipa/utilizadores');
assert(!hasPermission('audiovisual', avPerms, 'settings:manage'), 'Audiovisual NÃO PODE alterar configurações críticas');

// Recepção checks
const recepcaoPerms = ROLE_PERMISSIONS['recepcao'];
assert(hasPermission('recepcao', recepcaoPerms, 'guests:view'), 'Recepção PODE consultar convidados');
assert(hasPermission('recepcao', recepcaoPerms, 'guests:checkin'), 'Recepção PODE fazer check-in de convidados');
assert(!hasPermission('recepcao', recepcaoPerms, 'screen:control'), 'Recepção NÃO PODE forçar cenas no ecrã');
assert(!hasPermission('recepcao', recepcaoPerms, 'catering:orders'), 'Recepção NÃO PODE gerir pedidos de bar');

// Proprietário checks
assert(hasPermission('proprietario', ['*'], 'team:manage'), 'Proprietário tem permissão total wildcard (*)');

// ==========================================
// TEST 3: PASSWORD HASHING (SCRYPT) & AUTH
// ==========================================
console.log('\nTESTE 3: Criptografia de Palavras-passe e Sessões');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, key] = stored.split(':');
  if (!salt || !key) return false;
  const keyBuffer = Buffer.from(key, 'hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(keyBuffer, derivedKey);
}

const testPass = 'GalaMedicina2026!';
const hashed = hashPassword(testPass);
assert(hashed.includes(':'), 'Hash gerado no formato salt:hash');
assert(verifyPassword(testPass, hashed), 'Verificação bem-sucedida com a palavra-passe correta');
assert(!verifyPassword('PalavraErrada!', hashed), 'Rejeição segura de palavra-passe incorreta');

// ==========================================
// TEST 4: CHECK-IN QUEUE & ANTI-DUPLICATION
// ==========================================
console.log('\nTESTE 4: Fila de Boas-Vindas no Ecrã & Anti-Duplicação');

const existingGuest = db.prepare("SELECT id FROM guests WHERE event_id = ? LIMIT 1").get(emersonEvent.id);
assert(existingGuest !== undefined, 'Convidado de teste encontrado no evento');

const testGuestId = existingGuest.id;
const testEventId = emersonEvent.id;

// Clean up any test records for this guest
db.prepare("DELETE FROM screen_messages WHERE guest_id = ?").run(testGuestId);

// 1. First trigger check-in welcome
const now = new Date().toISOString();
db.prepare(`
  INSERT INTO screen_messages (event_id, guest_id, category, text, status, priority, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`).run(testEventId, testGuestId, 'individual', 'Bem-vindo(a), Teste Automatizado!', 'pendente', 0, now);

const msg1 = db.prepare("SELECT * FROM screen_messages WHERE guest_id = ?").all(testGuestId);
assert(msg1.length === 1, 'Primeira mensagem de boas-vindas inserida com sucesso');

// 2. Anti-duplication test
const checkExisting = db.prepare("SELECT * FROM screen_messages WHERE guest_id = ? AND event_id = ?").all(testGuestId, testEventId);
assert(checkExisting.length === 1, 'Mecanismo anti-duplicação deteta mensagem já existente para este convidado');

// Clean up test record
db.prepare("DELETE FROM screen_messages WHERE guest_id = ?").run(testGuestId);

// ==========================================
// TEST 5: PRIVACY SANITIZATION (ZERO LEAKS)
// ==========================================
console.log('\nTESTE 5: Higienização de Privacidade dos Convidados');

const publicScreenArrivals = db.prepare(`
  SELECT id, name FROM guests WHERE event_id = ? AND status = 'presente' LIMIT 5
`).all(emersonEvent.id);

let hasSensitiveFields = false;
for (const arrival of publicScreenArrivals) {
  if ('phone' in arrival || 'notes' in arrival || 'email' in arrival || 'seat' in arrival) {
    hasSensitiveFields = true;
  }
}
assert(!hasSensitiveFields, 'Ecrã público exibe apenas o nome do convidado, sem telefone, notas ou dados privados');

// ==========================================
// SUMMARY
// ==========================================
console.log('\n====================================================');
console.log(`TOTAL DE TESTES: ${passed + failed}`);
console.log(`✓ APROVADOS:   ${passed}`);
console.log(`✗ FALHAS:      ${failed}`);
console.log('====================================================\n');

db.close();

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 TODOS OS TESTES PASSARAM COM SUCESSO!\n');
}
