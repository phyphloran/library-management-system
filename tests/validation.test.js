import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateBookFields,
  validateReservationFields,
  ValidationError,
} from '../src/services/validation.js';
import { createInitialState, saveBook, reserveBook } from '../src/services/library.js';
import { localDate, addDays } from '../src/shared/html.js';

const book = () => ({
  title: 'Новая книга',
  author: 'Автор',
  isbn: '978-5-123456-78-9',
  year: 2020,
  pages: 200,
  copies: 2,
  genre: 'Наука',
  description: '',
});
const reservation = () => ({
  bookId: 'prince',
  name: 'Читатель',
  email: 'reader@example.com',
  pickup: localDate(),
  consent: true,
});

test('empty book fields receive separate actionable errors, including empty stock', () => {
  const errors = validateBookFields({
    title: ' ',
    author: '',
    isbn: '',
    year: '',
    pages: '',
    copies: '',
    genre: '',
  });
  assert.deepEqual(Object.keys(errors), [
    'title',
    'author',
    'isbn',
    'year',
    'pages',
    'copies',
    'genre',
  ]);
  assert.match(errors.copies, /Укажите количество экземпляров/);
  assert.match(errors.isbn, /10 или 13/);
});
test('book numeric fields distinguish fractions, future years and limits', () => {
  const future = new Date().getFullYear() + 1;
  const errors = validateBookFields({ ...book(), year: future, pages: 1.5, copies: -1 });
  assert.match(errors.year, /позже/);
  assert.match(errors.pages, /без дробной/);
  assert.match(errors.copies, /от 0 до 1000/);
  for (const [name, value] of [
    ['year', 0],
    ['pages', 0],
    ['pages', 10001],
    ['copies', 1001],
  ]) {
    assert.ok(validateBookFields({ ...book(), [name]: value })[name]);
  }
  assert.deepEqual(validateBookFields({ ...book(), copies: 0 }), {});
});
test('ISBN errors identify format and the duplicate edition while allowing current records', () => {
  for (const isbn of ['123', 'abcdefghij', '123456789012', 'X123456789', '123456789012X'])
    assert.ok(validateBookFields({ ...book(), isbn }).isbn);
  assert.deepEqual(validateBookFields({ ...book(), isbn: '0-8044-2957-X' }), {});
  const state = createInitialState();
  const errors = validateBookFields(
    { ...book(), isbn: state.books[0].isbn.replaceAll('-', '') },
    { books: state.books },
  );
  assert.match(errors.isbn, /Маленький принц/);
  for (const current of state.books)
    assert.deepEqual(validateBookFields(current, { books: state.books, id: current.id }), {});
});
test('length and occupied stock errors point to the affected field without truncation', () => {
  const errors = validateBookFields(
    {
      ...book(),
      title: 'a'.repeat(161),
      author: 'a'.repeat(121),
      description: 'a'.repeat(1501),
      copies: 1,
    },
    { reserved: 2 },
  );
  assert.match(errors.title, /160/);
  assert.match(errors.author, /120/);
  assert.match(errors.description, /1500/);
  assert.match(errors.copies, /меньше 2/);
});
test('book service reports all field errors and leaves the catalog unchanged', () => {
  const state = createInitialState();
  const snapshot = structuredClone(state);
  assert.throws(
    () => saveBook(state, { ...book(), year: 9999, pages: 0, copies: '' }),
    (error) => error instanceof ValidationError && Object.keys(error.fields).length === 3,
  );
  assert.deepEqual(state, snapshot);
});
test('reservation errors distinguish missing values, format, past dates and distant dates', () => {
  assert.deepEqual(Object.keys(validateReservationFields({})), [
    'name',
    'email',
    'pickup',
    'consent',
  ]);
  assert.match(
    validateReservationFields({ ...reservation(), email: 'reader-at-example.com' }).email,
    /@/,
  );
  assert.match(
    validateReservationFields({ ...reservation(), pickup: addDays(-1) }).pickup,
    /уже прошла/,
  );
  assert.match(
    validateReservationFields({ ...reservation(), pickup: addDays(8) }).pickup,
    /7 дней/,
  );
  assert.match(
    validateReservationFields({ ...reservation(), pickup: '2026-02-31' }).pickup,
    /существующую/,
  );
  assert.match(validateReservationFields({ ...reservation(), name: 'x' }).name, /не менее 2/);
  assert.match(validateReservationFields({ ...reservation(), name: 'x'.repeat(101) }).name, /100/);
  assert.match(
    validateReservationFields({ ...reservation(), email: 'x'.repeat(151) + '@example.com' }).email,
    /150/,
  );
  assert.deepEqual(
    validateReservationFields({ ...reservation(), email: ' reader@example.com ' }),
    {},
  );
});
test('reservation service returns field-specific errors without creating a booking', () => {
  const state = createInitialState();
  assert.throws(
    () => reserveBook(state, { ...reservation(), name: '', email: 'invalid', consent: false }),
    (error) => error instanceof ValidationError && Object.keys(error.fields).length === 3,
  );
  assert.equal(state.reservations.length, 0);
});
