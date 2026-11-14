import { genres } from '../../data/books.js';
import { escapeHtml as e } from '../../shared/html.js';
import { icon } from '../../shared/icons.js';
import { cover } from '../../components/book-cover.js';
import { availability, emptyState, openDialog } from '../../components/ui.js';
import { availableCopies } from '../../services/library.js';

export const catalogFilters = {
  query: '',
  genre: 'all',
  available: false,
  favorites: false,
  sort: 'popular',
};
export function catalogPage(state) {
  const featured = ['prince', 'master', 'pride']
    .map((id) => state.books.find((book) => book.id === id))
    .filter(Boolean);
  return `<div class="page-heading"><h1>Ваша следующая история.</h1><p>Книги, к которым хочется возвращаться. Найдите свою в каталоге.</p></div><section class="catalog-banner" aria-label="Книжная подборка"><div class="banner-copy"><h2>Между делом —<br>целый мир.</h2><p>Отложите суету. Откройте хорошую книгу.</p><a class="button primary" href="#book-list" data-browse>Выбрать книгу ${icon('arrow')}</a></div><div class="banner-books" aria-hidden="true">${featured.map((book) => cover(book)).join('')}</div></section><section class="catalog-section" aria-label="Каталог книг"><div class="catalog-toolbar"><div class="search-field"><label for="book-search" class="visually-hidden">Название, автор или ISBN</label>${icon('search')}<input id="book-search" type="search" placeholder="Название, автор или ISBN" value="${e(catalogFilters.query)}" autocomplete="off" /></div><label class="sort-field"><span class="visually-hidden">Сортировка книг</span><select id="book-sort"><option value="popular" ${catalogFilters.sort === 'popular' ? 'selected' : ''}>Сначала популярные</option><option value="title" ${catalogFilters.sort === 'title' ? 'selected' : ''}>По названию</option><option value="newest" ${catalogFilters.sort === 'newest' ? 'selected' : ''}>По году издания</option></select></label></div><div class="filter-toolbar"><div class="genre-filters" aria-label="Жанры книг">${[['all', 'Все книги'], ...genres.map((genre) => [genre, genre])].map(([value, label]) => `<button class="filter-chip ${catalogFilters.genre === value ? 'selected' : ''}" data-genre="${e(value)}" aria-pressed="${catalogFilters.genre === value}">${label}</button>`).join('')}</div><label class="switch-label"><input type="checkbox" id="available-filter" ${catalogFilters.available ? 'checked' : ''}/><span class="switch"></span>В наличии</label></div><div class="results-heading" id="book-list"><span id="result-count" role="status"></span><button class="text-button favorites-filter ${catalogFilters.favorites ? 'selected' : ''}" data-favorites aria-pressed="${catalogFilters.favorites}">${icon('bookmark')}Избранное</button></div><div id="catalog-results"></div></section>`;
}
export function renderBooks(state) {
  const query = catalogFilters.query.trim().toLocaleLowerCase('ru');
  const books = state.books
    .filter(
      (book) =>
        (!query ||
          `${book.title} ${book.author} ${book.isbn}`.toLocaleLowerCase('ru').includes(query)) &&
        (catalogFilters.genre === 'all' || book.genre === catalogFilters.genre) &&
        (!catalogFilters.available || availableCopies(state, book.id) > 0) &&
        (!catalogFilters.favorites || state.favorites.includes(book.id)),
    )
    .sort((a, b) =>
      catalogFilters.sort === 'title'
        ? a.title.localeCompare(b.title, 'ru')
        : catalogFilters.sort === 'newest'
          ? b.year - a.year
          : b.popularity - a.popularity,
    );
  document.querySelector('#result-count').textContent =
    `Найдено: ${books.length} из ${state.books.length}`;
  document.querySelector('#catalog-results').innerHTML = books.length
    ? `<div class="book-grid">${books.map((book) => `<article class="book-card"><button class="book-visual" data-details="${e(book.id)}" aria-label="Открыть книгу «${e(book.title)}»">${cover(book)}<span class="view-book">Посмотреть ${icon('arrow')}</span></button><div class="book-meta"><span class="book-genre">${e(book.genre)}</span><button class="icon-button favorite-button ${state.favorites.includes(book.id) ? 'saved' : ''}" data-favorite="${e(book.id)}" aria-pressed="${state.favorites.includes(book.id)}" aria-label="${state.favorites.includes(book.id) ? 'Убрать из избранного' : 'Добавить в избранное'}: ${e(book.title)}">${icon('bookmark')}</button></div><h2><button data-details="${e(book.id)}">${e(book.title)}</button></h2><p class="book-author">${e(book.author)}</p>${availability(state, book)}</article>`).join('')}</div>`
    : emptyState(
        'Книг пока не нашлось',
        'Попробуйте другое название или сбросьте фильтры.',
        '<button class="button secondary" data-reset-filters>Сбросить фильтры</button>',
      );
}
export function showBookDetails(state, id) {
  const book = state.books.find((item) => item.id === id);
  if (!book) return;
  const available = availableCopies(state, id);
  const reserved = state.reservations.some(
    (item) => item.bookId === id && ['pending', 'ready', 'issued'].includes(item.status),
  );
  openDialog(
    `<div class="book-detail"><div class="detail-visual">${cover(book)}</div><div class="detail-copy"><span class="book-genre">${e(book.genre)}</span><h2 id="dialog-title">${e(book.title)}</h2><p class="detail-author">${e(book.author)}</p>${availability(state, book)}<p class="description">${e(book.description)}</p><dl class="book-facts"><div><dt>Год</dt><dd>${book.year}</dd></div><div><dt>Страниц</dt><dd>${book.pages}</dd></div><div><dt>ISBN</dt><dd>${e(book.isbn)}</dd></div></dl>${reserved ? '<a class="button primary" href="#/reservations" data-close-dialog>Посмотреть мою бронь</a>' : `<button class="button primary" data-reserve="${e(book.id)}" ${available ? '' : 'disabled'}>${available ? 'Забронировать книгу' : 'Нет свободных экземпляров'}${icon('arrow')}</button>`}<p class="fine-print">Бронирование бесплатно. Срок чтения — 14 дней.</p></div></div>`,
  );
}
