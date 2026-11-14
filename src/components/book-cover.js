import { escapeHtml as e } from '../shared/html.js';

// Original vector cover series. Decorative art is independent of publishers' editions.
function art(kind) {
  switch (kind) {
    case 'cat':
      return '<circle cx="151" cy="229" r="65" opacity=".2"/><path d="M47 358c-17-70-5-117 19-134l-4-45 29 24 25-20-2 45c27 26 20 75 12 104 41-12 69-2 72 26z" fill="currentColor"/><path d="m76 229 8 3m12-3 8-3" stroke="var(--cover-bg)" stroke-width="3"/>';
    case 'dunes':
      return '<circle cx="155" cy="223" r="51" fill="currentColor" opacity=".8"/><path d="M0 263Q78 214 240 295V360H0z" fill="currentColor" opacity=".2"/><path d="M0 317Q124 225 240 279V360H0z" fill="currentColor" opacity=".3"/><path d="M0 340Q124 293 240 322V360H0z" fill="currentColor" opacity=".45"/>';
    case 'leaves':
      return '<g fill="none" stroke="currentColor" stroke-width="1.6"><path d="M30 335Q22 207 52 152M204 337Q221 237 198 172M32 302q41-23 20-48-31 6-20 48Zm4-61q-37-26-11-49 21 14 11 49Zm168 53q-42-27-22-53 32 11 22 53Zm4-67q29-23 6-45-20 9-6 45Z"/><circle cx="120" cy="285" r="25"/><circle cx="120" cy="285" r="16"/><path d="M120 310v35m0-12q-26-27-35-4 12 17 35 4m0 6q27-29 37-5-14 17-37 5"/></g>';
    case 'circles':
      return '<g fill="none" stroke="currentColor" stroke-width="2"><circle cx="120" cy="258" r="67"/><circle cx="120" cy="258" r="48"/><circle cx="120" cy="258" r="29"/><path d="M120 179v157m-79-78h158"/></g>';
    case 'eye':
      return '<g fill="none" stroke="currentColor" stroke-width="2"><path d="M25 260q95-112 190 0-95 112-190 0Z"/><circle cx="120" cy="260" r="40"/><circle cx="120" cy="260" r="14"/><path d="M120 177v-20m-65 47-14-15m144 15 14-15m-79 154v20"/></g>';
    case 'waves':
      return '<g fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="164" cy="207" r="32"/><path d="M0 260q60-35 120 0t120 0M0 278q60-35 120 0t120 0M0 296q60-35 120 0t120 0M0 314q60-35 120 0t120 0M0 332q60-35 120 0t120 0"/></g>';
    default:
      return '<g fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="120" cy="267" r="44"/><ellipse cx="120" cy="267" rx="72" ry="15" transform="rotate(-28 120 267)"/><path d="m43 181 3 8 8 1-7 5 1 8-6-5-7 4 2-8-6-5 8-1ZM181 166v13m-6-6h12M58 298v12m-6-6h12M191 311v12m-6-6h12M101 186v8m-4-4h8"/><circle cx="173" cy="218" r="2"/><circle cx="39" cy="244" r="2"/><circle cx="84" cy="333" r="2"/></g>';
  }
}
export function cover(book, extra = '') {
  const color = /^#[a-f\d]{6}$/i.test(book.color) ? book.color : '#537566';
  const ink = /^#[a-f\d]{6}$/i.test(book.ink) ? book.ink : '#f1e7c8';
  const titleWords = book.title.split(' ');
  const lines = [];
  let line = '';
  for (const word of titleWords) {
    if ((line + word).length > 14 && line) {
      lines.push(line.trim());
      line = '';
    }
    line += `${word} `;
  }
  if (line) lines.push(line.trim());
  return `<div class="book-cover ${extra}" style="--cover-bg:${color};--cover-ink:${ink}"><svg viewBox="0 0 240 360" role="img" aria-label="${e(book.title)} — авторская обложка"><rect width="240" height="360" fill="${color}"/><rect x="12" y="9" width="219" height="342" rx="1" fill="none" stroke="currentColor" opacity=".35"/><path d="M8 0v360" stroke="#000" opacity=".18" stroke-width="5"/><text x="122" y="37" text-anchor="middle" font-family="Onest, sans-serif" font-size="10" letter-spacing="1">${e(book.author.split(' ').slice(-1)[0].toUpperCase())}</text>${lines
    .slice(0, 4)
    .map(
      (text, i) =>
        `<text x="122" y="${80 + i * 31}" text-anchor="middle" font-family="Lora, Georgia, serif" font-size="${lines.length > 3 ? 21 : 25}" ${text.length > 17 ? 'textLength="195" lengthAdjust="spacingAndGlyphs"' : ''}>${e(text)}</text>`,
    )
    .join(
      '',
    )}${art(book.art)}<text x="122" y="345" text-anchor="middle" font-size="8" letter-spacing="3">ПЕРЕПЛЁТ · БИБЛИОТЕКА</text></svg></div>`;
}
