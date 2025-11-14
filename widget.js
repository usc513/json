(function () {

  // Run init whether DOM is ready or already loaded
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // ===========================================================
  // INIT
  // ===========================================================
  function init() {
    console.log("[RelatedPosts] init");

    const container = document.getElementById("related-posts");
    if (!container) {
      console.warn("[RelatedPosts] No #related-posts container found.");
      return;
    }

    const feedUrl = container.getAttribute("data-feed-url");
    const currentSlug = (container.getAttribute("data-current-slug") || "")
      .replace(/^\/|\/$/g, ""); // remove leading/trailing slashes
    const maxItems = parseInt(container.getAttribute("data-max-items") || "3", 10);

    if (!feedUrl) {
      container.textContent = "Missing feed URL.";
      return;
    }

    console.log("[RelatedPosts] Fetching:", feedUrl);

    fetch(feedUrl)
      .then(res => {
        if (!res.ok) throw new Error("Failed to load JSON feed");
        return res.json();
      })
      .then(data => {
        let items = [];

        // Squarespace JSON shapes
        if (Array.isArray(data.items)) items = data.items;
        else if (data.collection && Array.isArray(data.collection.items))
          items = data.collection.items;

        if (!items.length) {
          console.warn("[RelatedPosts] Feed has no items");
          container.textContent = "No related posts found.";
          return;
        }

        console.log("[RelatedPosts] Items found:", items.length);

        const posts = items.map(normalizePost);

        // Find current post by slug
        let currentPost =
          posts.find(p => p.slug === currentSlug) ||
          posts.find(p => (p.url || "").includes("/" + currentSlug));

        const currentTags = new Set((currentPost && currentPost.tags) || []);

        // Score all other posts
        const scored = posts
          .filter(p => !currentPost || p.url !== currentPost.url)
          .map(p => {
            let score = 0;

            // Shared tags score
            p.tags.forEach(tag => {
              if (currentTags.has(tag)) score += 2;
            });

            return { post: p, score };
          })
          .sort((a, b) => b.score - a.score);

        const top = scored.slice(0, maxItems).map(s => s.post);

        if (!top.length) {
          container.textContent = "No related posts found.";
          return;
        }

        renderRelatedPosts(container, top);
      })
      .catch(err => {
        console.error("[RelatedPosts] Error:", err);
        container.textContent = "Unable to load related posts.";
      });
  }

  // ===========================================================
  // NORMALIZE POST FROM SQUARESPACE JSON
  // ===========================================================
  function normalizePost(item) {
    // URL
    const fullUrl = item.fullUrl || item.url || "";

    // Title
    const title = item.title || "Untitled";

    // Slug
    let slug = "";
    try {
      const u = fullUrl.startsWith("http")
        ? new URL(fullUrl)
        : new URL(fullUrl, window.location.origin);

      const seg = u.pathname.split("/").filter(Boolean);
      slug = seg[seg.length - 1] || "";
    } catch (e) {}

    // Tags (Squarespace uses arrays of strings)
    let tags = [];
    if (Array.isArray(item.tags)) {
      tags = item.tags.map(t => typeof t === "string" ? t : t.name || "");
    }

    // Excerpt text (strip HTML)
    let excerpt = "";
    if (item.excerpt) excerpt = stripHtml(item.excerpt);
    else if (item.body) excerpt = stripHtml(item.body);
    if (excerpt.length > 200) excerpt = excerpt.slice(0, 197) + "...";

    // THUMBNAIL (your site uses assetUrl!)
    const thumbnail = item.assetUrl || "";

    return {
      raw: item,
      url: fullUrl,
      title,
      slug,
      tags,
      excerpt,
      thumbnail
    };
  }

  // Strip HTML to clean excerpt text
  function stripHtml(html) {
    return html ? html.replace(/<[^>]*>/g, "").trim() : "";
  }

  // ===========================================================
  // RENDER
  // ===========================================================
  function renderRelatedPosts(container, posts) {
    const wrapper = document.createElement("div");
    wrapper.className = "related-posts-widget";

    const heading = document.createElement("h3");
    heading.textContent = "Related Posts";
    wrapper.appendChild(heading);

    const grid = document.createElement("div");
    grid.className = "related-posts-grid";

    posts.forEach(post => {
      const card = document.createElement("a");
      card.href = post.url;
      card.className = "related-post-card";

      // THUMBNAIL
      if (post.thumbnail) {
        const img = document.createElement("img");
        img.src = post.thumbnail;
        img.className = "related-post-thumb";
        img.alt = post.title;
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

    // Inject into DOM
    container.innerHTML = "";
    container.appendChild(wrapper);
  }

})();
