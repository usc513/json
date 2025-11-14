(function () {
  function init() {
    const container = document.getElementById("related-posts");
    if (!container) return;

    const feedUrl = container.getAttribute("data-feed-url");
    const maxItems = parseInt(container.getAttribute("data-max-items") || "3", 10);

    // Derive slug from URL
    const currentSlug = window.location.pathname.replace(/^\/blog\/|\/$/g, "");

    if (!feedUrl) {
      console.warn("[RelatedPosts] Missing data-feed-url on #related-posts.");
      return;
    }

    fetch(feedUrl)
      .then((res) => {
        if (!res.ok) throw new Error("Network response not ok");
        return res.json();
      })
      .then((data) => {
        const items = data.items || (data.collection && data.collection.items) || [];
        if (!items.length) {
          console.warn("[RelatedPosts] No items found in feed.");
          container.textContent = "No related posts found.";
          return;
        }

        const posts = items.map(normalizePost);

        // Find current post
        const currentPost = posts.find((p) => p.slug === currentSlug);

        const currentTags = new Set((currentPost && currentPost.tags) || []);

        // Score by shared tags
        const scored = posts
          .filter((p) => p.slug !== currentSlug)
          .map((p) => {
            let score = 0;
            p.tags.forEach((t) => {
              if (currentTags.has(t)) score += 2;
            });
            return { post: p, score };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, maxItems)
          .map((x) => x.post);

        renderCards(container, scored);
      })
      .catch((err) => {
        console.error("[RelatedPosts] Error:", err);
        container.textContent = "Unable to load related posts.";
      });
  }

  // Normalize Squarespace post object
  function normalizePost(item) {
    const fullUrl = item.fullUrl || item.url || "";
    const title = item.title || "Untitled";
    const thumbnail = item.assetUrl || "";
    let excerpt = item.excerpt || "";

    if (!excerpt && item.body) excerpt = stripHtml(item.body);
    excerpt = excerpt.slice(0, 150) + "...";

    // Tags to strings
    let tags = item.tags || [];
    if (Array.isArray(tags)) {
      tags = tags
        .map((t) => (typeof t === "string" ? t : t.name || ""))
        .filter(Boolean);
    }

    // Create slug
    let slug = "";
    try {
      const u = new URL(fullUrl, window.location.origin);
      const parts = u.pathname.split("/").filter(Boolean);
      slug = parts[parts.length - 1] || "";
    } catch (e) {}

    return { url: fullUrl, title, excerpt, thumbnail, tags, slug };
  }

  // Remove HTML tags
  function stripHtml(html) {
    var tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  }

  // Render cards
  function renderCards(container, posts) {
    container.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.style.display = "grid";
    wrapper.style.gridTemplateColumns = "repeat(auto-fit, minmax(250px, 1fr))";
    wrapper.style.gap = "20px";

    posts.forEach((post) => {
      const card = document.createElement("a");
      card.href = post.url;
      card.style.display = "block";
      card.style.border = "1px solid #ddd";
      card.style.borderRadius = "8px";
      card.style.overflow = "hidden";
      card.style.textDecoration = "none";
      card.style.color = "inherit";
      card.style.background = "white";

      const img = document.createElement("img");
      img.src = post.thumbnail;
      img.alt = post.title;
      img.style.width = "100%";
      img.style.height = "160px";
      img.style.objectFit = "cover";

      const body = document.createElement("div");
      body.style.padding = "12px";

      const title = document.createElement("h4");
      title.textContent = post.title;
      title.style.margin = "0 0 10px 0";
      title.style.fontSize = "1.1rem";

      const excerpt = document.createElement("p");
      excerpt.textContent = post.excerpt;
      excerpt.style.margin = "0";
      excerpt.style.color = "#444";
      excerpt.style.fontSize = "0.9rem";

      body.appendChild(title);
      body.appendChild(excerpt);

      card.appendChild(img);
      card.appendChild(body);
      wrapper.appendChild(card);
    });

    container.appendChild(wrapper);
  }

  // Initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
