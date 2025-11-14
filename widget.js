(function () {
  // Run init whether DOM is ready or already loaded
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
    let currentSlug = (container.getAttribute("data-current-slug") || "")
      .replace(/^\/|\/$/g, ""); // trim slashes

    // Fallback: derive slug from current URL if not provided
    if (!currentSlug) {
      const parts = window.location.pathname.split("/").filter(Boolean);
      currentSlug = parts[parts.length - 1] || "";
      console.log("[RelatedPosts] Derived slug from URL:", currentSlug);
    } else {
      console.log("[RelatedPosts] Using slug from data-current-slug:", currentSlug);
    }

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
          console.warn("[RelatedPosts] No items found in feed.");
          container.textContent = "No related posts found.";
          return;
        }

        const posts = items.map(normalizePost);

        console.log("[RelatedPosts] Example normalized post:", posts[0]);

        // Find the current post in the feed
        let currentPost =
          posts.find(function (p) {
            return p.slug === currentSlug;
          }) ||
          posts.find(function (p) {
            return (p.url || "").indexOf("/" + currentSlug) !== -1;
          });

        if (!currentPost) {
          console.warn("[RelatedPosts] Could not find current post by slug:", currentSlug);
        } else {
          console.log("[RelatedPosts] Found current post:", currentPost.title, currentPost.url);
        }

        const currentTags = new Set((currentPost && currentPost.tags) || []);
        console.log("[RelatedPosts] Current tags:", Array.from(currentTags));

        const scored = posts
          .filter(function (p) {
            if (currentPost && p.url === currentPost.url) return false;
            return true;
          })
          .map(function (p) {
            let score = 0;

            // tag overlap
            if (currentTags.size > 0) {
              p.tags.forEach(function (tag) {
                if (currentTags.has(tag)) score += 2;
              });
            }

            return { post: p, score: score };
          })
          .sort(function (a, b) {
            return b.score - a.score;
          });

        console.log("[RelatedPosts] Top scores:", scored.slice(0, 5));

        const top = scored.slice(0, maxItems).map(function (s) {
          return s.post;
        });

        if (!top.length) {
          console.info("[RelatedPosts] No related posts to display.");
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

  // Normalize one Squarespace item
  function normalizePost(item) {
    const fullUrl = item.fullUrl || item.url || "";

    let slug = "";
    try {
      const u = fullUrl.startsWith("http")
        ? new URL(fullUrl)
        : new URL(fullUrl, window.location.origin);

      const segments = u.pathname.split("/").filter(Boolean);
      slug = segments[segments.length - 1] || "";
    } catch (e) {}

    // Tags as strings
    let tags = [];
    if (Array.isArray(item.tags)) {
      tags = item.tags.map(function (t) {
        return typeof t === "string" ? t : (t && t.name) || "";
      }).filter(Boolean);
    }

    // Excerpt from excerpt/body
    let excerpt = "";
    if (item.excerpt) excerpt = stripHtml(item.excerpt);
    else if (item.body) excerpt = stripHtml(item.body);
    if (excerpt.length > 200) excerpt = excerpt.slice(0, 197) + "...";

    // Thumbnail from assetUrl (this exists in your JSON)
    const thumbnail = item.assetUrl || "";

    return {
      raw: item,
      url: fullUrl,
      slug: slug,
      title: item.title || "Untitled",
      tags: tags,
      excerpt: excerpt,
      thumbnail: thumbnail
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
