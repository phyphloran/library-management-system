import { availableCopies } from '../../services/library.js';

export const PAGE_SIZE = 10;

export function selectCatalogBooks(state, filters) {
  const query = filters.query.trim().toLocaleLowerCase('ru');
  return state.books
    .filter(
      (book) =>
        (!query ||
          `${book.title} ${book.author} ${book.isbn}`.toLocaleLowerCase('ru').includes(query)) &&
        (filters.genre === 'all' || book.genre === filters.genre) &&
        (!filters.available || availableCopies(state, book.id) > 0) &&
        (!filters.favorites || state.favorites.includes(book.id)),
    )
    .sort((a, b) =>
      filters.sort === 'title'
        ? a.title.localeCompare(b.title, 'ru')
        : filters.sort === 'newest'
          ? b.year - a.year
          : b.popularity - a.popularity,
    );
}
