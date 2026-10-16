// DOM simulado (jsdom) e depois o pacote gerado por build.mjs. argv[2] = pasta das dependências.
const path = require("node:path");
const DEPS = path.resolve(process.argv[2]);
const { JSDOM } = require(require.resolve("jsdom", { paths: [DEPS] }));
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/", pretendToBeVisual: true });
const w = dom.window;
for (const k of Object.getOwnPropertyNames(w)) { if (!(k in globalThis)) { try { globalThis[k] = w[k]; } catch {} } }
for (const k of ["Event","CustomEvent","EventTarget","KeyboardEvent","MouseEvent","PointerEvent","FocusEvent","InputEvent","UIEvent","MutationObserver","Element","DocumentFragment","getComputedStyle","requestAnimationFrame","cancelAnimationFrame"]) { if (w[k]) globalThis[k] = w[k]; }
globalThis.window = w; globalThis.document = w.document; globalThis.navigator = w.navigator;
globalThis.HTMLElement = w.HTMLElement; globalThis.Node = w.Node;
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
w.ResizeObserver = globalThis.ResizeObserver;
w.HTMLElement.prototype.scrollIntoView = function () {};
w.HTMLElement.prototype.hasPointerCapture = () => false;
w.HTMLElement.prototype.releasePointerCapture = () => {};
w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
globalThis.matchMedia = w.matchMedia;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
require(path.join(DEPS, "runner-os-status.cjs"));
