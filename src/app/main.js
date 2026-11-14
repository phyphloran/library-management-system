import '../styles/main.css';
import '../styles/refinements.css';
import { shell } from '../components/shell.js';
import {
  catalogPage,
  catalogFilters,
  renderBooks,
  showBookDetails,
} from '../features/catalog/catalog.js';
import { reservationPage, successDialog } from '../features/reservations/reservations.js';
import {
  adminPage,
  adminFilters,
  renderAdminResults,
  showBookForm,
} from '../features/admin/admin.js';
import {
  createLibrary,
  reserveBook,
  transitionReservation,
  saveBook,
  deleteBook,
  STORAGE_KEY,
} from '../services/library.js';
import { openDialog, closeDialog, setupDialog, toast } from '../components/ui.js';
import { escapeHtml as e, addDays, dateLabel } from '../shared/html.js';
import { clearFormErrors, showFormError } from '../components/form-errors.js';

const library = createLibrary();
const app = document.querySelector('#app');
let reservationFilter = 'active';
let currentRoute;
function syncNavigation() {
  const sidebar = document.querySelector('.sidebar');
  if (sidebar)
    sidebar.inert = matchMedia('(max-width: 760px)').matches && !sidebar.classList.contains('open');
}
function route() {
  const [path, query] = location.hash.slice(2).split('?');
  return {
    page: ['catalog', 'reservations', 'admin'].includes(path) ? path : 'catalog',
    bookId: new URLSearchParams(query).get('book'),
  };
}
function render({ focus = false } = {}) {
  const { page, bookId } = route();
  currentRoute = page;
  app.innerHTML = shell(page, library.state);
  const main = document.querySelector('#main');
  main.innerHTML =
    page === 'catalog'
      ? catalogPage(library.state)
      : page === 'reservations'
        ? reservationPage(library.state, bookId, reservationFilter)
        : adminPage(library.state);
  if (page === 'catalog') renderBooks(library.state);
  if (page === 'admin') renderAdminResults(library.state);
  syncNavigation();
  document.title = `Переплёт — ${page === 'catalog' ? 'каталог книг' : page === 'admin' ? 'кабинет библиотекаря' : bookId ? 'бронирование книги' : 'мои бронирования'}`;
  if (focus) {
    main.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
}
function mutate(action, message, redraw = true) {
  try {
    const result = library.commit(action);
    if (redraw) render();
    if (message) toast(message);
    return { ok: true, result };
  } catch (error) {
    toast(error.message);
    return { ok: false };
  }
}
function resetFilters() {
  Object.assign(catalogFilters, {
    query: '',
    genre: 'all',
    available: false,
    favorites: false,
    sort: 'popular',
  });
  render();
}
function confirmAction(title, message, button, action, feedback) {
  openDialog(
    `<div class="confirm-dialog"><h2 id="dialog-title">${e(title)}</h2><p>${e(message)}</p><div class="dialog-actions"><button class="button secondary" data-close-dialog>Оставить как есть</button><button class="button primary" id="confirm-action">${e(button)}</button></div></div>`,
  );
  document.querySelector('#confirm-action').addEventListener('click', () => {
    if (mutate(action, feedback).ok) closeDialog();
  });
}
document.addEventListener('click', (event) => {
  const target = event.target.closest('button, a');
  if (!target) return;
  if (target.hasAttribute('data-menu')) {
    const expanded = target.getAttribute('aria-expanded') !== 'true';
    target.setAttribute('aria-expanded', String(expanded));
    target.setAttribute('aria-label', expanded ? 'Закрыть меню' : 'Открыть меню');
    document.querySelector('.sidebar').classList.toggle('open', expanded);
    syncNavigation();
    return;
  }
  if (target.hasAttribute('data-browse')) {
    event.preventDefault();
    document.querySelector('#book-list').scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      block: 'start',
    });
    document.querySelector('#book-search').focus({ preventScroll: true });
  }
  if (target.dataset.details) showBookDetails(library.state, target.dataset.details);
  if (target.dataset.reserve) {
    closeDialog();
    location.hash = `/reservations?book=${encodeURIComponent(target.dataset.reserve)}`;
  }
  if (target.dataset.favorite) {
    const id = target.dataset.favorite;
    const saved = library.state.favorites.includes(id);
    if (
      mutate(
        (state) => {
          state.favorites = saved
            ? state.favorites.filter((item) => item !== id)
            : [...state.favorites, id];
        },
        saved ? 'Книга убрана из избранного' : 'Книга добавлена в избранное',
        false,
      ).ok
    ) {
      if (catalogFilters.favorites) renderBooks(library.state);
      else {
        target.classList.toggle('saved', !saved);
        target.setAttribute('aria-pressed', String(!saved));
        const book = library.state.books.find((book) => book.id === id);
        target.setAttribute(
          'aria-label',
          `${saved ? 'Добавить в избранное' : 'Убрать из избранного'}: ${book.title}`,
        );
      }
    }
  }
  if (target.hasAttribute('data-genre')) {
    catalogFilters.genre = target.dataset.genre;
    document.querySelectorAll('[data-genre]').forEach((button) => {
      button.classList.toggle('selected', button === target);
      button.setAttribute('aria-pressed', String(button === target));
    });
    renderBooks(library.state);
  }
  if (target.hasAttribute('data-favorites')) {
    catalogFilters.favorites = !catalogFilters.favorites;
    target.classList.toggle('selected', catalogFilters.favorites);
    target.setAttribute('aria-pressed', String(catalogFilters.favorites));
    renderBooks(library.state);
  }
  if (target.hasAttribute('data-reset-filters')) resetFilters();
  if (target.hasAttribute('data-load-more')) renderBooks(library.state, { append: true });
  if (target.dataset.reservationFilter) {
    reservationFilter = target.dataset.reservationFilter;
    render();
  }
  if (target.dataset.adminTab) {
    adminFilters.tab = target.dataset.adminTab;
    adminFilters.query = '';
    render();
  }
  if (target.hasAttribute('data-add-book')) showBookForm(library.state);
  if (target.dataset.editBook) showBookForm(library.state, target.dataset.editBook);
  if (target.dataset.deleteBook)
    confirmAction(
      'Удалить книгу из каталога?',
      'Удаление доступно только для книг без истории бронирований.',
      'Удалить книгу',
      (state) => deleteBook(state, target.dataset.deleteBook),
      'Книга удалена из каталога',
    );
  if (target.dataset.cancel)
    confirmAction(
      'Отменить бронирование?',
      'Книга снова станет доступна в каталоге. Вы сможете забронировать её позже.',
      'Отменить бронь',
      (state) => transitionReservation(state, target.dataset.cancel, 'cancelled'),
      'Бронирование отменено',
    );
  if (target.dataset.transition)
    mutate(
      (state) => transitionReservation(state, target.dataset.transition, target.dataset.next),
      {
        ready: 'Книга подготовлена к выдаче',
        issued: 'Книга выдана читателю',
        returned: 'Возврат принят. Книга снова на полке',
      }[target.dataset.next],
    );
  if (target.hasAttribute('data-success-close')) {
    closeDialog();
    render({ focus: true });
  }
});
document.addEventListener('input', (event) => {
  if (event.target.id === 'book-search') {
    catalogFilters.query = event.target.value;
    renderBooks(library.state);
  }
  if (event.target.id === 'admin-search') {
    adminFilters.query = event.target.value;
    renderAdminResults(library.state);
  }
});
document.addEventListener('change', (event) => {
  if (event.target.id === 'book-sort') {
    catalogFilters.sort = event.target.value;
    renderBooks(library.state);
  }
  if (event.target.id === 'available-filter') {
    catalogFilters.available = event.target.checked;
    renderBooks(library.state);
  }
  if (event.target.id === 'admin-status') {
    adminFilters.status = event.target.value;
    renderAdminResults(library.state);
  }
  if (event.target.id === 'pickup-date' && event.target.value && event.target.validity.valid)
    document.querySelector('#due-preview').textContent = dateLabel(
      addDays(14, new Date(`${event.target.value}T12:00:00`)),
    );
});
document.addEventListener('submit', (event) => {
  if (event.target.id === 'reservation-form') {
    event.preventDefault();
    const form = event.target;
    const values = Object.fromEntries(new FormData(form));
    clearFormErrors(form);
    try {
      const item = library.commit((state) =>
        reserveBook(state, {
          ...values,
          consent: Boolean(values.consent),
          bookId: form.dataset.bookId,
        }),
      );
      reservationFilter = 'active';
      history.replaceState(null, '', '#/reservations');
      render({ focus: true });
      openDialog(successDialog(library.state, item));
    } catch (error) {
      showFormError(form, error);
    }
  }
  if (event.target.id === 'book-form') {
    event.preventDefault();
    const form = event.target;
    clearFormErrors(form);
    try {
      library.commit((state) =>
        saveBook(state, Object.fromEntries(new FormData(form)), form.dataset.id || undefined),
      );
      closeDialog();
      adminFilters.tab = 'books';
      adminFilters.query = '';
      if (currentRoute !== 'admin') location.hash = '/admin';
      else render();
      toast(form.dataset.id ? 'Изменения сохранены' : 'Книга добавлена в каталог');
    } catch (error) {
      showFormError(form, error);
    }
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    document.querySelector('.sidebar')?.classList.remove('open');
    const menu = document.querySelector('[data-menu]');
    if (menu) {
      menu.setAttribute('aria-expanded', 'false');
      menu.setAttribute('aria-label', 'Открыть меню');
    }
    syncNavigation();
  }
});
window.addEventListener('resize', syncNavigation);
window.addEventListener('hashchange', () => {
  closeDialog();
  render({ focus: true });
});
window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY || event.key === null) {
    library.reload();
    render();
    toast('Данные обновлены из другой вкладки');
  }
});
setupDialog();
render();
if (library.warning) toast(library.warning);
