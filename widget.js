(function () {

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  function init() {
    const container = document.getElementById("related-posts");
    if (!container) return;

    const feedUrl = container.getAttribute("data-feed-url");
    const maxItems = parseInt(container.getAttribute("data-max-items") || "3", 10);

    if (!feedUrl) {
      container.textContent = "Feed URL missing.";
      return;
    }

    container.textContent = "Loading related posts...";

    fetch(feedUrl)
      .then(r => r.json())
      .then(data => {
        let items = [];

        if (Array.isArray(data.items)) items = data.items;
        else if (data.collection && Array.isArray(data.collection.items))
          items = data.collection.items;

        if (!items.length) {
          container.textContent = "No related posts found.";
          return;
        }

        const posts = items.map(normalizePost);

        const currentPath = window.location.pathname.replace(/\/+$/, "");

        const filtered = posts.filter(p => {
          if (!p.url) return false;
          const postPath = p.url.replace(window.location.origin, "").replace(/\/+$/, "");
          return postPath !== currentPath;
        });

        filtered.sort((a, b) => b.publishOn - a.publishOn);

        const top = filtered.slice(0, maxItems);

        if (!top.length) {
          container.textContent = "No related posts found.";
          return;
        }

        render(top, container);
      })
      .catch(err => {
        console.error("[RelatedPosts] fetch error", err);
        container.textContent = "Unable to load related posts.";
      });
  }

  // CLEAN + FIXED NORMALIZER
  function normalizePost(item) {
    const fullUrl = item.fullUrl || item.url || "";

    let slug = "";
    try {
      const u = fullUrl.startsWith("http")
        ? new URL(fullUrl)
        : new URL(fullUrl, window.location.origin);
      const seg = u.pathname.split("/").filter(Boolean);
      slug = seg[seg.length - 1] || "";
    } catch (e) {}

    // Tags
    let tags = [];
    if (Array.isArray(item.tags)) {
      tags = item.tags
        .map(t => (typeof t === "string" ? t : (t && t.name) || ""))
        .filter(Boolean);
    }

    // Excerpt
    let excerpt = "";
    if (item.excerpt) excerpt = stripHtml(item.excerpt);
    else if (item.body) excerpt = stripHtml(item.body);
    if (excerpt.length > 200) excerpt = excerpt.slice(0, 197) + "...";

    // Thumbnail (this is what Squarespace provides)
    const thumbnail = item.assetUrl || "";

    return {
      raw: item,
      url: fullUrl,
      slug: slug,
      title: item.title || "Untitled",
      excerpt: excerpt,
      thumbnail: thumbnail,
      tags: tags,
      publishOn: Number(item.publishOn) || 0
    };
  }

  function stripHtml(html) {
    const d = document.createElement("div");
    d.innerHTML = html || "";
    return d.textContent || "";
  }

  function render(posts, container) {
    const wrapper = document.createElement("div");
    wrapper.className = "related-posts-wrapper";

    posts.forEach(p => {
      const card = document.createElement("div");
      card.className = "related-post";

      const img = document.createElement("img");
      img.className = "related-post-thumb";
      img.src = p.thumbnail;
      img.alt = p.title;

      const title = document.createElement("h4");
      title.textContent = p.title;

      const excerpt = document.createElement("p");
      excerpt.textContent = p.excerpt;

      const link = document.createElement("a");
      link.href = p.url;
      link.appendChild(img);
      link.appendChild(title);

      card.appendChild(link);
      card.appendChild(excerpt);
      wrapper.appendChild(card);
    });

    container.innerHTML = "";
    container.appendChild(wrapper);
  }

})();
