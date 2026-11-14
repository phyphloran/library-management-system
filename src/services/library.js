import { initialBooks, genres } from '../data/books.js';
import { additionalBooks } from '../data/additional-books.js';
import { addDays } from '../shared/html.js';
import { ValidationError, validateBookFields, validateReservationFields } from './validation.js';

export const STORAGE_KEY = 'pereplet-library-v1';
export const activeStatuses = ['pending', 'ready', 'issued'];
export const statusLabels = {
  pending: 'На рассмотрении',
  ready: 'Готова к выдаче',
  issued: 'На руках',
  returned: 'Возвращена',
  cancelled: 'Отменена',
};
export function createInitialState() {
  return {
    version: 1,
    catalogRevision: 2,
    books: structuredClone(initialBooks),
    reservations: [],
    favorites: [],
  };
}
export function migrateCatalog(state) {
  if ((state.catalogRevision || 1) >= 2) return state;
  const ids = new Set(state.books.map((book) => book.id));
  const isbns = new Set(state.books.map((book) => book.isbn.replace(/[ -]/g, '')));
  state.books.push(
    ...structuredClone(
      additionalBooks.filter(
        (book) => !ids.has(book.id) && !isbns.has(book.isbn.replace(/[ -]/g, '')),
      ),
    ),
  );
  state.catalogRevision = 2;
  return state;
}
export function availableCopies(state, bookId) {
  const book = state.books.find((item) => item.id === bookId);
  return book
    ? Math.max(
        0,
        book.copies -
          state.reservations.filter(
            (item) => item.bookId === bookId && activeStatuses.includes(item.status),
          ).length,
      )
    : 0;
}
export function validateState(state) {
  if (
    !state ||
    state.version !== 1 ||
    !Array.isArray(state.books) ||
    !Array.isArray(state.reservations) ||
    !Array.isArray(state.favorites)
  )
    return false;
  const ids = new Set();
  for (const book of state.books) {
    if (
      !book ||
      typeof book.id !== 'string' ||
      ids.has(book.id) ||
      !['title', 'author', 'isbn', 'description', 'color', 'ink', 'art'].every(
        (key) => typeof book[key] === 'string',
      ) ||
      !genres.includes(book.genre) ||
      !Number.isInteger(book.copies) ||
      book.copies < 0 ||
      !Number.isInteger(book.year) ||
      !Number.isInteger(book.pages)
    )
      return false;
    ids.add(book.id);
  }
  const reservationIds = new Set();
  return (
    state.favorites.every((id) => typeof id === 'string' && ids.has(id)) &&
    state.reservations.every((item) => {
      if (
        !item ||
        typeof item.id !== 'string' ||
        reservationIds.has(item.id) ||
        !ids.has(item.bookId) ||
        !Object.hasOwn(statusLabels, item.status) ||
        !['name', 'email', 'pickup', 'due', 'created'].every((key) => typeof item[key] === 'string')
      )
        return false;
      reservationIds.add(item.id);
      return /^\d{4}-\d{2}-\d{2}$/.test(item.pickup) && /^\d{4}-\d{2}-\d{2}$/.test(item.due);
    })
  );
}
export function reserveBook(state, { bookId, name, email, pickup, consent }) {
  if (!state.books.some((book) => book.id === bookId))
    throw new Error('Книга не найдена. Вернитесь в каталог.');
  if (availableCopies(state, bookId) < 1)
    throw new Error('Свободные экземпляры закончились. Выберите другую книгу.');
  if (
    state.reservations.some(
      (item) => item.bookId === bookId && activeStatuses.includes(item.status),
    )
  )
    throw new Error(
      'У вас уже есть активная бронь этой книги. Откройте «Мои бронирования», чтобы посмотреть её статус или отменить бронь до выдачи.',
    );
  const errors = validateReservationFields({ name, email, pickup, consent });
  if (Object.keys(errors).length) throw new ValidationError(errors);
  const reservation = {
    id: crypto.randomUUID(),
    bookId,
    name: name.trim(),
    email: email.trim(),
    pickup,
    due: addDays(14, new Date(`${pickup}T12:00:00`)),
    status: 'pending',
    created: new Date().toISOString(),
  };
  state.reservations.unshift(reservation);
  return reservation;
}
export function transitionReservation(state, id, next) {
  const item = state.reservations.find((reservation) => reservation.id === id);
  const transitions = {
    pending: ['ready', 'cancelled'],
    ready: ['issued', 'cancelled'],
    issued: ['returned'],
    returned: [],
    cancelled: [],
  };
  if (!item) throw new Error('Бронь не найдена. Обновите список бронирований.');
  if (!transitions[item.status]?.includes(next))
    throw new Error(
      `У брони уже статус «${statusLabels[item.status]}». Обновите список и выберите доступное действие.`,
    );
  item.status = next;
}
export function saveBook(state, input, id) {
  const title = String(input.title || '').trim();
  const author = String(input.author || '').trim();
  const copies = Number(input.copies);
  const year = Number(input.year);
  const pages = Number(input.pages);
  const isbn = String(input.isbn || '').trim();
  const reserved = state.reservations.filter(
    (item) => item.bookId === id && activeStatuses.includes(item.status),
  ).length;
  const errors = validateBookFields(input, { books: state.books, id, reserved });
  if (Object.keys(errors).length) throw new ValidationError(errors);
  const previous = state.books.find((book) => book.id === id);
  if (id && !previous)
    throw new Error('Книга не найдена. Обновите каталог и откройте запись заново.');
  const book = {
    ...(previous || {
      id: crypto.randomUUID(),
      color: '#537566',
      ink: '#f1e7c8',
      art: 'leaves',
      popularity: 50,
    }),
    title,
    author,
    copies,
    year,
    pages,
    isbn,
    genre: input.genre,
    description:
      String(input.description || '')
        .trim()
        .slice(0, 1500) || 'Описание пока не добавлено.',
  };
  if (previous) Object.assign(previous, book);
  else state.books.unshift(book);
  return book;
}
export function deleteBook(state, id) {
  if (state.reservations.some((item) => item.bookId === id))
    throw new Error(
      'У книги есть история бронирований. Вместо удаления измените количество экземпляров.',
    );
  state.books = state.books.filter((book) => book.id !== id);
  state.favorites = state.favorites.filter((bookId) => bookId !== id);
}
export function createLibrary(storage) {
  let state = createInitialState();
  let warning = '';
  try {
    storage ??= window.localStorage;
    const raw = storage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!validateState(parsed)) throw new Error('invalid data');
      state = migrateCatalog(parsed);
    }
  } catch {
    warning = 'Не удалось прочитать сохранённые данные. Открыт начальный каталог.';
  }
  return {
    get state() {
      return state;
    },
    get warning() {
      return warning;
    },
    commit(action) {
      // Refresh before mutation so another tab's reservation is never overwritten.
      try {
        const raw = storage.getItem(STORAGE_KEY);
        const latest = raw ? JSON.parse(raw) : null;
        if (latest && validateState(latest)) state = migrateCatalog(latest);
      } catch {
        /* Persistence below provides an actionable error if storage is blocked. */
      }
      const next = structuredClone(state);
      const result = action(next);
      // Commit only after persistence succeeds: the interface never reports an unsaved success.
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        throw new Error(
          'Не удалось сохранить изменения. Разрешите хранение данных в браузере или освободите место.',
        );
      }
      state = next;
      return result;
    },
    reload() {
      try {
        const raw = storage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : createInitialState();
        if (validateState(parsed)) state = migrateCatalog(parsed);
      } catch {
        /* Keep the last valid state if another tab writes invalid data. */
      }
    },
  };
}
