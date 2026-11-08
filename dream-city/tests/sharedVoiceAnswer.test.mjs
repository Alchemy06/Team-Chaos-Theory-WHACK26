import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

// (added) Exercise speech handoff and answer isolation with fake hooks, timers and microphone.
function harness(supported = true) {
  const slots = [], pending = [], timers = new Map();
  let cursor = 0, tree, microphone, timerId = 0, stops = 0;
  const original = { record: { answers: ["Original journal answer"] }, setAnswer: () => { throw new Error("Original answer must not change"); } };
  const props = { question: "What do you remember about the garden?", index: 0, aiQuestion: true, value: "Earlier detail.", allowRating: false,
    onChange(value) { props.value = value; } };
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial; return [slots[i], (next) => { slots[i] = typeof next === "function" ? next(slots[i]) : next; }]; },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useEffect(effect, deps) {
      const i = cursor++;
      if (!slots[i] || deps.some((dep, n) => dep !== slots[i].deps[n])) pending.push(() => {
        slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: effect() };
      });
    },
  };
  const QuestionSpeech = () => null;
  const mocks = {
    react,
    "react/jsx-runtime": require("react/jsx-runtime"),
    "@/services/speech": { speechSupported: () => supported, startDictation: (callbacks) => { microphone = callbacks; return () => { stops++; }; } },
    "@/store/useCityStore": { useCityStore: (select) => select(original) },
    "./QuestionSpeech": { QuestionSpeech },
    "./ui/Pixel": { cx: (...values) => values.filter(Boolean).join(" ") },
  };
  const source = ts.transpileModule(readFileSync("components/hud/VoiceQuestionAnswer.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(`(function(require,module,exports){${source}\n})`, {
    setTimeout(callback) { const id = ++timerId; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); }, window: {},
  })((name) => { assert.ok(mocks[name], `Unexpected import: ${name}`); return mocks[name]; }, module, module.exports);
  const render = () => { cursor = 0; tree = module.exports.VoiceAnswerInput(props); while (pending.length) pending.shift()(); return tree; };
  function all(node) {
    if (!node || typeof node !== "object") return [];
    if (Array.isArray(node)) return node.flatMap(all);
    return [node, ...all(node.props?.children)];
  }
  render();
  return {
    props, original, render,
    find: (match) => all(tree).find(match),
    get microphone() { return microphone; }, get stops() { return stops; },
    play() { const audio = all(tree).find((node) => node.type === QuestionSpeech); audio.props.onBeforeSpeak(); audio.props.onFinished(); for (const [id, callback] of [...timers]) { timers.delete(id); callback(); } },
    dispose() { for (const slot of slots) slot?.cleanup?.(); },
  };
}

test("spoken answers append to Re-explore's value without changing the original journal", () => {
  const h = harness();
  h.play();
  h.microphone.onText("The garden felt familiar.", "");
  assert.equal(h.props.value, "Earlier detail. The garden felt familiar.");
  assert.equal(h.original.record.answers[0], "Original journal answer");
  h.dispose();
});

test("switching to Type retains dictation and ignores late microphone events", () => {
  const h = harness(); h.play();
  const old = h.microphone;
  old.onText("Flowers.", "");
  h.render();
  h.find((node) => node.type === "button" && node.props.children === "Type").props.onClick();
  h.render();
  const input = h.find((node) => node.type === "textarea");
  assert.equal(input.props.readOnly, false);
  assert.equal(input.props.value, "Earlier detail. Flowers.");
  old.onText("Late speech must be ignored.", "");
  assert.equal(h.props.value, "Earlier detail. Flowers.");
  input.props.onChange({ target: { value: "Edited with the keyboard." } });
  assert.equal(h.props.value, "Edited with the keyboard.");
  h.dispose();
});

test("moving away stops the microphone and discards late dictation", () => {
  const h = harness(); h.play(); const old = h.microphone;
  h.dispose(); const value = h.props.value;
  assert.ok(h.stops > 0);
  old.onText("Should not be saved.", "");
  assert.equal(h.props.value, value);
});

test("browsers without dictation still show an editable keyboard answer", () => {
  const h = harness(false);
  assert.equal(h.find((node) => node.type === "textarea").props.readOnly, false);
  assert.equal(h.microphone, undefined);
  h.dispose();
});

test("manual Mic retry clears only the current answer and replaces the old recording", () => {
  const h = harness();
  h.find((node) => node.type === "button" && node.props["aria-label"] === "Start answer microphone").props.onClick();
  assert.equal(h.props.value, "");
  h.microphone.onText("A completely new answer.", "");
  assert.equal(h.props.value, "A completely new answer.");
  assert.equal(h.original.record.answers[0], "Original journal answer");
  h.dispose();
});

test("Stop mic preserves the answer until a fresh recording is requested", () => {
  const h = harness(); h.play(); h.microphone.onStart();
  h.microphone.onText("Flowers.", ""); h.render();
  h.find((node) => node.type === "button" && node.props["aria-label"] === "Stop answer microphone").props.onClick();
  assert.equal(h.props.value, "Earlier detail. Flowers.");
  h.render();
  h.find((node) => node.type === "button" && node.props["aria-label"] === "Start answer microphone").props.onClick();
  assert.equal(h.props.value, "");
  h.dispose();
});

// (added) Exercise the opening dream's actual handler with its recording dependencies mocked.
function openingMicrophone(listening = false) {
  const source = readFileSync("components/hud/RecordDreamSheet.tsx", "utf8");
  const ast = ts.createSourceFile("RecordDreamSheet.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let handler;
  function find(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "toggleMic") handler = node.initializer.getText(ast);
    ts.forEachChild(node, find);
  }
  find(ast);
  assert.ok(handler);
  const record = { transcript: "The original dream." };
  const baseRef = { current: "" }, interimRef = { current: "unfinished words" };
  let microphone, stops = 0;
  const context = {
    listening, record, baseRef, interimRef, speechRun: { current: 0 }, stopRef: { current: () => {} },
    stopMic: () => { stops++; }, setMicError() {}, setListening() {}, switchToKeyboard() {}, setInterim() {},
    setTranscript(value) { record.transcript = value; },
    startDictation(callbacks) { microphone = callbacks; return () => {}; },
  };
  const compiled = ts.transpileModule(`module.exports = ${handler}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(`(function(module){${compiled}\n})`, context)(module);
  return { toggle: module.exports, record, interimRef, get microphone() { return microphone; }, get stops() { return stops; } };
}

test("manual opening-dream retry clears old text and interim speech", () => {
  const h = openingMicrophone();
  h.toggle(true);
  assert.equal(h.record.transcript, "");
  assert.equal(h.interimRef.current, "");
  h.microphone.onText("A new dream.", "");
  assert.equal(h.record.transcript, "A new dream.");
});

test("automatic opening-dream listening and Stop keep existing text", () => {
  const h = openingMicrophone();
  h.toggle();
  assert.equal(h.record.transcript, "The original dream.");
  h.microphone.onText("More details.", "");
  assert.equal(h.record.transcript, "The original dream. More details.");
  const active = openingMicrophone(true);
  active.toggle(true);
  assert.equal(active.record.transcript, "The original dream.");
  assert.equal(active.stops, 1);
});
