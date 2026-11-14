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
} from '../src/services/library.js';
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
  assert.equal(recovered.state.books.length, 8);
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
  assert.equal(library.state.books.length, 8);
  assert.throws(() => library.commit((state) => reserveBook(state, booking())), /сохранить/);
  assert.equal(library.state.reservations.length, 0);
});
