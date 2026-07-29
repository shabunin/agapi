/**
 * Some webviews (older WebKitGTK builds in particular) don't yet implement
 * the TC39 Explicit Resource Management symbols. matter.js reads/assigns
 * `obj[Symbol.dispose]` directly in its Lifetime bookkeeping (see
 * vendor/matter.js/packages/general/src/util/Lifetime.ts) — with no real,
 * stable Symbol there, `obj[Symbol.dispose]` is `undefined` and calling
 * `.bind()` on it throws deep inside CommissioningController.start().
 *
 * A plain Symbol is enough: this code path calls dispose manually (`obj[Symbol.dispose] = fn`,
 * later `obj[Symbol.dispose]()`) rather than relying on native `using`
 * syntax, so all it needs is a consistent key.
 */
if (!(Symbol as unknown as { dispose?: symbol }).dispose) {
  (Symbol as unknown as { dispose: symbol }).dispose = Symbol('Symbol.dispose');
}
if (!(Symbol as unknown as { asyncDispose?: symbol }).asyncDispose) {
  (Symbol as unknown as { asyncDispose: symbol }).asyncDispose = Symbol('Symbol.asyncDispose');
}
