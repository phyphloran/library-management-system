export function clearFormErrors(form) {
  form.querySelectorAll('[data-field-error]').forEach((element) => {
    element.textContent = '';
  });
  form
    .querySelectorAll('[aria-invalid]')
    .forEach((element) => element.removeAttribute('aria-invalid'));
  form.querySelector('[role="alert"]').textContent = '';
}

export function showFormError(form, error) {
  clearFormErrors(form);
  const status = form.querySelector('[role="alert"]');
  if (!error.fields) {
    status.textContent = error.message;
    return;
  }
  const labels = [];
  let firstInvalid;
  for (const [name, message] of Object.entries(error.fields)) {
    const field = form.elements.namedItem(name);
    if (!field) continue;
    const note = form.querySelector(`[data-field-error="${name}"]`);
    if (note) note.textContent = message;
    field.setAttribute('aria-invalid', 'true');
    labels.push(
      name === 'consent'
        ? 'Согласие на обработку данных'
        : field.labels?.[0]?.textContent.trim() || name,
    );
    firstInvalid ??= field;
  }
  status.textContent = `Исправьте поля: ${labels.join(', ')}.`;
  firstInvalid?.focus();
}
