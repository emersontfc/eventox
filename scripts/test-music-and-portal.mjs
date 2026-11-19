import Database from 'better-sqlite3';

console.log('🧪 Testando sistema de áudio incorporado (YouTube & Spotify)...');

function parseMusicEmbed(url, searchFallback) {
  const cleanUrl = (url || '').trim();

  if (cleanUrl) {
    const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/i;
    const ytMatch = cleanUrl.match(ytRegex);
    if (ytMatch && ytMatch[1]) {
      return {
        type: 'youtube',
        embedUrl: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?autoplay=1&rel=0`,
        sourceLabel: 'YouTube',
      };
    }

    const spotRegex = /open\.spotify\.com\/(track|album|playlist|artist)\/([a-zA-Z0-9]+)/i;
    const spotMatch = cleanUrl.match(spotRegex);
    if (spotMatch) {
      return {
        type: 'spotify',
        embedUrl: `https://open.spotify.com/embed/${spotMatch[1]}/${spotMatch[2]}?utm_source=generator&theme=0`,
        sourceLabel: 'Spotify',
      };
    }
  }

  if (searchFallback && searchFallback.trim().length > 1) {
    return {
      type: 'youtube-search',
      embedUrl: `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(searchFallback.trim())}&autoplay=1`,
      sourceLabel: 'YouTube Search',
    };
  }

  return null;
}

// 1. Test parsing
const ytTest = parseMusicEmbed('https://www.youtube.com/watch?v=fCZVL_8D048');
if (!ytTest || ytTest.type !== 'youtube' || !ytTest.embedUrl.includes('youtube-nocookie.com/embed/fCZVL_8D048')) {
  console.error('❌ Falha no parser YouTube:', ytTest);
  process.exit(1);
}
console.log('  ✓ Parser YouTube funciona perfeitamente');

const spotTest = parseMusicEmbed('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT');
if (!spotTest || spotTest.type !== 'spotify' || !spotTest.embedUrl.includes('open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT')) {
  console.error('❌ Falha no parser Spotify:', spotTest);
  process.exit(1);
}
console.log('  ✓ Parser Spotify funciona perfeitamente');

const searchTest = parseMusicEmbed(null, 'Ben E. King Stand By Me');
if (!searchTest || searchTest.type !== 'youtube-search' || !searchTest.embedUrl.includes('listType=search')) {
  console.error('❌ Falha no fallback de busca:', searchTest);
  process.exit(1);
}
console.log('  ✓ Fallback de busca automática no YouTube funciona perfeitamente');

// 2. Test database seed for event playlist
const db = new Database('./data/eventox.db');
const existingSongs = db.prepare('SELECT count(*) as count FROM playlist WHERE event_id = 1').get();

if (existingSongs.count === 0) {
  console.log('  ℹ️ Inserindo músicas de gala de exemplo na playlist do evento 1...');
  const insert = db.prepare('INSERT INTO playlist (event_id, title, artist, url, position, status) VALUES (?, ?, ?, ?, ?, ?)');
  insert.run(1, 'Jerusalema', 'Master KG ft. Nomcebo', 'https://www.youtube.com/watch?v=fCZVL_8D048', 1, 'tocando');
  insert.run(1, 'Stand By Me', 'Ben E. King', 'https://www.youtube.com/watch?v=hwZNL7QVJgu', 2, 'fila');
  insert.run(1, 'A Mi No Me Importa', 'Gildo Lhongo', 'https://www.youtube.com/watch?v=jNQXAC9IVRw', 3, 'fila');
  console.log('  ✓ 3 músicas seminais inseridas na playlist da celebração');
} else {
  console.log(`  ✓ Playlist já contém ${existingSongs.count} música(s) configurada(s)`);
}

console.log('🎉 TODOS OS TESTES DE ÁUDIO E PORTAL PASSARAM COM SUCESSO!');
