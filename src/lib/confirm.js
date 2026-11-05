// Promise-based confirm so hooks can ask without importing React.
// <ConfirmHost /> (in ui.jsx) registers the opener once at app start.
let opener = null;
export function registerConfirm(fn) { opener = fn; }

/** ask({ title, body, confirmLabel, danger }) resolves true or false. */
export function ask(opts) {
  if (!opener) return Promise.resolve(window.confirm(opts.title)); // before the host mounts
  return opener(opts);
}

/** Informational notice with a single button. */
export function notify(title, body) {
  if (!opener) { window.alert(`${title}\n${body || ""}`); return Promise.resolve(); }
  return opener({ title, body, confirmLabel: "OK", hideCancel: true }).then(() => undefined);
}
