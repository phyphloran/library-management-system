import { genres } from '../data/books.js';
import { addDays, localDate, dateLabel } from '../shared/html.js';

export class ValidationError extends Error {
  constructor(fields) {
    super(Object.values(fields)[0]);
    this.name = 'ValidationError';
    this.fields = fields;
  }
}

export function validateBookFields(input, { books = [], id, reserved = 0 } = {}) {
  const errors = {};
  const title = String(input.title || '').trim();
  const author = String(input.author || '').trim();
  const isbn = String(input.isbn || '').trim();
  const normalizedIsbn = isbn.replace(/[ -]/g, '').toUpperCase();
  if (!title) errors.title = 'Укажите название книги.';
  else if (title.length > 160) errors.title = 'Сократите название книги до 160 символов.';
  if (!author) errors.author = 'Укажите автора книги.';
  else if (author.length > 120) errors.author = 'Сократите имя автора до 120 символов.';
  if (!isbn) errors.isbn = 'Укажите ISBN книги: 10 или 13 цифр.';
  else if (!/^[\dXx -]+$/.test(isbn) || !/^(?:\d{9}[\dX]|\d{13})$/.test(normalizedIsbn)) {
    errors.isbn =
      'ISBN должен содержать 10 или 13 цифр. Пробелы и дефисы допустимы; в ISBN-10 последний символ может быть X.';
  } else {
    const duplicate = books.find(
      (book) => book.id !== id && book.isbn.replace(/[ -]/g, '').toUpperCase() === normalizedIsbn,
    );
    if (duplicate)
      errors.isbn = `ISBN уже указан у книги «${duplicate.title}». Откройте её для редактирования или укажите другой ISBN.`;
  }
  const year = new Date().getFullYear();
  for (const [name, label, min, max] of [
    ['year', 'Год издания', 1, year],
    ['pages', 'Количество страниц', 1, 10000],
    ['copies', 'Количество экземпляров', 0, 1000],
  ]) {
    const raw = input[name];
    if (raw == null || String(raw).trim() === '') errors[name] = `Укажите ${label.toLowerCase()}.`;
    else if (!Number.isInteger(Number(raw)))
      errors[name] = `${label}: введите целое число без дробной части.`;
    else if (name === 'year' && Number(raw) > max)
      errors[name] = `Год издания не может быть позже ${year}. Укажите год от 1 до ${year}.`;
    else if (Number(raw) < min || Number(raw) > max)
      errors[name] = `${label}: укажите число от ${min} до ${max}.`;
  }
  if (!errors.copies && Number(input.copies) < reserved) {
    errors.copies = `Нельзя указать меньше ${reserved} экз.: они уже забронированы или выданы. Увеличьте количество или сначала оформите возврат либо отмену брони.`;
  }
  if (!genres.includes(input.genre)) errors.genre = 'Выберите жанр книги из списка.';
  if (String(input.description || '').trim().length > 1500)
    errors.description = 'Сократите описание до 1500 символов.';
  return errors;
}

export function validateReservationFields({ name, email, pickup, consent }) {
  const errors = {};
  const readerName = typeof name === 'string' ? name.trim() : '';
  const readerEmail = typeof email === 'string' ? email.trim() : '';
  if (!readerName) errors.name = 'Укажите ваше имя.';
  else if (readerName.length < 2) errors.name = 'Имя должно содержать не менее 2 символов.';
  else if (readerName.length > 100) errors.name = 'Сократите имя до 100 символов.';
  if (!readerEmail) errors.email = 'Укажите электронную почту.';
  else if (readerEmail.length > 150)
    errors.email = 'Электронная почта должна содержать не более 150 символов.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(readerEmail))
    errors.email = 'Введите почту в формате reader@example.com: имя, знак @ и домен с точкой.';
  const date =
    typeof pickup === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(pickup)
      ? new Date(`${pickup}T12:00:00`)
      : new Date(NaN);
  const today = localDate();
  const lastDay = addDays(7);
  if (!pickup) errors.pickup = 'Выберите дату получения книги.';
  else if (Number.isNaN(date.getTime()) || localDate(date) !== pickup)
    errors.pickup = 'Укажите существующую дату получения книги.';
  else if (pickup < today)
    errors.pickup = `Дата получения уже прошла. Выберите дату с ${dateLabel(today)} по ${dateLabel(lastDay)}.`;
  else if (pickup > lastDay)
    errors.pickup = `Забронировать получение можно только на ближайшие 7 дней: с ${dateLabel(today)} по ${dateLabel(lastDay)}.`;
  if (!consent) errors.consent = 'Отметьте согласие на обработку данных, чтобы оформить бронь.';
  return errors;
}
