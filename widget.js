(function () {

  // Run init immediately if DOM is ready, or wait for DOMContentLoaded
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // MAIN FUNCTION
  function init() {
    console.log("[RelatedPosts] init");

    const container = document.getElementById("related-posts");
    if (!container) {
      console.warn("[RelatedPosts] #related-posts not found.");
      return;
    }

    const feedUrl = container.getAttribute("data-feed-url");
    const currentSlug = (container.getAttribute("data-current-slug") || "")
      .replace(/^\/|\/$/g, "");
    const maxItems = parseInt(
      container.getAttribute("data-max-items") || "3",
      10
    );

    if (!feedUrl) {
      console.warn("[RelatedPosts] Missing data-feed-url.");
      container.textContent = "No related posts available.";
      return;
    }

    console.log("[RelatedPosts] Fetching feed:", feedUrl);

    fetch(feedUrl)
      .then(res => {
        if (!res.ok) throw new Error("Bad feed response " + res.status);
        return res.json();
      })
      .then(data => {
        let items = [];

        if (Array.isArray(data.items)) {
          items = data.items;
        } else if (data.collection && Array.isArray(data.collection.items)) {
          items = data.collection.items;
        }

        console.log("[RelatedPosts] items:", items.length);

        if (!items.length) {
          container.textContent = "No related posts found.";
          return;
        }

        const normalized = items.map(item => {
          const fullUrl = item.fullUrl || item.url || "";
          const title = item.title || "Untitled";
          const tags = Array.isArray(item.tags) ? item.tags : [];

          // Extract slug from URL
          let slug = "";
          try {
            const u = fullUrl.startsWith("http")
              ? new URL(fullUrl)
              : new URL(fullUrl, "https://example.com");

            const seg = u.pathname.split("/").filter(Boolean);
            slug = seg[seg.length - 1];
          } catch (e) {}

          return {
            raw: item,
            url: fullUrl,
            title: title,
            tags: tags,
            slug: slug
          };
        });

        // Find the current post
        let currentPost =
          normalized.find(p => p.slug === currentSlug) ||
          normalized.find(p => (p.url || "").includes("/" + currentSlug));

        const currentTags = new Set(
          (currentPost && currentPost.tags) || []
        );

        // Score other posts by shared tags
        const scored = normalized
          .filter(p => !currentPost || p.url !== currentPost.url)
          .map(p => {
            let score = 0;
            p.tags.forEach(tag => {
              if (currentTags.has(tag)) score += 2;
            });
            return { post: p, score: score };
          })
          .sort((a, b) => b.score - a.score);

        const top = scored.slice(0, maxItems).map(s => s.post);

        if (!top.length) {
          container.textContent = "No related posts found.";
          return;
        }

        render(container, top);
      })
      .catch(err => {
        console.error("[RelatedPosts] Error:", err);
        container.textContent = "Unable to load related posts.";
      });
  }

  // Render the list
  function render(container, posts) {
    const wrapper = document.createElement("div");
    wrapper.className = "related-posts-widget";

    const heading = document.createElement("h3");
    heading.textContent = "Related Posts";
    wrapper.appendChild(heading);

    const ul = document.createElement("ul");

    posts.forEach(p => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = p.url;
      a.textContent = p.title;
      li.appendChild(a);
      ul.appendChild(li);
    });

    wrapper.appendChild(ul);

    // Replace loading text
    container.innerHTML = "";
    container.appendChild(wrapper);
  }

})();
