import { icon } from '../shared/icons.js';
import { activeStatuses } from '../services/library.js';

const navigation = [
  ['catalog', 'book', 'Каталог книг'],
  ['reservations', 'calendar', 'Мои бронирования'],
  ['admin', 'admin', 'Кабинет библиотекаря'],
];
export function shell(route, state) {
  const count = state.reservations.filter((item) => activeStatuses.includes(item.status)).length;
  return `<aside class="sidebar" id="navigation"><a class="brand" href="#/catalog">${icon('book')}<span>Переплёт<small>Городская библиотека</small></span></a><div class="nav-label">Ваша библиотека</div><nav aria-label="Основная навигация">${navigation.map(([id, symbol, label]) => `<a class="nav-link ${id === route ? 'active' : ''}" href="#/${id}" ${id === route ? 'aria-current="page"' : ''}>${icon(symbol)}<span>${label}</span>${id === 'reservations' && count ? `<span class="nav-count">${count}</span>` : ''}</a>`).join('')}</nav><div class="sidebar-bottom"><div class="library-note">${icon('leaf')}<p>Хорошие книги.<br>Всегда рядом.</p></div><div class="demo-note"><span class="status-dot"></span>Учебная библиотека<small>Данные хранятся в этом браузере</small></div></div></aside><div class="workspace"><header class="topbar"><button class="icon-button menu-button" aria-label="Открыть меню" aria-controls="navigation" aria-expanded="false" data-menu>${icon('menu')}</button><div class="breadcrumb">Библиотека ${icon('chevron')} <span>${navigation.find((item) => item[0] === route)?.[2] || 'Каталог книг'}</span></div><div class="reader"><span class="reader-avatar">${icon(route === 'admin' ? 'admin' : 'book')}</span><span>${route === 'admin' ? 'Библиотекарь' : 'Читатель'}<small>Демонстрационный режим</small></span></div></header><main id="main" tabindex="-1"></main><footer class="footer"><span>Переплёт · Библиотека для каждого</span><span>Учебный проект · HTML, CSS, JavaScript</span></footer></div>`;
}
