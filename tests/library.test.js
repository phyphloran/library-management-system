import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  availableCopies,
  reserveBook,
  transitionReservation,
  saveBook,
  deleteBook,
  createLibrary,
  validateState,
  STORAGE_KEY,
  migrateCatalog,
} from '../src/services/library.js';
import { initialBooks } from '../src/data/books.js';
import { selectCatalogBooks } from '../src/features/catalog/catalog-model.js';
import { localDate, addDays, escapeHtml } from '../src/shared/html.js';

const booking = (bookId = 'prince') => ({
  bookId,
  name: 'Тестовый читатель',
  email: 'reader@example.com',
  pickup: localDate(),
  consent: true,
});
const newBook = () => ({
  title: 'Тестовая книга',
  author: 'Тестовый автор',
  isbn: '978-5-123456-78-9',
  year: 2020,
  pages: 250,
  copies: 2,
  genre: 'Наука',
  description: 'Описание',
});
test('reservation, preparation, issuance and return maintain inventory', () => {
  const state = createInitialState();
  const before = availableCopies(state, 'prince');
  const item = reserveBook(state, booking());
  assert.equal(availableCopies(state, 'prince'), before - 1);
  transitionReservation(state, item.id, 'ready');
  transitionReservation(state, item.id, 'issued');
  assert.equal(availableCopies(state, 'prince'), before - 1);
  assert.throws(() => transitionReservation(state, item.id, 'cancelled'));
  transitionReservation(state, item.id, 'returned');
  assert.equal(availableCopies(state, 'prince'), before);
  assert.equal(validateState(state), true);
});
test('cancelling restores availability and permits rebooking', () => {
  const state = createInitialState();
  const item = reserveBook(state, booking());
  assert.throws(() => reserveBook(state, booking()), /активная бронь/);
  transitionReservation(state, item.id, 'cancelled');
  assert.equal(availableCopies(state, 'prince'), 3);
  assert.doesNotThrow(() => reserveBook(state, booking()));
});
test('invalid data, unavailable and missing books are rejected without mutations', () => {
  const state = createInitialState();
  for (const input of [
    { bookId: 'dune' },
    { bookId: 'missing' },
    { name: ' ' },
    { email: 'invalid' },
    { pickup: addDays(-1) },
    { pickup: addDays(8) },
    { pickup: '2026-02-31' },
    { consent: false },
  ]) {
    assert.throws(() => reserveBook(state, { ...booking(), ...input }));
  }
  assert.equal(state.reservations.length, 0);
});
test('book CRUD validates ISBN and protects reservation history', () => {
  const state = createInitialState();
  const book = saveBook(state, newBook());
  assert.equal(availableCopies(state, book.id), 2);
  assert.throws(() => saveBook(state, newBook()), /ISBN/);
  saveBook(state, { ...newBook(), copies: 4 }, book.id);
  assert.equal(availableCopies(state, book.id), 4);
  state.favorites.push(book.id);
  deleteBook(state, book.id);
  assert.equal(state.favorites.length, 0);
  reserveBook(state, booking());
  assert.throws(() => saveBook(state, { ...state.books[0], copies: 0 }, 'prince'), /Нельзя/);
  assert.throws(() => deleteBook(state, 'prince'), /история/);
});
test('local persistence reloads correctly and storage errors roll back changes', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
  const library = createLibrary(storage);
  library.commit((state) => reserveBook(state, booking()));
  assert.equal(createLibrary(storage).state.reservations.length, 1);
  storage.setItem = () => {
    throw new Error('quota exceeded');
  };
  assert.throws(
    () =>
      library.commit((state) => {
        state.books[0].copies = 99;
      }),
    /сохранить/,
  );
  assert.equal(library.state.books[0].copies, 3);
  values.set(STORAGE_KEY, '{broken');
  const recovered = createLibrary(storage);
  assert.ok(recovered.warning);
  assert.equal(recovered.state.books.length, 30);
});
test('stored schema rejects duplicate ids, invalid statuses and orphan reservations', () => {
  const state = createInitialState();
  assert.equal(validateState(state), true);
  state.books.push(structuredClone(state.books[0]));
  assert.equal(validateState(state), false);
  const fresh = createInitialState();
  const item = reserveBook(fresh, booking());
  item.status = 'unknown';
  assert.equal(validateState(fresh), false);
});
test('user-entered markup is escaped before HTML rendering', () => {
  assert.equal(
    escapeHtml('<img src=x onerror="alert(1)">'),
    '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;',
  );
  assert.equal(escapeHtml("O'Reilly & Co"), 'O&#39;Reilly &amp; Co');
});
test('a second tab refreshes stored changes before applying its own mutation', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
  const first = createLibrary(storage);
  const second = createLibrary(storage);
  first.commit((state) => reserveBook(state, booking('prince')));
  second.commit((state) => reserveBook(state, booking('master')));
  assert.equal(second.state.reservations.length, 2);
  first.reload();
  assert.equal(first.state.reservations.length, 2);
});
test('blocked storage leaves the initial UI usable and rejects unsaved success', () => {
  const storage = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
  };
  const library = createLibrary(storage);
  assert.ok(library.warning);
  assert.equal(library.state.books.length, 30);
  assert.throws(() => library.commit((state) => reserveBook(state, booking())), /сохранить/);
  assert.equal(library.state.reservations.length, 0);
});
test('expanded catalog contains 30 unique valid book records', () => {
  const state = createInitialState();
  assert.equal(state.books.length, 30);
  assert.equal(new Set(state.books.map((book) => book.isbn)).size, 30);
  assert.equal(validateState(state), true);
});
test('legacy saves gain new books without replacing edits, reservations or favorites', () => {
  const legacy = createInitialState();
  delete legacy.catalogRevision;
  legacy.books = legacy.books.slice(0, 8).filter((book) => book.id !== 'ocean');
  legacy.books[0].title = 'Редакция библиотекаря';
  legacy.books[0].copies = 7;
  legacy.favorites.push('prince');
  reserveBook(legacy, booking());
  legacy.books.push({
    ...newBook(),
    ...initialBooks[6],
    id: 'custom',
    title: 'Книга библиотекаря',
    isbn: '978-5-123456-78-9',
  });
  const values = new Map([[STORAGE_KEY, JSON.stringify(legacy)]]);
  const storage = {
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
  };
  const library = createLibrary(storage);
  assert.equal(library.state.books.length, 30);
  assert.equal(library.state.books[0].title, 'Редакция библиотекаря');
  assert.equal(library.state.books[0].copies, 7);
  assert.equal(
    library.state.books.some((book) => book.id === 'ocean'),
    false,
  );
  assert.equal(
    library.state.books.some((book) => book.id === 'custom'),
    true,
  );
  assert.deepEqual(library.state.favorites, ['prince']);
  assert.equal(library.state.reservations.length, 1);
  library.commit((state) => deleteBook(state, 'collection-1'));
  const reloaded = createLibrary(storage);
  assert.equal(reloaded.state.books.length, 29);
  assert.equal(
    reloaded.state.books.some((book) => book.id === 'collection-1'),
    false,
  );
  reloaded.reload();
  assert.equal(reloaded.state.books.length, 29);
});
test('catalog migration does not duplicate an edition with the same ISBN', () => {
  const state = createInitialState();
  state.books = state.books.slice(0, 8);
  delete state.catalogRevision;
  state.books.push({ ...initialBooks[8], id: 'existing-edition' });
  migrateCatalog(state);
  assert.equal(state.books.length, 30);
  assert.equal(
    state.books.some((book) => book.id === 'collection-1'),
    false,
  );
  migrateCatalog(state);
  assert.equal(state.books.length, 30);
});
test('search and sorting operate on the whole catalog before pagination', () => {
  const state = createInitialState();
  const filters = { query: '', genre: 'all', available: false, favorites: false, sort: 'popular' };
  assert.equal(selectCatalogBooks(state, filters).length, 30);
  assert.equal(
    selectCatalogBooks(state, { ...filters, query: 'Альберс' })[0].title,
    'Взаимодействие цвета',
  );
  assert.equal(
    selectCatalogBooks(state, { ...filters, query: initialBooks[29].isbn })[0].id,
    'collection-22',
  );
  const fiction = selectCatalogBooks(state, { ...filters, genre: 'Художественная' });
  assert.ok(fiction.length > 10);
  state.favorites.push('collection-22');
  assert.equal(selectCatalogBooks(state, { ...filters, favorites: true })[0].id, 'collection-22');
  const sorted = selectCatalogBooks(state, { ...filters, sort: 'title' });
  assert.deepEqual(
    sorted.map((book) => book.title),
    [...sorted].sort((a, b) => a.title.localeCompare(b.title, 'ru')).map((book) => book.title),
  );
  assert.equal(state.books[0].id, 'prince');
});
