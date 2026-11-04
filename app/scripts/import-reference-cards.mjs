/** Import the user-supplied Base Set images without modifying their bytes.
 * Usage: node scripts/import-reference-cards.mjs /path/to/base1
 * Run from app/ or any other working directory. No network requests.
 */
import { readFileSync, readdirSync, mkdirSync, copyFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';

const source = path.resolve(process.argv[2] || '/Users/sebastianbelulok/cardsdotgg-reference/base1');
const app = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(app, 'public/cards');
const manifestPath = path.join(app, 'lib/game/card-catalog.json');
const files = readdirSync(source).filter(name => /^\d{3}-.+\.webp$/.test(name)).sort();
if (files.length !== 102) throw new Error(`Expected 102 card images; got ${files.length}`);
const sourceSet = JSON.parse(readFileSync(path.join(source, 'set.json'), 'utf8'));
const names = new Map(sourceSet.cards.map(card => [Number(card.localId), card.name]));
const rarityOf = id => id <= 16 ? 'Holo Rare' : id <= 22 || (id >= 70 && id <= 79) ? 'Rare' : (id >= 23 && id <= 42) || (id >= 80 && id <= 90) || id === 96 ? 'Uncommon' : 'Common';
mkdirSync(output, { recursive: true });
mkdirSync(path.dirname(manifestPath), { recursive: true });
const cards = files.map(filename => {
  const id = Number(filename.slice(0, 3));
  const name = names.get(id);
  if (!name) throw new Error(`Missing source name for ${id}`);
  copyFileSync(path.join(source, filename), path.join(output, filename));
  return { id, name, src: `/cards/${filename}`, rarity: rarityOf(id), category: id <= 69 ? 'Pokemon' : id <= 95 ? 'Trainer' : 'Energy' };
});
writeFileSync(manifestPath, JSON.stringify(cards, null, 2) + '\n');

const back = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="825" viewBox="0 0 600 825">
<defs>
 <linearGradient id="frame" x2="1" y2="1"><stop stop-color="#d8ecff"/><stop offset=".4" stop-color="#fff"/><stop offset="1" stop-color="#6b92c3"/></linearGradient>
 <radialGradient id="blue"><stop stop-color="#38bfff"/><stop offset=".46" stop-color="#185cd1"/><stop offset="1" stop-color="#071d60"/></radialGradient>
 <linearGradient id="silver" x2=".6" y2="1"><stop stop-color="#fff"/><stop offset=".45" stop-color="#deebfb"/><stop offset=".6" stop-color="#6885ab"/><stop offset="1" stop-color="#f1fbff"/></linearGradient>
 <linearGradient id="wave"><stop stop-color="#94f5ff" stop-opacity="0"/><stop offset=".5" stop-color="#b8faff" stop-opacity=".8"/><stop offset="1" stop-color="#b8faff" stop-opacity="0"/></linearGradient>
 <pattern id="dots" width="29" height="29" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#85cfff" opacity=".22"/></pattern>
 <filter id="glow"><feGaussianBlur stdDeviation="4"/></filter>
</defs>
<rect x="4" y="4" width="592" height="817" rx="29" fill="url(#frame)"/>
<rect x="19" y="19" width="562" height="787" rx="19" fill="url(#blue)"/>
<rect x="27" y="27" width="546" height="771" rx="15" fill="url(#dots)" stroke="#8fdbff" stroke-opacity=".45"/>
<path d="M-60 710C580 770 45 120 645 110M-40 650C510 700 140 150 630 160M-40 600C520 620 180 180 630 210" fill="none" stroke="url(#wave)" stroke-width="4"/>
<g fill="none" stroke="#93dfff"><ellipse cx="300" cy="412" rx="223" ry="272" stroke-opacity=".14"/><ellipse cx="300" cy="412" rx="194" ry="242" stroke-opacity=".2"/><circle cx="300" cy="412" r="175" stroke-opacity=".3" stroke-width="2"/><circle cx="300" cy="412" r="156" stroke-opacity=".6" stroke-dasharray="2 14" stroke-width="3"/></g>
<circle cx="300" cy="412" r="118" fill="#041a53" opacity=".5"/>
<circle cx="300" cy="412" r="105" fill="url(#silver)" stroke="#c7f6ff" stroke-width="5"/>
<circle cx="300" cy="412" r="84" fill="#0b3186"/>
<path d="M254 372h36l25 40 25-40h36l-44 66v27h-34v-27z" transform="translate(-15 -5)" fill="url(#silver)"/>
<circle cx="300" cy="412" r="130" fill="none" stroke="#96f0ff" stroke-width="2"/>
<text x="300" y="132" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="43" letter-spacing="3" fill="#08215f" stroke="#08215f" stroke-width="10" paint-order="stroke">YIELDDECK</text>
<text x="300" y="132" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="43" letter-spacing="3" fill="#eefaff">YIELDDECK</text>
<text x="300" y="167" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" letter-spacing="8" fill="#a1dbff">COLLECT · BATTLE · RISE</text>
<g transform="rotate(180 300 412.5)"><text x="300" y="132" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="43" letter-spacing="3" fill="#eefaff">YIELDDECK</text><text x="300" y="167" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" letter-spacing="8" fill="#a1dbff">COLLECT · BATTLE · RISE</text></g>
<g fill="#e5ffff"><path d="M123 238l3 12 12 3-12 3-3 12-3-12-12-3 12-3z"/><path d="M477 572l3 12 12 3-12 3-3 12-3-12-12-3 12-3z"/><circle cx="449" cy="256" r="2.5"/><circle cx="151" cy="569" r="2.5"/><circle cx="95" cy="457" r="2"/><circle cx="505" cy="368" r="2"/></g>
</svg>`;
writeFileSync(path.join(output, 'back.svg'), back);

const packs = [
 { slug: 'guardian', title: 'GUARDIAN', description: 'THE FOREST AWAKENS', color: '#6af3b3', mid: '#13876a', dark: '#062e29', card: 15, emblem: 'M-38 18Q-55-45 47-48Q50 35-38 18M-34 19L25-27' },
 { slug: 'balanced', title: 'BALANCED', description: 'FIND YOUR ELEMENT', color: '#ffe5a2', mid: '#ba803b', dark: '#3b271c', card: 2, emblem: 'M0-50L44 0 0 50-44 0ZM0-50V50M-44 0H44' },
 { slug: 'degen', title: 'DEGEN', description: 'UNLEASH THE FIRE', color: '#ffb18b', mid: '#d34645', dark: '#3c111d', card: 4, emblem: 'M7-54Q60 10 27 40Q-15 66-36 24Q-47 0-21-27Q-25 7-8 9Q16 0 7-54Z' },
];
for (const pack of packs) {
 const card = cards.find(c => c.id === pack.card);
 const art = readFileSync(path.join(output, path.basename(card.src))).toString('base64');
 const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="960" viewBox="0 0 600 960">
<defs>
 <linearGradient id="foil" x2="1" y2=".2"><stop stop-color="${pack.dark}"/><stop offset=".19" stop-color="${pack.mid}"/><stop offset=".38" stop-color="${pack.dark}"/><stop offset=".72" stop-color="${pack.mid}"/><stop offset="1" stop-color="${pack.dark}"/></linearGradient>
 <linearGradient id="edge"><stop stop-color="${pack.mid}"/><stop offset=".2" stop-color="${pack.color}"/><stop offset=".52" stop-color="${pack.mid}"/><stop offset=".76" stop-color="#fff"/><stop offset="1" stop-color="${pack.mid}"/></linearGradient>
 <linearGradient id="shine" x2="1" y2=".3"><stop stop-color="#fff" stop-opacity=".04"/><stop offset=".38" stop-color="#fff" stop-opacity="0"/><stop offset=".48" stop-color="#fff" stop-opacity=".25"/><stop offset=".53" stop-color="#fff" stop-opacity=".07"/><stop offset=".78" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".2"/></linearGradient>
 <linearGradient id="artFade" x2="0" y2="1"><stop stop-color="${pack.dark}" stop-opacity="0"/><stop offset=".6" stop-color="${pack.dark}" stop-opacity="0"/><stop offset="1" stop-color="${pack.dark}"/></linearGradient>
 <pattern id="crimp" width="9" height="60" patternUnits="userSpaceOnUse"><path d="M2 0V60" stroke="#fff" stroke-opacity=".25" stroke-width="2"/><path d="M5 0V60" stroke="#000" stroke-opacity=".2"/></pattern>
 <pattern id="grid" width="42" height="42" patternUnits="userSpaceOnUse"><path d="M21 0L42 21 21 42 0 21Z" fill="none" stroke="${pack.color}" stroke-opacity=".08"/></pattern>
 <clipPath id="pack"><path d="M8 0H592L588 35 596 70 579 115V845L596 890 588 925 592 960H8L12 925 4 890 21 845V115L4 70 12 35Z"/></clipPath>
 <clipPath id="art"><rect x="48" y="260" width="504" height="352" rx="12"/></clipPath>
</defs>
<g clip-path="url(#pack)">
 <rect width="600" height="960" fill="url(#foil)"/>
 <rect width="600" height="960" fill="url(#grid)"/>
 <rect width="600" height="62" fill="url(#edge)"/><rect width="600" height="62" fill="url(#crimp)"/>
 <rect y="898" width="600" height="62" fill="url(#edge)"/><rect y="898" width="600" height="62" fill="url(#crimp)"/>
 <path d="M24 77H576M24 883H576" stroke="${pack.color}" opacity=".8"/>
 <text x="300" y="133" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-weight="900" font-size="34" letter-spacing="4">YIELDDECK</text>
 <text x="300" y="164" text-anchor="middle" fill="${pack.color}" font-family="Arial,sans-serif" font-size="11" letter-spacing="6">TRADING CARD COLLECTION</text>
 <path d="M160 202H260M340 202H440" stroke="${pack.color}" stroke-width="1"/><path d="M300 190L312 202 300 214 288 202Z" fill="${pack.color}"/>
 <circle cx="300" cy="435" r="225" fill="none" stroke="${pack.color}" opacity=".3"/>
 <circle cx="300" cy="435" r="212" fill="none" stroke="${pack.color}" opacity=".14" stroke-width="6"/>
 <g clip-path="url(#art)"><svg x="48" y="260" width="504" height="352" viewBox="58 114 484 317" preserveAspectRatio="xMidYMid slice"><image width="600" height="825" href="data:image/webp;base64,${art}"/></svg><rect x="48" y="260" width="504" height="352" fill="url(#artFade)"/></g>
 <rect x="48" y="260" width="504" height="352" rx="12" fill="none" stroke="${pack.color}" stroke-opacity=".6"/>
 <path d="${pack.emblem}" transform="translate(300 644) scale(.47)" fill="${pack.color}" stroke="${pack.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
 <text x="300" y="733" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-weight="900" font-size="58" letter-spacing="3">${pack.title}</text>
 <text x="300" y="770" text-anchor="middle" fill="${pack.color}" font-family="Arial,sans-serif" font-size="13" font-weight="700" letter-spacing="4">${pack.description}</text>
 <path d="M75 802H525" stroke="${pack.color}" stroke-opacity=".4"/>
 <text x="300" y="842" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-size="16" font-weight="700" letter-spacing="4">5 CARDS · BASE COLLECTION</text>
 <rect width="600" height="960" fill="url(#shine)"/>
 <path d="M30 90L50 870M570 90L550 870" stroke="#fff" opacity=".12" stroke-width="5"/>
</g>
</svg>`;
 writeFileSync(path.join(output, `pack-${pack.slug}.svg`), svg);
}
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex');
for (const card of cards) {
 const filename = path.basename(card.src);
 if (!existsSync(path.join(app, 'public', card.src)) || sha(path.join(source, filename)) !== sha(path.join(output, filename))) {
  throw new Error(`Asset missing or modified: ${filename}`);
 }
}
console.log(`Verified ${cards.length} byte-identical card images, manifest, card back, and ${packs.length} self-contained SVG wrappers.`);
