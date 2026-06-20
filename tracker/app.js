/*
 * Trial Tracker — a personal clinical-trial medication & side-effect log.
 *
 * Everything lives on-device in localStorage. No accounts, no servers,
 * nothing leaves the phone unless YOU export it. See README.md for the
 * iPhone reminder (Shortcuts) setup and the accelerometer notes.
 */
(function () {
  "use strict";

  // ------------------------------------------------------------------
  // Storage
  // ------------------------------------------------------------------
  var SETTINGS_KEY = "ctt.settings.v1";
  var EVENTS_KEY = "ctt.events.v1";

  var DEFAULT_SETTINGS = {
    mg: 300,
    perDay: 2,
    times: ["08:00", "20:00"],
    flexHours: 4,
    fastHours: 2,
    seTypes: [
      "Lightheaded",
      "Dizzy",
      "Nausea",
      "Headache",
      "Fatigue",
      "Rash",
      "Stomach pain",
      "Trouble sleeping"
    ]
  };

  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function save(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  var settings = Object.assign({}, DEFAULT_SETTINGS, load(SETTINGS_KEY, {}));
  // make sure times array length matches perDay
  function normalizeTimes() {
    var t = settings.times.slice(0, settings.perDay);
    while (t.length < settings.perDay) t.push("12:00");
    settings.times = t;
  }
  normalizeTimes();

  var events = load(EVENTS_KEY, []); // [{id,type,ts,...}]

  function persistSettings() { save(SETTINGS_KEY, settings); }
  function persistEvents() { save(EVENTS_KEY, events); }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // ------------------------------------------------------------------
  // Date / time helpers
  // ------------------------------------------------------------------
  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  function startOfDay(d) {
    var x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }
  function isSameDay(a, b) {
    return startOfDay(a).getTime() === startOfDay(b).getTime();
  }
  // value for <input type="datetime-local"> in LOCAL time
  function toLocalInput(d) {
    return (
      d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
      "T" + pad(d.getHours()) + ":" + pad(d.getMinutes())
    );
  }
  function fromLocalInput(str) {
    // "YYYY-MM-DDTHH:MM" parsed as local time
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(str);
    if (!m) return new Date(str);
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], 0, 0);
  }
  function fmtTime(d) {
    var h = d.getHours();
    var ampm = h >= 12 ? "PM" : "AM";
    var h12 = h % 12 || 12;
    return h12 + ":" + pad(d.getMinutes()) + " " + ampm;
  }
  function fmtTimeStr(hhmm) {
    var parts = hhmm.split(":");
    var d = new Date();
    d.setHours(+parts[0], +parts[1], 0, 0);
    return fmtTime(d);
  }
  function fmtDateLong(d) {
    return d.toLocaleDateString(undefined, {
      weekday: "long", month: "long", day: "numeric"
    });
  }
  function fmtDateShort(d) {
    return d.toLocaleDateString(undefined, {
      weekday: "short", month: "short", day: "numeric"
    });
  }
  function humanDuration(ms) {
    var abs = Math.abs(ms);
    var mins = Math.round(abs / 60000);
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    if (h <= 0) return m + "m";
    if (m === 0) return h + "h";
    return h + "h " + m + "m";
  }

  // Returns the scheduled dose Date objects for a given day, sorted.
  function scheduledDosesFor(day) {
    return settings.times.map(function (hhmm, i) {
      var parts = hhmm.split(":");
      var d = new Date(day);
      d.setHours(+parts[0], +parts[1], 0, 0);
      return { slot: i, time: d };
    }).sort(function (a, b) { return a.time - b.time; });
  }

  function doseEventsOn(day) {
    return events.filter(function (e) {
      return e.type === "dose" && isSameDay(new Date(e.ts), day);
    });
  }
  function seEventsOn(day) {
    return events.filter(function (e) {
      return e.type === "sideEffect" && isSameDay(new Date(e.ts), day);
    });
  }

  // ------------------------------------------------------------------
  // DOM helpers
  // ------------------------------------------------------------------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  var toastTimer = null;
  function toast(msg, warn) {
    var t = $("#toast");
    t.textContent = msg;
    t.className = "toast" + (warn ? " warn" : "");
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2200);
  }

  // ------------------------------------------------------------------
  // Navigation
  // ------------------------------------------------------------------
  var TITLES = { today: "Today", history: "History", stats: "Stats", settings: "Settings" };

  function go(screen) {
    $all(".screen").forEach(function (s) {
      s.hidden = s.getAttribute("data-screen") !== screen;
    });
    $all(".tab").forEach(function (t) {
      t.classList.toggle("active", t.getAttribute("data-go") === screen);
    });
    $("#screen-title").textContent = TITLES[screen] || "Today";
    if (screen === "history") renderHistory();
    if (screen === "stats") renderStats();
    if (screen === "settings") fillSettings();
  }

  $all(".tab").forEach(function (t) {
    t.addEventListener("click", function () { go(t.getAttribute("data-go")); });
  });

  // ------------------------------------------------------------------
  // TODAY screen
  // ------------------------------------------------------------------
  function nextDoseInfo() {
    var now = new Date();
    var flexMs = settings.flexHours * 3600000;

    // Build candidate scheduled doses across yesterday/today/tomorrow,
    // and figure out which are already taken.
    var candidates = [];
    [-1, 0, 1].forEach(function (offset) {
      var day = new Date(now);
      day.setDate(day.getDate() + offset);
      scheduledDosesFor(day).forEach(function (s) {
        candidates.push({ slot: s.slot, time: s.time, day: startOfDay(day) });
      });
    });
    candidates.sort(function (a, b) { return a.time - b.time; });

    // Mark which scheduled doses already have a logged dose nearby.
    var taken = events.filter(function (e) { return e.type === "dose"; });
    function isSlotTaken(cand) {
      return taken.some(function (e) {
        var et = new Date(e.ts);
        // a logged dose "covers" the scheduled slot if within the flex window
        return Math.abs(et - cand.time) <= flexMs + 30 * 60000 &&
               isSameDay(et, cand.time);
      });
    }

    // Find the next not-yet-taken scheduled dose whose window hasn't fully passed,
    // or the soonest upcoming one.
    var upcoming = null;
    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      if (isSlotTaken(c)) continue;
      var windowEnd = new Date(c.time.getTime() + flexMs);
      if (windowEnd >= now) { upcoming = c; break; }
    }
    if (!upcoming) {
      // everything in range taken/passed — show next future scheduled
      for (var j = 0; j < candidates.length; j++) {
        if (candidates[j].time > now) { upcoming = candidates[j]; break; }
      }
    }
    return upcoming;
  }

  function renderNextDose() {
    var card = $("#next-dose-card");
    var info = nextDoseInfo();
    card.classList.remove("is-due", "is-late");

    if (!info) {
      $("#next-dose-time").textContent = "—";
      $("#next-dose-countdown").textContent = "";
      $("#next-dose-window").textContent = "";
      $("#fasting-note").textContent = "";
      return;
    }

    var now = new Date();
    var target = info.time;
    var flexMs = settings.flexHours * 3600000;
    var windowEnd = new Date(target.getTime() + flexMs);
    var diff = target - now;

    $("#next-dose-time").textContent = fmtTime(target);
    $("#next-dose-window").textContent =
      "Window: " + fmtTime(target) + " – " + fmtTime(windowEnd) +
      " (" + settings.flexHours + "h flex)";

    if (diff > 0) {
      $("#next-dose-label").textContent = "Next dose" + (isSameDay(target, now) ? "" : " (" + fmtDateShort(target) + ")");
      $("#next-dose-countdown").textContent = "in " + humanDuration(diff);
      // fasting cue
      var fastStart = new Date(target.getTime() - settings.fastHours * 3600000);
      if (settings.fastHours > 0) {
        var ateInWindow = mealsBetween(fastStart, target);
        if (now >= fastStart) {
          if (ateInWindow.length) {
            $("#fasting-note").textContent =
              "⚠️ You ate at " + fmtTime(new Date(ateInWindow[0].ts)) +
              ", inside the no-food window. Check dose timing with your team.";
          } else {
            $("#fasting-note").textContent =
              "🍽️ Fasting window — no food until after this dose.";
          }
        } else {
          $("#fasting-note").textContent =
            "Stop eating by " + fmtTime(fastStart) + " (" + settings.fastHours + "h before).";
        }
      } else {
        $("#fasting-note").textContent = "";
      }
    } else if (now <= windowEnd) {
      card.classList.add("is-due");
      $("#next-dose-label").textContent = "Dose due now";
      $("#next-dose-countdown").textContent =
        "Within flex window — " + humanDuration(windowEnd - now) + " left";
      $("#fasting-note").textContent = "";
    } else {
      card.classList.add("is-late");
      $("#next-dose-label").textContent = "Dose overdue";
      $("#next-dose-countdown").textContent =
        humanDuration(now - windowEnd) + " past the flex window";
      $("#fasting-note").textContent = "";
    }
  }

  function renderDoseSlots() {
    var today = new Date();
    var slots = scheduledDosesFor(today);
    var taken = doseEventsOn(today);
    var flexMs = settings.flexHours * 3600000;
    var list = $("#dose-slots");
    list.innerHTML = "";

    // greedily match each logged dose to nearest scheduled slot
    var usedEvent = {};
    var takenCount = 0;

    slots.forEach(function (s, idx) {
      var match = null;
      taken.forEach(function (e) {
        if (usedEvent[e.id]) return;
        var et = new Date(e.ts);
        if (Math.abs(et - s.time) <= flexMs + 30 * 60000) {
          if (!match || Math.abs(et - s.time) < Math.abs(new Date(match.ts) - s.time)) {
            match = e;
          }
        }
      });

      var li = el("li", "dose-slot");
      var dot = el("span", "slot-dot");
      var main = el("div", "slot-main");
      var title = el("div", "slot-title", "Dose " + (idx + 1) + " · " + fmtTime(s.time));
      var sub = el("div", "slot-sub");
      var action = el("div", "slot-action");

      if (match) {
        usedEvent[match.id] = true;
        takenCount++;
        var mt = new Date(match.ts);
        li.classList.add("taken");
        var late = mt > new Date(s.time.getTime() + flexMs);
        if (late) li.classList.add("late");
        sub.textContent = "Taken " + fmtTime(mt) + " · " + (match.mg || settings.mg) + "mg";
        action.textContent = "✓";
      } else {
        sub.textContent = settings.mg + "mg" +
          (settings.fastHours > 0 ? " · fast from " + fmtTime(new Date(s.time.getTime() - settings.fastHours * 3600000)) : "");
        var late2 = new Date() > new Date(s.time.getTime() + flexMs);
        if (late2) li.classList.add("late");
        action.textContent = "Log";
        action.style.color = "var(--primary)";
        li.style.cursor = "pointer";
        li.addEventListener("click", function () { openDoseSheet(s.time); });
      }

      main.appendChild(title);
      main.appendChild(sub);
      li.appendChild(dot);
      li.appendChild(main);
      li.appendChild(action);
      list.appendChild(li);
    });

    $("#doses-progress").textContent = takenCount + " / " + settings.perDay;
  }

  function renderTodaySE() {
    var card = $("#today-se-card");
    var list = $("#today-se-list");
    var today = new Date();
    var items = events.filter(function (e) {
      return e.type !== "dose" && isSameDay(new Date(e.ts), today);
    }).sort(function (a, b) { return new Date(b.ts) - new Date(a.ts); });
    if (!items.length) { card.hidden = true; return; }
    card.hidden = false;
    list.innerHTML = "";
    items.forEach(function (e) { list.appendChild(todayListItem(e)); });
  }

  function todayListItem(e) {
    var li = el("li", "event-item");
    li.appendChild(el("div", "ev-time", fmtTime(new Date(e.ts))));
    var main = el("div", "ev-main");
    if (e.type === "sideEffect") {
      main.appendChild(el("div", "ev-title", e.kind + " · " + e.intensity + "/10"));
      if (e.note) main.appendChild(el("div", "ev-sub", e.note));
    } else if (e.type === "meal") {
      main.appendChild(el("div", "ev-title", e.food || "Food"));
      if (e.amount) main.appendChild(el("div", "ev-sub", e.amount));
    } else {
      main.appendChild(el("div", "ev-title", noteSummary(e) || "Note"));
      if (e.text) main.appendChild(el("div", "ev-sub", e.text));
    }
    li.appendChild(main);
    var del = el("button", "ev-del", "×");
    del.addEventListener("click", function () { deleteEvent(e.id); });
    li.appendChild(del);
    return li;
  }

  function renderToday() {
    $("#today-date").textContent = fmtDateLong(new Date());
    renderNextDose();
    renderDoseSlots();
    renderTodaySE();
  }

  // ------------------------------------------------------------------
  // Dose sheet
  // ------------------------------------------------------------------
  function openSheet(id) { $("#" + id).hidden = false; }
  function closeSheet(id) { $("#" + id).hidden = true; }

  $all("[data-close-sheet]").forEach(function (b) {
    b.addEventListener("click", function () { closeSheet(b.getAttribute("data-close-sheet")); });
  });
  $all(".sheet-backdrop").forEach(function (bd) {
    bd.addEventListener("click", function (e) { if (e.target === bd) bd.hidden = true; });
  });

  function openDoseSheet(presetTime) {
    var when = presetTime && presetTime > new Date() ? new Date() : (presetTime || new Date());
    // default to now (the moment you're taking it), not the scheduled slot
    $("#dose-when").value = toLocalInput(new Date());
    $("#dose-mg").value = settings.mg;
    $("#dose-note").value = "";
    openSheet("dose-sheet");
  }

  $("#save-dose").addEventListener("click", function () {
    var ts = fromLocalInput($("#dose-when").value);
    if (isNaN(ts)) { toast("Pick a valid time", true); return; }
    events.push({
      id: uid(), type: "dose", ts: ts.toISOString(),
      mg: +$("#dose-mg").value || settings.mg,
      note: $("#dose-note").value.trim()
    });
    persistEvents();
    closeSheet("dose-sheet");
    toast("Dose logged ✓");
    renderToday();
  });

  $("#log-now-btn").addEventListener("click", function () { openDoseSheet(); });

  // ------------------------------------------------------------------
  // Side-effect sheet
  // ------------------------------------------------------------------
  var seSelectedType = "";

  function buildSeChips() {
    var wrap = $("#se-type-chips");
    wrap.innerHTML = "";
    settings.seTypes.forEach(function (t) {
      var c = el("button", "chip", t);
      c.type = "button";
      c.addEventListener("click", function () {
        seSelectedType = t;
        $("#se-type-other").value = "";
        $all(".chip", wrap).forEach(function (x) { x.classList.remove("selected"); });
        c.classList.add("selected");
      });
      wrap.appendChild(c);
    });
  }

  function openSeSheet() {
    seSelectedType = "";
    $("#se-when").value = toLocalInput(new Date());
    $("#se-int").value = 5;
    $("#se-int-val").textContent = "5";
    $("#se-note").value = "";
    $("#se-type-other").value = "";
    buildSeChips();
    $all(".chip", $("#se-type-chips")).forEach(function (x) { x.classList.remove("selected"); });
    openSheet("se-sheet");
  }

  // open side-effect sheet pre-filled with a specific type (used by detector)
  function openSeSheetWith(type, intensity) {
    openSeSheet();
    if (type) {
      seSelectedType = type;
      $all(".chip", $("#se-type-chips")).forEach(function (x) {
        if (x.textContent === type) x.classList.add("selected");
      });
      if (settings.seTypes.indexOf(type) === -1) $("#se-type-other").value = type;
    }
    if (intensity) {
      $("#se-int").value = intensity;
      $("#se-int-val").textContent = "" + intensity;
    }
  }

  $("#se-int").addEventListener("input", function () {
    $("#se-int-val").textContent = this.value;
  });
  $("#se-type-other").addEventListener("input", function () {
    if (this.value.trim()) {
      seSelectedType = "";
      $all(".chip", $("#se-type-chips")).forEach(function (x) { x.classList.remove("selected"); });
    }
  });

  $("#save-se").addEventListener("click", function () {
    var kind = $("#se-type-other").value.trim() || seSelectedType;
    if (!kind) { toast("Pick or type a side effect", true); return; }
    var ts = fromLocalInput($("#se-when").value);
    if (isNaN(ts)) { toast("Pick a valid time", true); return; }
    events.push({
      id: uid(), type: "sideEffect", ts: ts.toISOString(),
      kind: kind, intensity: +$("#se-int").value,
      note: $("#se-note").value.trim()
    });
    persistEvents();
    closeSheet("se-sheet");
    toast("Side effect logged");
    renderToday();
  });

  $("#quick-se-btn").addEventListener("click", openSeSheet);

  // ------------------------------------------------------------------
  // Note / observation sheet
  // ------------------------------------------------------------------
  var NOTE_TAGS = ["Chills", "Temperature check", "Fever", "Mood", "Appetite", "Sleep", "Energy"];
  var noteTags = [];

  function buildNoteChips() {
    var wrap = $("#note-tag-chips");
    wrap.innerHTML = "";
    NOTE_TAGS.forEach(function (t) {
      var c = el("button", "chip", t);
      c.type = "button";
      c.addEventListener("click", function () {
        var i = noteTags.indexOf(t);
        if (i === -1) { noteTags.push(t); c.classList.add("selected"); }
        else { noteTags.splice(i, 1); c.classList.remove("selected"); }
        // tapping "Temperature check" focuses the temp field for convenience
        if (t === "Temperature check" && i === -1) $("#note-temp").focus();
      });
      wrap.appendChild(c);
    });
  }

  function openNoteSheet() {
    noteTags = [];
    $("#note-when").value = toLocalInput(new Date());
    $("#note-text").value = "";
    $("#note-temp").value = "";
    buildNoteChips();
    openSheet("note-sheet");
  }

  $("#quick-note-btn").addEventListener("click", openNoteSheet);

  $("#save-note").addEventListener("click", function () {
    var text = $("#note-text").value.trim();
    var tempRaw = $("#note-temp").value.trim();
    var temp = tempRaw === "" ? null : +tempRaw;
    if (!text && !noteTags.length && temp == null) {
      toast("Add a note, tag, or temperature", true);
      return;
    }
    var ts = fromLocalInput($("#note-when").value);
    if (isNaN(ts)) { toast("Pick a valid time", true); return; }
    events.push({
      id: uid(), type: "note", ts: ts.toISOString(),
      text: text, tags: noteTags.slice(),
      temp: (temp != null && !isNaN(temp)) ? temp : null,
      tempUnit: $("#note-temp-unit").value
    });
    persistEvents();
    closeSheet("note-sheet");
    toast("Note saved ✓");
    renderToday();
  });

  // Build a readable one-line summary of a note event.
  function noteSummary(e) {
    var bits = [];
    if (e.tags && e.tags.length) bits.push(e.tags.join(", "));
    if (e.temp != null) bits.push(e.temp + "°" + (e.tempUnit || "F"));
    return bits.join(" · ");
  }

  // ------------------------------------------------------------------
  // Food / meal sheet
  // ------------------------------------------------------------------
  var MEAL_PORTIONS = ["Bite", "Snack", "Small", "Medium", "Large"];
  var mealPortion = "";

  function mealsBetween(start, end) {
    return events.filter(function (e) {
      if (e.type !== "meal") return false;
      var t = new Date(e.ts);
      return t >= start && t <= end;
    }).sort(function (a, b) { return new Date(b.ts) - new Date(a.ts); });
  }

  function buildMealChips() {
    var wrap = $("#meal-portion-chips");
    wrap.innerHTML = "";
    MEAL_PORTIONS.forEach(function (p) {
      var c = el("button", "chip", p);
      c.type = "button";
      c.addEventListener("click", function () {
        mealPortion = p;
        $("#meal-amount-other").value = "";
        $all(".chip", wrap).forEach(function (x) { x.classList.remove("selected"); });
        c.classList.add("selected");
      });
      wrap.appendChild(c);
    });
  }

  function openMealSheet() {
    mealPortion = "";
    $("#meal-when").value = toLocalInput(new Date());
    $("#meal-food").value = "";
    $("#meal-amount-other").value = "";
    buildMealChips();
    // warn if we're currently inside the no-food window before the next dose
    var warn = $("#meal-fast-warn");
    warn.textContent = "";
    if (settings.fastHours > 0) {
      var info = nextDoseInfo();
      if (info && info.time > new Date()) {
        var fastStart = new Date(info.time.getTime() - settings.fastHours * 3600000);
        if (new Date() >= fastStart) {
          warn.textContent = "⚠️ No-food window — your next dose is at " +
            fmtTime(info.time) + ". Eating now may affect dose timing.";
        }
      }
    }
    openSheet("meal-sheet");
  }

  $("#meal-amount-other").addEventListener("input", function () {
    if (this.value.trim()) {
      mealPortion = "";
      $all(".chip", $("#meal-portion-chips")).forEach(function (x) { x.classList.remove("selected"); });
    }
  });

  $("#quick-meal-btn").addEventListener("click", openMealSheet);

  $("#save-meal").addEventListener("click", function () {
    var food = $("#meal-food").value.trim();
    var amount = $("#meal-amount-other").value.trim() || mealPortion;
    if (!food && !amount) { toast("Add what or how much you ate", true); return; }
    var ts = fromLocalInput($("#meal-when").value);
    if (isNaN(ts)) { toast("Pick a valid time", true); return; }
    events.push({
      id: uid(), type: "meal", ts: ts.toISOString(),
      food: food || "Food", amount: amount
    });
    persistEvents();
    closeSheet("meal-sheet");
    // confirm, and flag if it landed inside a fasting window
    var info = nextDoseInfo();
    if (settings.fastHours > 0 && info &&
        ts >= new Date(info.time.getTime() - settings.fastHours * 3600000) &&
        ts <= info.time) {
      toast("Logged — but inside the no-food window", true);
    } else {
      toast("Food logged ✓");
    }
    renderToday();
  });

  // ------------------------------------------------------------------
  // Delete
  // ------------------------------------------------------------------
  function deleteEvent(id) {
    events = events.filter(function (e) { return e.id !== id; });
    persistEvents();
    renderToday();
    if (!$('.screen[data-screen="history"]').hidden) renderHistory();
  }

  // ------------------------------------------------------------------
  // HISTORY screen
  // ------------------------------------------------------------------
  $("#history-filter").addEventListener("change", renderHistory);

  function renderHistory() {
    var filter = $("#history-filter").value;
    var body = $("#history-body");
    body.innerHTML = "";

    var list = events.slice().sort(function (a, b) { return new Date(b.ts) - new Date(a.ts); });
    if (filter !== "all") {
      list = list.filter(function (e) { return e.type === filter; });
    }
    if (!list.length) {
      body.appendChild(el("div", "empty", "Nothing logged yet."));
      return;
    }

    // group by day
    var groups = {};
    var order = [];
    list.forEach(function (e) {
      var key = startOfDay(new Date(e.ts)).getTime();
      if (!groups[key]) { groups[key] = []; order.push(key); }
      groups[key].push(e);
    });

    order.forEach(function (key) {
      var g = el("div", "day-group");
      g.appendChild(el("div", "day-head", fmtDateShort(new Date(+key))));
      var ul = el("ul", "event-list");
      groups[key].forEach(function (e) { ul.appendChild(historyItem(e)); });
      g.appendChild(ul);
      body.appendChild(g);
    });
  }

  function historyItem(e) {
    var li = el("li", "event-item");
    li.appendChild(el("div", "ev-time", fmtTime(new Date(e.ts))));
    var main = el("div", "ev-main");
    if (e.type === "dose") {
      main.appendChild(el("div", "ev-title", (e.mg || settings.mg) + "mg dose"));
      if (e.note) main.appendChild(el("div", "ev-sub", e.note));
      li.appendChild(main);
      li.appendChild(el("span", "ev-badge badge-dose", "DOSE"));
    } else if (e.type === "sideEffect") {
      main.appendChild(el("div", "ev-title", e.kind + " · " + e.intensity + "/10"));
      if (e.note) main.appendChild(el("div", "ev-sub", e.note));
      li.appendChild(main);
      li.appendChild(el("span", "ev-badge badge-se", "EFFECT"));
    } else if (e.type === "meal") {
      main.appendChild(el("div", "ev-title", e.food || "Food"));
      if (e.amount) main.appendChild(el("div", "ev-sub", e.amount));
      li.appendChild(main);
      li.appendChild(el("span", "ev-badge badge-meal", "FOOD"));
    } else {
      main.appendChild(el("div", "ev-title", noteSummary(e) || "Note"));
      if (e.text) main.appendChild(el("div", "ev-sub", e.text));
      li.appendChild(main);
      li.appendChild(el("span", "ev-badge badge-note", "NOTE"));
    }
    var del = el("button", "ev-del", "×");
    del.addEventListener("click", function () { deleteEvent(e.id); });
    li.appendChild(del);
    return li;
  }

  // ------------------------------------------------------------------
  // STATS screen
  // ------------------------------------------------------------------
  function renderStats() {
    var now = new Date();
    var since = startOfDay(now);
    since.setDate(since.getDate() - 6); // last 7 days incl today

    var inRange = events.filter(function (e) { return new Date(e.ts) >= since; });
    var doses = inRange.filter(function (e) { return e.type === "dose"; });
    var ses = inRange.filter(function (e) { return e.type === "sideEffect"; });

    var expected = settings.perDay * 7;
    var adherence = expected ? Math.min(100, Math.round((doses.length / expected) * 100)) : 0;

    $("#stat-adherence").textContent = adherence + "%";
    $("#stat-doses").textContent = doses.length + " / " + expected;
    $("#stat-se").textContent = "" + ses.length;
    var avg = ses.length
      ? (ses.reduce(function (s, e) { return s + e.intensity; }, 0) / ses.length)
      : 0;
    $("#stat-avg-int").textContent = ses.length ? avg.toFixed(1) : "—";

    // breakdown
    var counts = {};
    ses.forEach(function (e) { counts[e.kind] = (counts[e.kind] || 0) + 1; });
    var rows = Object.keys(counts).map(function (k) { return { k: k, n: counts[k] }; })
      .sort(function (a, b) { return b.n - a.n; });
    var max = rows.length ? rows[0].n : 1;
    var ul = $("#se-breakdown");
    ul.innerHTML = "";
    if (!rows.length) { ul.appendChild(el("li", "empty", "No side effects in the last 7 days.")); return; }
    rows.forEach(function (r) {
      var li = el("li", "bar-row");
      var top = el("div", "bar-top");
      top.appendChild(el("span", null, r.k));
      top.appendChild(el("span", null, "" + r.n));
      var track = el("div", "bar-track");
      var fill = el("div", "bar-fill");
      fill.style.width = Math.round((r.n / max) * 100) + "%";
      track.appendChild(fill);
      li.appendChild(top);
      li.appendChild(track);
      ul.appendChild(li);
    });
  }

  // ------------------------------------------------------------------
  // Export / import
  // ------------------------------------------------------------------
  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime || "text/plain" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function csvCell(v) {
    v = v == null ? "" : "" + v;
    return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }

  $("#export-csv").addEventListener("click", function () {
    var rows = [["date", "time", "type", "detail", "intensity_1_10", "amount_mg", "temperature", "note"]];
    events.slice().sort(function (a, b) { return new Date(a.ts) - new Date(b.ts); })
      .forEach(function (e) {
        var d = new Date(e.ts);
        var typeMap = { dose: "Dose", sideEffect: "Side effect", note: "Note", meal: "Meal" };
        var type = typeMap[e.type] || e.type;
        var detail;
        if (e.type === "dose") detail = "Medication";
        else if (e.type === "sideEffect") detail = e.kind;
        else if (e.type === "meal") detail = e.food || "Food";
        else detail = (e.tags && e.tags.length) ? e.tags.join("; ") : "Observation";
        var temp = (e.type === "note" && e.temp != null) ? (e.temp + "°" + (e.tempUnit || "F")) : "";
        var note = e.type === "note" ? (e.text || "")
          : (e.type === "meal" ? (e.amount || "") : (e.note || ""));
        rows.push([
          d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()),
          pad(d.getHours()) + ":" + pad(d.getMinutes()),
          type,
          detail,
          e.type === "sideEffect" ? e.intensity : "",
          e.type === "dose" ? (e.mg || settings.mg) : "",
          temp,
          note
        ]);
      });
    var csv = rows.map(function (r) { return r.map(csvCell).join(","); }).join("\n");
    download("trial-log-" + toLocalInput(new Date()).slice(0, 10) + ".csv", csv, "text/csv");
    toast("CSV exported");
  });

  $("#export-json").addEventListener("click", function () {
    var data = { exportedAt: new Date().toISOString(), settings: settings, events: events };
    download("trial-backup-" + toLocalInput(new Date()).slice(0, 10) + ".json",
      JSON.stringify(data, null, 2), "application/json");
    toast("Backup exported");
  });

  $("#import-json").addEventListener("click", function () { $("#import-file").click(); });
  $("#import-file").addEventListener("change", function () {
    var file = this.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (data.events) { events = data.events; persistEvents(); }
        if (data.settings) { settings = Object.assign({}, DEFAULT_SETTINGS, data.settings); normalizeTimes(); persistSettings(); }
        toast("Backup imported");
        renderToday();
        fillSettings();
      } catch (e) {
        toast("Could not read that file", true);
      }
    };
    reader.readAsText(file);
    this.value = "";
  });

  $("#reset-data").addEventListener("click", function () {
    if (confirm("Erase ALL logged doses and side effects? This cannot be undone. (Export a backup first if unsure.)")) {
      events = [];
      persistEvents();
      toast("All data erased");
      renderToday();
      renderHistory();
    }
  });

  // ------------------------------------------------------------------
  // SETTINGS screen
  // ------------------------------------------------------------------
  function fillSettings() {
    $("#set-mg").value = settings.mg;
    $("#set-per-day").value = settings.perDay;
    $("#set-flex").value = settings.flexHours;
    $("#set-fast").value = settings.fastHours;
    $("#set-se-types").value = settings.seTypes.join("\n");
    renderTimeInputs();
  }

  function renderTimeInputs() {
    var wrap = $("#set-times-wrap");
    wrap.innerHTML = "";
    var n = +$("#set-per-day").value || settings.perDay;
    for (var i = 0; i < n; i++) {
      var lab = el("label", "field");
      lab.appendChild(el("span", null, "Dose " + (i + 1) + " target time"));
      var inp = document.createElement("input");
      inp.type = "time";
      inp.className = "time-input";
      inp.value = settings.times[i] || "12:00";
      inp.setAttribute("data-time-index", i);
      lab.appendChild(inp);
      wrap.appendChild(lab);
    }
  }

  $("#set-per-day").addEventListener("change", renderTimeInputs);

  $("#save-settings").addEventListener("click", function () {
    settings.mg = +$("#set-mg").value || 300;
    settings.perDay = Math.max(1, Math.min(6, +$("#set-per-day").value || 2));
    settings.flexHours = Math.max(0, +$("#set-flex").value || 0);
    settings.fastHours = Math.max(0, +$("#set-fast").value || 0);
    settings.times = $all("[data-time-index]").map(function (inp) { return inp.value || "12:00"; });
    normalizeTimes();
    settings.seTypes = $("#set-se-types").value.split("\n")
      .map(function (s) { return s.trim(); }).filter(Boolean);
    if (!settings.seTypes.length) settings.seTypes = DEFAULT_SETTINGS.seTypes.slice();
    persistSettings();
    toast("Settings saved");
    renderToday();
    go("today");
  });

  // ------------------------------------------------------------------
  // Stand-up / lightheaded detector (foreground only)
  // ------------------------------------------------------------------
  // NOTE: Browsers can only read motion while this page is OPEN and in the
  // foreground. Background motion monitoring requires a native iOS app or an
  // Apple Watch. See README.md.
  var motionOn = false;
  var lastPromptAt = 0;
  var motionSamples = [];

  function setMotionStatus(text) { $("#motion-status").textContent = text; }

  function onMotion(ev) {
    var a = ev.accelerationIncludingGravity || ev.acceleration;
    if (!a) return;
    var mag = Math.sqrt((a.x || 0) * (a.x || 0) + (a.y || 0) * (a.y || 0) + (a.z || 0) * (a.z || 0));
    var t = Date.now();
    motionSamples.push({ t: t, mag: mag });
    // keep ~3s window
    motionSamples = motionSamples.filter(function (s) { return t - s.t < 3000; });

    if (motionSamples.length < 8) return;
    var mags = motionSamples.map(function (s) { return s.mag; });
    var peak = Math.max.apply(null, mags);
    var trough = Math.min.apply(null, mags);
    // A stand-up shows up as a sustained spike well above resting (~9.8 = gravity).
    if (peak - trough > 7 && peak > 14 && (t - lastPromptAt) > 25000) {
      lastPromptAt = t;
      promptLightheaded();
    }
  }

  function promptLightheaded() {
    // gentle in-app prompt; opens the SE sheet pre-set to Lightheaded
    if (navigator.vibrate) navigator.vibrate(120);
    if (confirm("Did you just stand up — feeling lightheaded?\n\nTap OK to rate it (1–10), or Cancel if you're fine.")) {
      openSeSheetWith("Lightheaded", 3);
    }
  }

  function startMotion() {
    function attach() {
      window.addEventListener("devicemotion", onMotion);
      motionOn = true;
      $("#motion-toggle").checked = true;
      setMotionStatus("On. Keep this app open after sitting a while — a sudden rise will prompt you. (Works only while the app is open.)");
    }
    // iOS 13+ requires explicit permission via a user gesture
    if (typeof DeviceMotionEvent !== "undefined" &&
        typeof DeviceMotionEvent.requestPermission === "function") {
      DeviceMotionEvent.requestPermission().then(function (state) {
        if (state === "granted") { attach(); }
        else { $("#motion-toggle").checked = false; setMotionStatus("Motion permission denied. Enable Motion & Orientation Access in Safari settings, then toggle again."); }
      }).catch(function () {
        $("#motion-toggle").checked = false;
        setMotionStatus("Could not request motion permission on this device.");
      });
    } else if (typeof DeviceMotionEvent !== "undefined") {
      attach();
    } else {
      $("#motion-toggle").checked = false;
      setMotionStatus("This device/browser doesn't expose motion data.");
    }
  }

  function stopMotion() {
    window.removeEventListener("devicemotion", onMotion);
    motionOn = false;
    motionSamples = [];
    setMotionStatus("Off. When on (and this app is open), a sudden rise from sitting will prompt you to rate any lightheadedness.");
  }

  $("#motion-toggle").addEventListener("change", function () {
    if (this.checked) startMotion(); else stopMotion();
  });

  // ------------------------------------------------------------------
  // Deep links (for iOS Shortcuts): ?quick=dose | ?quick=se
  // ------------------------------------------------------------------
  function handleDeepLink() {
    var params = new URLSearchParams(location.search);
    var q = params.get("quick");
    if (q === "dose") {
      if (params.get("confirm") === "1") {
        // log immediately, no sheet
        events.push({ id: uid(), type: "dose", ts: new Date().toISOString(), mg: settings.mg, note: "via Shortcut" });
        persistEvents();
        renderToday();
        toast("Dose logged ✓");
      } else {
        openDoseSheet();
      }
    } else if (q === "se") {
      openSeSheet();
    } else if (q === "note") {
      openNoteSheet();
    } else if (q === "meal") {
      openMealSheet();
    }
    if (q && history.replaceState) {
      history.replaceState(null, "", location.pathname);
    }
  }

  // ------------------------------------------------------------------
  // Service worker (offline / installable)
  // ------------------------------------------------------------------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }

  // ------------------------------------------------------------------
  // Boot + keep "Today" fresh
  // ------------------------------------------------------------------
  renderToday();
  go("today");
  handleDeepLink();

  setInterval(function () {
    if (!$('.screen[data-screen="today"]').hidden) renderNextDose();
  }, 30000);

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) renderToday();
  });
})();
