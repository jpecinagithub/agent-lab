// Unique id helpers
let counter = 0;
export function uid(prefix = 'id') {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
export function shortId(prefix = 'call') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}
