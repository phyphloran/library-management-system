import { escapeHtml as e, dateLabel } from '../../shared/html.js';
import { genres } from '../../data/books.js';
import { icon } from '../../shared/icons.js';
import { cover } from '../../components/book-cover.js';
import { statusBadge, emptyState, openDialog } from '../../components/ui.js';
import { availableCopies, statusLabels } from '../../services/library.js';

export const adminFilters = { tab: 'reservations', query: '', status: 'all' };
export function adminPage(state) {
  const pending = state.reservations.filter((item) => item.status === 'pending').length;
  const issued = state.reservations.filter((item) => item.status === 'issued').length;
  return `<div class="page-heading heading-row"><div><h1>Кабинет библиотекаря</h1><p>Порядок на полках. Внимание к каждому читателю.</p></div><button class="button primary" data-add-book>${icon('plus')}Добавить книгу</button></div><div class="admin-summary"><div>${icon('book')}<span><strong>${state.books.length}</strong> книг в каталоге</span></div><div>${icon('clock')}<span><strong>${pending}</strong> ожидают подтверждения</span></div><div>${icon('calendar')}<span><strong>${issued}</strong> книг на руках</span></div></div><div class="page-tabs"><button data-admin-tab="reservations" class="${adminFilters.tab === 'reservations' ? 'active' : ''}" aria-pressed="${adminFilters.tab === 'reservations'}">Бронирования <span>${state.reservations.length}</span></button><button data-admin-tab="books" class="${adminFilters.tab === 'books' ? 'active' : ''}" aria-pressed="${adminFilters.tab === 'books'}">Книжный фонд <span>${state.books.length}</span></button></div><section class="admin-panel" aria-label="Управление библиотекой"><div class="catalog-toolbar"><div class="search-field">${icon('search')}<label class="visually-hidden" for="admin-search">Поиск по книгам и читателям</label><input id="admin-search" type="search" placeholder="${adminFilters.tab === 'books' ? 'Название, автор или ISBN' : 'Книга, читатель или номер брони'}" value="${e(adminFilters.query)}"/></div>${
    adminFilters.tab === 'reservations'
      ? `<label><span class="visually-hidden">Статус бронирования</span><select id="admin-status"><option value="all">Все статусы</option>${Object.entries(
          statusLabels,
        )
          .map(
            ([status, label]) =>
              `<option value="${status}" ${status === adminFilters.status ? 'selected' : ''}>${label}</option>`,
          )
          .join('')}</select></label>`
      : ''
  }</div><div id="admin-results"></div></section>`;
}
export function renderAdminResults(state) {
  const query = adminFilters.query.trim().toLocaleLowerCase('ru');
  if (adminFilters.tab === 'books') {
    const books = state.books.filter((book) =>
      `${book.title} ${book.author} ${book.isbn}`.toLocaleLowerCase('ru').includes(query),
    );
    document.querySelector('#admin-results').innerHTML = books.length
      ? `<div class="table-container"><table><caption class="visually-hidden">Книжный фонд</caption><thead><tr><th>Книга</th><th>Жанр</th><th>Доступно / всего</th><th><span class="visually-hidden">Действия</span></th></tr></thead><tbody>${books.map((book) => `<tr><td data-label="Книга"><div class="table-book">${cover(book)}<div><strong>${e(book.title)}</strong><small>${e(book.author)}</small></div></div></td><td data-label="Жанр">${e(book.genre)}</td><td data-label="Экземпляры"><span class="copy-count">${availableCopies(state, book.id)} <span>/ ${book.copies}</span></span></td><td class="table-actions"><button class="icon-button" data-edit-book="${e(book.id)}" aria-label="Редактировать: ${e(book.title)}">${icon('edit')}</button><button class="icon-button danger" data-delete-book="${e(book.id)}" aria-label="Удалить: ${e(book.title)}">${icon('trash')}</button></td></tr>`).join('')}</tbody></table></div>`
      : emptyState('Книги не найдены', 'Измените поисковый запрос или добавьте новую книгу.');
  } else {
    const rows = state.reservations.filter((item) => {
      const book = state.books.find((book) => book.id === item.bookId);
      return (
        `${book.title} ${item.name} ${item.email} ${item.id}`
          .toLocaleLowerCase('ru')
          .includes(query) &&
        (adminFilters.status === 'all' || adminFilters.status === item.status)
      );
    });
    document.querySelector('#admin-results').innerHTML = rows.length
      ? `<div class="table-container"><table class="reservations-table"><caption class="visually-hidden">Заявки читателей</caption><thead><tr><th>Книга / читатель</th><th>Получение</th><th>Статус</th><th>Действие</th></tr></thead><tbody>${rows
          .map((item) => {
            const book = state.books.find((book) => book.id === item.bookId);
            const actions = {
              pending: ['ready', 'Подготовить'],
              ready: ['issued', 'Выдать книгу'],
              issued: ['returned', 'Принять возврат'],
            };
            const action = actions[item.status];
            return `<tr><td data-label="Книга / читатель"><strong>${e(book.title)}</strong><small>${e(item.name)} · ${e(item.email)}</small><small>№ ${item.id.slice(0, 8).toUpperCase()}</small></td><td data-label="Получение">${dateLabel(item.pickup)}</td><td data-label="Статус">${statusBadge(item.status)}</td><td class="table-actions">${action ? `<button class="button secondary small-button" data-transition="${e(item.id)}" data-next="${action[0]}">${action[1]}</button>` : '<span class="muted">Завершено</span>'}${['pending', 'ready'].includes(item.status) ? `<button class="icon-button danger" data-cancel="${e(item.id)}" aria-label="Отменить бронь ${item.id.slice(0, 8)}">${icon('close')}</button>` : ''}</td></tr>`;
          })
          .join('')}</tbody></table></div>`
      : emptyState(
          'Всё спокойно на полках',
          state.reservations.length
            ? 'По выбранным условиям заявок нет. Измените поиск или статус.'
            : 'Новые заявки появятся здесь, когда читатель забронирует книгу.',
        );
  }
}
export function showBookForm(state, id) {
  const book = state.books.find((book) => book.id === id);
  const fields = [
    ['title', 'Название книги', 'text', 160],
    ['author', 'Автор', 'text', 120],
    ['isbn', 'ISBN', 'text', 25],
    ['year', 'Год издания', 'number'],
    ['pages', 'Количество страниц', 'number'],
    ['copies', 'Всего экземпляров', 'number'],
  ];
  const hints = {
    title: 'Не более 160 символов.',
    author: 'Не более 120 символов.',
    isbn: '10 или 13 цифр; пробелы и дефисы допустимы. Последний символ ISBN-10 может быть X.',
    year: `Целое число от 1 до ${new Date().getFullYear()}.`,
    pages: 'Целое число от 1 до 10 000.',
    copies: 'Целое число от 0 до 1000, включая занятые экземпляры.',
  };
  openDialog(
    `<div class="edit-book-dialog"><h2 id="dialog-title">${book ? 'Редактировать книгу' : 'Новая книга на полке'}</h2><p class="muted">${book ? 'Изменения сразу появятся в каталоге.' : 'Заполните сведения для читательского каталога.'}</p><form id="book-form" novalidate data-id="${e(id || '')}"><div class="form-row">${fields.map(([name, label, type, max]) => `<div class="field"><label for="edit-${name}">${label}</label><input id="edit-${name}" name="${name}" type="${type}" ${type === 'number' ? `min="${name === 'copies' ? 0 : 1}" max="${name === 'year' ? new Date().getFullYear() : name === 'pages' ? 10000 : 1000}" step="1"` : `maxlength="${max}"`} value="${e(book?.[name] ?? (name === 'copies' ? 1 : ''))}" required aria-describedby="edit-${name}-hint edit-${name}-error"/><small class="field-hint" id="edit-${name}-hint">${hints[name]}</small><span class="field-error" id="edit-${name}-error" data-field-error="${name}"></span></div>`).join('')}</div><div class="field"><label for="edit-genre">Жанр</label><select id="edit-genre" name="genre" aria-describedby="edit-genre-error">${genres.map((genre) => `<option ${book?.genre === genre ? 'selected' : ''}>${genre}</option>`).join('')}</select><span class="field-error" id="edit-genre-error" data-field-error="genre"></span></div><div class="field"><label for="edit-description">Описание</label><textarea id="edit-description" name="description" rows="3" maxlength="1500" aria-describedby="edit-description-hint edit-description-error">${e(book?.description || '')}</textarea><small class="field-hint" id="edit-description-hint">Необязательно. Не более 1500 символов.</small><span class="field-error" id="edit-description-error" data-field-error="description"></span></div><p id="book-form-error" class="form-status" role="alert"></p><div class="dialog-actions"><button class="button secondary" type="button" data-close-dialog>Отмена</button><button class="button primary" type="submit">${book ? 'Сохранить изменения' : 'Добавить книгу'}${icon('check')}</button></div></form></div>`,
  );
}
