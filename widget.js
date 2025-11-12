/*! Encounter Church – Minimal Suggestion Widget v1.0 */

(function () {
  // ---------- CONFIG ----------
  function getConfig() {
    // Works for both static <script ...> and dynamically injected <script>
    var s =
      document.currentScript ||
      (function () {
        var scripts = document.getElementsByTagName("script");
        return scripts[scripts.length - 1];
      })();

    var cfg = {
      target: s.getAttribute("data-target") || "#suggestion-widget",
      feedUrl: s.getAttribute("data-feed-url") || "",
      maxItems: parseInt(s.getAttribute("data-max"), 10) || 3,
      theme: s.getAttribute("data-theme") || "auto", // 'light' | 'dark' | 'auto'
      analyticsUrl: s.getAttribute("data-analytics") || "",
      siteName: s.getAttribute("data-site-name") || (document.title || "Site")
    };

    return cfg;
  }

  // ---------- UTILITIES ----------
  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $$(sel, root) {
    return Array.prototype.slice.call(
      (root || document).querySelectorAll(sel)
    );
  }

  function normalize(str) {
    return (str || "").toLowerCase();
  }

  function dedupe(arr) {
    return Array.from(new Set(arr));
  }

  function getMetaKeywords() {
    var m = $('meta[name="keywords"]');
    if (m && m.content) {
      return m.content
        .split(",")
        .map(function (x) {
          return normalize(x.trim());
        })
        .filter(Boolean);
    }
    return [];
  }

  function getTagsFromSquarespace() {
    var tags = [];

    // 1) meta[name="page:tags"] if present
    var mt = $('meta[name="page:tags"]');
    if (mt && mt.content) {
      tags = tags.concat(
        mt.content
          .split(",")
          .map(function (s) {
            return s.trim();
          })
          .filter(Boolean)
      );
    }

    // 2) visible tag links (common Squarespace patterns)
    $$('.sqs-tag a, a[href*="/tag/"], a[href*="/categories/"]').forEach(
      function (a) {
        tags.push(a.textContent.trim());
      }
    );

    return dedupe(
      tags
        .map(function (t) {
          return normalize(t);
        })
        .filter(Boolean)
    );
  }

  function currentPageContext() {
    var url = window.location.href;
    var title =
      (document.querySelector('meta[property="og:title"]') || {}).content ||
      document.title ||
      "";
    var desc =
      (document.querySelector('meta[property="og:description"]') || {})
        .content ||
      (document.querySelector('meta[name="description"]') || {}).content ||
      "";
    var kw = dedupe(getMetaKeywords().concat(getTagsFromSquarespace()));

    return { url: url, title: title, desc: desc, tags: kw };
  }

  // ---------- SCORING ----------
  function jaccard(a, b) {
    var A = new Set((a || []).map(normalize));
    var B = new Set((b || []).map(normalize));

    if (!A.size && !B.size) return 0;

    var inter = 0;
    A.forEach(function (x) {
      if (B.has(x)) inter += 1;
    });

    var denom = A.size + B.size - inter;
    return inter / (denom || 1);
  }

  function titleScore(a, b) {
    if (!a || !b) return 0;
    var aw = normalize(a)
      .split(/\W+/)
      .filter(Boolean);
    var bw = normalize(b)
      .split(/\W+/)
      .filter(Boolean);
    return jaccard(aw, bw);
  }

  function scoreItem(ctx, item) {
    // item: { title, url, tags[], image, excerpt }
    var ts = titleScore(ctx.title, item.title) * 0.6;
    var tg = jaccard(ctx.tags, item.tags || []) * 0.4;
    var bonus = item.url === ctx.url ? -1 : 0; // avoid recommending the same page
    return ts + tg + bonus;
  }

  // ---------- SHADOW DOM + STYLES ----------
  function createShadow(host) {
    if (!host) return null;
    if (host.shadowRoot) return host.shadowRoot;
    if (host.attachShadow) {
      return host.attachShadow({ mode: "open" });
    }
    // Fallback: no Shadow DOM, render inline
    return host;
  }

  function css(theme) {
    // theme is used to choose light/dark base class; CSS variables handle the rest
    return (
      "\n:host{ all: initial; }\n*, *::before, *::after{ box-sizing: border-box; }\n.widget{ font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height: 1.45; }\n.header{ display:flex; align-items:center; justify-content:space-between; margin-bottom: .5rem; }\n.title{ font-weight: 700; font-size: 1rem; }\n.grid{ display:grid; grid-template-columns: 1fr; gap:.75rem; }\n.card{ display:flex; gap:.75rem; padding:.75rem; border-radius:.75rem; border:1px solid var(--bd); background:var(--bg); text-decoration:none; transition: box-shadow .15s ease, transform .15s ease; }\n.card:hover{ transform: translateY(-1px); box-shadow: 0 4px 18px rgba(0,0,0,.06); }\n.thumb{ width:72px; height:72px; flex:none; border-radius:.5rem; object-fit:cover; background:#ddd; }\n.ctitle{ font-weight:600; font-size:.95rem; color:var(--fg); margin:0 0 .25rem 0; }\n.meta{ font-size:.8rem; color:var(--muted); }\nfooter{ margin-top:.5rem; font-size:.72rem; color:var(--muted); }\n.light{\n  --bg: #ffffff; --fg:#111827; --muted:#6b7280; --bd:#e5e7eb;\n}\n.dark{\n  --bg: #0f172a; --fg:#e5e7eb; --muted:#9ca3af; --bd:#374151;\n}\n@media (min-width: 640px){ .grid{ grid-template-columns: repeat(3, 1fr); } }\n"
    );
  }

  function render(root, items, cfg) {
    root.innerHTML = "";

    var wrap = document.createElement("div");
    var themeClass =
      cfg.theme === "dark"
        ? "dark"
        : cfg.theme === "light"
        ? "light"
        : "light"; // default light if auto

    wrap.className = "widget " + themeClass;

    wrap.innerHTML =
      '<div class="header">' +
      '<div class="title">Recommended for you</div>' +
      "</div>" +
      '<div class="grid"></div>' +
      "<footer>Powered by " +
      cfg.siteName +
      "</footer>";

    var grid = wrap.querySelector(".grid");

    items.forEach(function (it) {
      var a = document.createElement("a");
      a.className = "card";
      a.href = it.url || "#";
      if ((it.url || "").indexOf("http") === 0) {
        a.target = "_blank";
        a.rel = "noopener";
      }

      a.addEventListener("click", function () {
        track("suggestion_click", {
          url: it.url,
          title: it.title
        });
      });

      var img = document.createElement("img");
      img.className = "thumb";
      img.alt = "";
      img.src =
        it.image ||
        "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

      var box = document.createElement("div");

      var h = document.createElement("div");
      h.className = "ctitle";
      h.textContent = it.title || "Untitled";

      var m = document.createElement("div");
      m.className = "meta";
      m.textContent = (it.tags || []).slice(0, 3).join(" · ");

      box.appendChild(h);
      box.appendChild(m);

      a.appendChild(img);
      a.appendChild(box);

      grid.appendChild(a);
    });

    root.appendChild(wrap);
  }

  // ---------- ANALYTICS (optional) ----------
  var config = null;

  function track(event, props) {
    try {
      if (!config || !config.analyticsUrl) return;

      var payload = {
        event: event,
        props: props || {},
        page: currentPageContext(),
        ts: Date.now()
      };

      if (navigator.sendBeacon) {
        var blob = new Blob([JSON.stringify(payload)], {
          type: "application/json"
        });
        navigator.sendBeacon(config.analyticsUrl, blob);
      } else {
        fetch(config.analyticsUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: true
        });
      }
    } catch (e) {
      // ignore analytics errors
    }
  }

  // ---------- DATA FETCH ----------
  async function fetchJson(url) {
    var res = await fetch(url, { credentials: "omit" });
    if (!res.ok) throw new Error("Feed load failed: " + res.status);
    return await res.json();
  }

  // ---------- BOOTSTRAP ----------
  config = getConfig();
  var host = document.querySelector(config.target);

  if (!host) {
    console.warn("[SuggestionWidget] target not found:", config.target);
    return;
  }

  var shadow = createShadow(host);

  var style = document.createElement("style");
  style.textContent = css(config.theme);
  shadow.appendChild(style);

  var root = document.createElement("div");
  shadow.appendChild(root);

  (async function main() {
    try {
      var ctx = currentPageContext();
      var data = config.feedUrl ? await fetchJson(config.feedUrl) : [];

      var scored = (data || [])
        .map(function (item) {
          return Object.assign({}, item, {
            __score: scoreItem(ctx, item)
          });
        })
        .filter(function (x) {
          return x.__score > -0.5;
        })
        .sort(function (a, b) {
          return b.__score - a.__score;
        })
        .slice(0, config.maxItems);

      render(root, scored, config);
      track("suggestions_view", { count: scored.length });
    } catch (err) {
      console.error("[SuggestionWidget]", err);
      root.innerHTML =
        '<div class="widget light">' +
        '<div class="title">Recommended for you</div>' +
        '<div class="meta">No suggestions right now.</div>' +
        "</div>";
    }
  })();
})();