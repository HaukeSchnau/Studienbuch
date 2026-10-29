/** The browser's own dialog, until the web chrome has its `<dialog>` (design-language.md, section 3). */
export const confirm = (title: string, message: string, _action: string) =>
  Promise.resolve(window.confirm(`${title}\n\n${message}`));
