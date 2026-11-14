import { icon } from '../shared/icons.js';
import { escapeHtml as e } from '../shared/html.js';
import { availableCopies, statusLabels } from '../services/library.js';

export function availability(state, book) {
  const count = availableCopies(state, book.id);
  return `<span class="availability ${count ? '' : 'unavailable'}"><span class="status-dot"></span>${count ? `В наличии · ${count} экз.` : 'Все экземпляры заняты'}</span>`;
}
export const statusBadge = (status) =>
  `<span class="status-badge status-${e(status)}">${icon(status === 'pending' ? 'clock' : 'check')}${e(statusLabels[status])}</span>`;
export const emptyState = (title, message, action = '') =>
  `<div class="empty-state">${icon('book')}<h2>${e(title)}</h2><p>${e(message)}</p>${action}</div>`;
export function toast(message) {
  const element = document.querySelector('#toast');
  clearTimeout(toast.timeout);
  element.textContent = message;
  element.classList.add('visible');
  toast.timeout = setTimeout(() => element.classList.remove('visible'), 4200);
}
let returnFocus;
export function openDialog(content) {
  const dialog = document.querySelector('#dialog');
  returnFocus = document.activeElement;
  dialog.innerHTML = `<button class="icon-button dialog-close" data-close-dialog aria-label="Закрыть окно">${icon('close')}</button>${content}`;
  if (!dialog.open) dialog.showModal();
}
export function closeDialog() {
  document.querySelector('#dialog').close();
}
export function setupDialog() {
  const dialog = document.querySelector('#dialog');
  dialog.addEventListener('click', (event) => {
    if (event.target.closest('[data-close-dialog]')) closeDialog();
    if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
        closeDialog();
    }
  });
  dialog.addEventListener('close', () => {
    if (returnFocus?.isConnected) returnFocus.focus();
  });
}
