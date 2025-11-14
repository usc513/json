(function () {
  // Run when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  function init() {
    console.log("[RelatedPosts] init");

    const container = document.getElementById("related-posts");
    if (!container) {
      console.warn("[RelatedPosts] No #related-posts container found.");
      return;
    }

    const feedUrl = container.getAttribute("data-feed-url");
    const maxItems = parseInt(container.getAttribute("data-max-items") || "3", 10);

    if (!feedUrl) {
      console.warn("[RelatedPosts] Missing data-feed-url on #related-posts.");
      container.textContent = "Missing feed URL.";
      return;
    }

    console.log("[RelatedPosts] Fetching feed:", feedUrl);

    fetch(feedUrl)
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to load JSON feed: " + res.status);
        return res.json();
      })
      .then(function (data) {
        console.log("[RelatedPosts] Raw data keys:", Object.keys(data));

        let items = [];
        if (Array.isArray(data.items)) {
          items = data.items;
        } else if (data.collection && Array.isArray(data.collection.items)) {
          items = data.collection.items;
        }

        console.log("[RelatedPosts] items.length =", items.length);

        if (!items.length) {
          container.textContent = "No related posts found.";
          return;
        }

        const posts = items.map(normalizePost);

        // Figure out the current post URL so we can exclude it
        const currentPath = window.location.pathname.replace(/\/+$/, ""); // trim trailing slash
        const currentFull = window.location.origin + currentPath;
        console.log("[RelatedPosts] currentPath:", currentPath);

        const filtered = posts.filter(function (p) {
          if (!p.url) return false;
          const postPath = p.url.replace(window.location.origin, "").replace(/\/+$/, "");
          return postPath !== currentPath; // exclude current post
        });

        console.log("[RelatedPosts] filtered count (excluding current):", filtered.length);

        // Sort by publishOn (newest first) if available
        filtered.sort(function (a, b) {
          const ta = a.publishOn || 0;
          const tb = b.publishOn || 0;
          return tb - ta;
        });

        const top = filtered.slice(0, maxItems);
        if (!top.length) {
          container.textContent = "No related posts found.";
          return;
        }

        renderRelatedPosts(container, top);
      })
      .catch(function (err) {
        console.error("[RelatedPosts] Error fetching or processing feed:", err);
        container.textContent = "Unable to load related posts.";
      });
  }

  function normalizePost(item) {
    const fullUrl = item.fullUrl || item.url || "";

    // Excerpt
    let excerpt = "";
    if (item.excerpt) excerpt = stripHtml(item.excerpt);
    else if (item.body) excerpt = stripHtml(item.body);
    if (excerpt.length > 200) excerpt = excerpt.slice(0, 197) + "...";

    // Thumbnail
    const thumbnail = item.assetUrl || "";

    // Tags (not used yet, but we keep them for future)
    let tags = [];
    if (Array.isArray(item.tags)) {
      tags = item.tags
        .map(function (t) {
          return typeof t === "string" ? t : (t && t.name) || "";
        })
        .filter(Boolean);
    }

    return {
      raw: item,
      url: fullUrl,
      title: item.title || "Untitled",
      excerpt: excerpt,
      thumbnail: thumbnail,
      tags: tags,
      publishOn: Number(item.publishOn) || 0
    };
  }

  function stripHtml(html) {
    return html ? html.replace(/<[^>]*>/g, "").trim() : "";
  }

  function renderRelatedPosts(container, posts) {
    console.log("[RelatedPosts] Rendering", posts.length, "posts");

    const wrapper = document.createElement("div");
    wrapper.className = "related-posts-widget";

    const heading = document.createElement("h3");
    heading.textContent = "Related Posts";
    wrapper.appendChild(heading);

    const grid = document.createElement("div");
    grid.className = "related-posts-grid";

    posts.forEach(function (post) {
      const card = document.createElement("a");
      card.href = post.url;
      card.className = "related-post-card";

      if (post.thumbnail) {
        const img = document.createElement("img");
        img.src = post.thumbnail;
        img.alt = post.title;
        img.className = "related-post-thumb";
        card.appendChild(img);
      }

      const title = document.createElement("div");
      title.className = "related-post-title";
      title.textContent = post.title;
      card.appendChild(title);

      if (post.excerpt) {
        const excerpt = document.createElement("div");
        excerpt.className = "related-post-excerpt";
        excerpt.textContent = post.excerpt;
        card.appendChild(excerpt);
      }

      grid.appendChild(card);
    });

    wrapper.appendChild(grid);

    container.innerHTML = "";
    container.appendChild(wrapper);
  }
})();
