// Tiny, SAFE arithmetic expression evaluator (no eval()).
// Supports: numbers, + - * / % ^, parentheses, unary minus. Used by the calculator tool.
const TOKEN_RE = /\s*([0-9]+(?:\.[0-9]+)?|\.\d+|[+\-*/%^()])\s*/g;

function tokenize(expr) {
  const tokens = [];
  let m; let last = 0;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(expr)) !== null) {
    if (m.index !== last) throw new Error(`Invalid character at position ${last}`);
    tokens.push(m[1]);
    last = TOKEN_RE.lastIndex;
  }
  if (last !== expr.length) throw new Error(`Invalid character at position ${last}`);
  return tokens;
}

function parse(tokens) {
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parseExpr() {
    let v = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = next();
      const r = parseTerm();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  function parseTerm() {
    let v = parseFactor();
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = next();
      const r = parseFactor();
      if (op === '*') v *= r;
      else if (op === '/') { if (r === 0) throw new Error('Division by zero'); v /= r; }
      else v %= r;
    }
    return v;
  }
  function parseFactor() {
    let v = parseUnary();
    while (peek() === '^') { next(); v = Math.pow(v, parseUnary()); }
    return v;
  }
  function parseUnary() {
    if (peek() === '-') { next(); return -parseUnary(); }
    if (peek() === '+') { next(); return parseUnary(); }
    return parsePrimary();
  }
  function parsePrimary() {
    const t = next();
    if (t === '(') {
      const v = parseExpr();
      if (next() !== ')') throw new Error('Missing closing parenthesis');
      return v;
    }
    const n = Number(t);
    if (Number.isNaN(n)) throw new Error(`Unexpected token "${t}"`);
    return n;
  }
  const result = parseExpr();
  if (pos !== tokens.length) throw new Error(`Unexpected token "${peek()}"`);
  return result;
}

export function evaluateExpression(expr) {
  if (typeof expr !== 'string' || !expr.trim()) throw new Error('Empty expression');
  if (expr.length > 200) throw new Error('Expression too long');
  const tokens = tokenize(expr);
  if (tokens.length === 0) throw new Error('Empty expression');
  const result = parse(tokens);
  if (!Number.isFinite(result)) throw new Error('Result is not finite');
  // Round floating noise
  return Math.round(result * 1e10) / 1e10;
}
