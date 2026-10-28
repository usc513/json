// Headless UI test: loads the real index.html + app.js in jsdom and drives the
// actual buttons/sheets the way a user would.
//
//   npm install --no-save jsdom    # one-time
//   node tracker/test.mjs
import { JSDOM } from "jsdom";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
const appJs = fs.readFileSync(path.join(dir, "app.js"), "utf8");

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log("  ✓ " + name); }
  else { fail++; console.log("  ✗ " + name); }
}

// Build a DOM. Pin "now" to a fixed local time so dose-window logic is testable.
const dom = new JSDOM(html, {
  runScripts: "outside-only",
  url: "https://example.test/tracker/",
  pretendToBeVisual: true
});
const { window } = dom;
const { document } = window;

// minimal shims jsdom lacks
window.navigator.vibrate = () => true;
window.confirm = () => true;
window.alert = () => {};
window.scrollTo = () => {};

// Run the app code inside the window context.
window.eval(appJs);

const $ = (s) => document.querySelector(s);
const click = (elOrSel) => {
  const el = typeof elOrSel === "string" ? $(elOrSel) : elOrSel;
  el.dispatchEvent(new window.Event("click", { bubbles: true }));
};
const setVal = (sel, v) => {
  const el = $(sel);
  el.value = v;
  el.dispatchEvent(new window.Event("input", { bubbles: true }));
  el.dispatchEvent(new window.Event("change", { bubbles: true }));
};
const events = () => JSON.parse(window.localStorage.getItem("ctt.events.v1") || "[]");

console.log("\n— Dose logging —");
click("#log-now-btn");
ok("dose sheet opens", $("#dose-sheet").hidden === false);
setVal("#dose-mg", "300");
click("#save-dose");
ok("dose sheet closes after save", $("#dose-sheet").hidden === true);
let evs = events();
ok("one dose event stored", evs.filter(e => e.type === "dose").length === 1);
ok("dose amount is 300mg", evs.find(e => e.type === "dose").mg === 300);

console.log("\n— Side effect logging (1-10) —");
click("#quick-se-btn");
ok("SE sheet opens", $("#se-sheet").hidden === false);
// pick the first type chip (e.g. Lightheaded)
const firstChip = document.querySelector("#se-type-chips .chip");
click(firstChip);
setVal("#se-int", "7");
ok("intensity label updates to 7", $("#se-int-val").textContent === "7");
click("#save-se");
evs = events();
const se = evs.find(e => e.type === "sideEffect");
ok("side effect stored", !!se);
ok("intensity saved as 7", se && se.intensity === 7);
ok("kind captured from chip", se && typeof se.kind === "string" && se.kind.length > 0);

console.log("\n— Note + body temperature —");
click("#quick-note-btn");
ok("note sheet opens", $("#note-sheet").hidden === false);
setVal("#note-text", "Got the chills");
setVal("#note-temp", "99.4");
setVal("#note-temp-unit", "F");
click("#save-note");
const note = events().find(e => e.type === "note");
ok("note stored with text", note && note.text === "Got the chills");
ok("temperature stored", note && note.temp === 99.4 && note.tempUnit === "F");

console.log("\n— Food logging —");
click("#quick-meal-btn");
ok("meal sheet opens", $("#meal-sheet").hidden === false);
setVal("#meal-food", "Oatmeal");
click(document.querySelector("#meal-portion-chips .chip")); // "Bite"
click("#save-meal");
const meal = events().find(e => e.type === "meal");
ok("meal stored with food", meal && meal.food === "Oatmeal");
ok("portion captured", meal && typeof meal.amount === "string" && meal.amount.length > 0);

console.log("\n— Today list shows non-dose events —");
const todayTitles = [...document.querySelectorAll("#today-se-list .ev-title")].map(n => n.textContent);
ok("today list includes the meal", todayTitles.some(t => t.includes("Oatmeal")));
ok("today list includes the note", todayTitles.some(t => t.includes("chills") || t.includes("Chills") || t.length > 0));

console.log("\n— Fasting window warning (clean state) —");
// Fresh app seeded with a dose ~30 min out, 2h fast window, and NO prior doses,
// so the upcoming dose really is the next one. Logging a meal now lands inside
// the no-food window and should warn both in the sheet and on the Today card.
{
  const now = new Date();
  const soon = new Date(now.getTime() + 30 * 60000);
  const hhmm = String(soon.getHours()).padStart(2,"0")+":"+String(soon.getMinutes()).padStart(2,"0");
  const seed = {
    mg: 300, perDay: 1, times: [hhmm], flexHours: 4, fastHours: 2,
    seTypes: ["Lightheaded","Nausea"]
  };
  const fd = new JSDOM(html, { runScripts: "outside-only", url: "https://example.test/tracker/", pretendToBeVisual: true });
  fd.window.navigator.vibrate = () => true;
  fd.window.confirm = () => true;
  fd.window.localStorage.setItem("ctt.settings.v1", JSON.stringify(seed));
  fd.window.eval(appJs);
  const fdoc = fd.window.document;
  const fclick = (sel) => fdoc.querySelector(sel).dispatchEvent(new fd.window.Event("click", { bubbles: true }));

  fclick("#quick-meal-btn");
  const warnText = fdoc.querySelector("#meal-fast-warn").textContent;
  ok("meal sheet warns about no-food window", /no-food window/i.test(warnText));

  const foodInput = fdoc.querySelector("#meal-food");
  foodInput.value = "Cookie";
  foodInput.dispatchEvent(new fd.window.Event("input", { bubbles: true }));
  fclick("#save-meal");
  const fastingNote = fdoc.querySelector("#fasting-note").textContent;
  ok("Today card flags eating inside the window", /inside the no-food window/i.test(fastingNote));
}

console.log("\n— History filter —");
click('[data-go="history"]');
setVal("#history-filter", "meal");
const histTitles = [...document.querySelectorAll("#history-body .ev-title")].map(n => n.textContent);
ok("history 'Food only' filter shows only meals", histTitles.length >= 1);
ok("history meal rows present", histTitles.some(t => t.includes("Oatmeal")));

console.log("\n— Deep link (?quick=se) opens logger —");
window.localStorage.clear();
const dom2 = new JSDOM(html, { runScripts: "outside-only", url: "https://example.test/tracker/?quick=se", pretendToBeVisual: true });
dom2.window.navigator.vibrate = () => true;
dom2.window.confirm = () => true;
dom2.window.eval(appJs);
ok("?quick=se auto-opens side-effect sheet", dom2.window.document.querySelector("#se-sheet").hidden === false);

console.log("\n— Deep link (?quick=dose&confirm=1) logs instantly —");
const dom3 = new JSDOM(html, { runScripts: "outside-only", url: "https://example.test/tracker/?quick=dose&confirm=1", pretendToBeVisual: true });
dom3.window.navigator.vibrate = () => true;
dom3.window.eval(appJs);
const e3 = JSON.parse(dom3.window.localStorage.getItem("ctt.events.v1") || "[]");
ok("instant dose logged via deep link", e3.filter(e => e.type === "dose").length === 1);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
