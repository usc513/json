(function () {
  function initRelatedPosts() {
    console.log("[RelatedPosts] init");

    const container = document.getElementById("related-posts");
    if (!container) {
      console.warn("[RelatedPosts] #related-posts container not found.");
      return;
    }

    const feedUrl = container.getAttribute("data-feed-url");
    const currentSlug = (container.getAttribute("data-current-slug") || "").replace(/^\/|\/$/g, "");
    const maxItems = parseInt(container.getAttribute("data-max-items") || "3", 10);

    if (!feedUrl) {
      console.warn("[RelatedPosts] Missing data-feed-url on #related-posts.");
      container.textContent = "No related posts available.";
      return;
    }

    console.log("[RelatedPosts] Fetching feed:", feedUrl, "slug:", currentSlug);

    fetch(feedUrl)
      .then(function (res) {
        if (!res.ok) {
          throw new Error("Network response was not ok: " + res.status);
        }
        return res.json();
      })
      .then(function (data) {
        // Be generous in what we accept as "items"
        let items = [];

        if (Array.isArray(data.items)) {
          items = data.items;
        } else if (data.collection && Array.isArray(data.collection.items)) {
          items = data.collection.items;
        } else if (Array.isArray(data)) {
          items = data;
        } else if (Array.isArray(data.blogItems)) {
          items = data.blogItems;
        }

        console.log("[RelatedPosts] items length:", items.length);

        if (!items.length) {
          console.warn("[RelatedPosts] No items found in JSON feed.");
          container.textContent = "No related posts found.";
          return;
        }

        const normalized = items.map(function (item) {
          const fullUrl = item.fullUrl || item.url || "";
          const url = fullUrl;
          const title = item.title || "Untitled";
          const tags = item.tags || item.categories || [];
          const excerpt = item.excerpt || item.body || "";
          const assetUrl =
            item.assetUrl ||
            (item.media && item.media[0] && item.media[0].url) ||
            "";

          let slugFromUrl = "";
          try {
            const u = fullUrl.startsWith("http")
              ? new URL(fullUrl)
              : new URL(fullUrl, "https://example.com");
            const segments = u.pathname.split("/").filter(Boolean);
            slugFromUrl = segments[segments.length - 1] || "";
          } catch (e) {
            slugFromUrl = "";
          }

          return {
            raw: item,
            url: url,
            title: title,
            tags: Array.isArray(tags) ? tags : [],
            excerpt: excerpt,
            assetUrl: assetUrl,
            slug: slugFromUrl
          };
        });

        let currentPost = null;

        if (currentSlug) {
          currentPost =
            normalized.find(function (p) {
              return p.slug === currentSlug;
            }) ||
            normalized.find(function (p) {
              return (p.url || "").indexOf("/" + currentSlug) !== -1;
            });
        }

        if (!currentPost) {
          console.warn(
            "[RelatedPosts] Could not find current post in feed. Slug:",
            currentSlug
          );
          // We'll still proceed and just show "recent-ish" posts
        }

        const currentTags = new Set((currentPost && currentPost.tags) || []);

        const scored = normalized
          .filter(function (p) {
            if (currentPost && p.url === currentPost.url) return false;
            return true;
          })
          .map(function (p) {
            let score = 0;

            if (currentTags.size > 0) {
              p.tags.forEach(function (tag) {
                if (currentTags.has(tag)) score += 2; // shared tags weighted
              });
            }

            const timestamp =
              p.raw && (p.raw.publishOn || p.raw.firstPublishedOn || p.raw.timestamp);
            if (timestamp) {
              score += (Number(timestamp) || 0) / 1000000000000;
            }

            return { post: p, score: score };
          })
          .sort(function (a, b) {
            return b.score - a.score;
          });

        const top = scored.slice(0, maxItems).map(function (s) {
          return s.post;
        });

        if (!top.length) {
          console.info("[RelatedPosts] No related posts to display after scoring.");
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

  function renderRelatedPosts(container, posts) {
    const wrapper = document.createElement("div");
    wrapper.className = "related-posts-widget";

    const heading = document.createElement("h3");
    heading.textContent = "Related Posts";
    wrapper.appendChild(heading);

    const list = document.createElement("ul");
    list.className = "related-posts-list";

    posts.forEach(function (post) {
      const li = document.createElement("li");
      li.className = "related-post-item";

      const a = document.createElement("a");
      a.href = post.url;
      a.textContent = post.title;
      a.className = "related-post-link";

      li.appendChild(a);

      if (post.tags && post.tags.length) {
        const tags = document.createElement("div");
        tags.className = "related-post-tags";
        tags.textContent = post.tags.join(", ");
        li.appendChild(tags);
      }

      list.appendChild(li);
    });

    wrapper.appendChild(list);

    container.innerHTML = "";
    container.appendChild(wrapper);
  }

  // === Make sure init runs no matter when this script loads ===
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initRelatedPosts);
  } else {
    // DOM is already ready (our case when script is injected on window.load)
    initRelatedPosts();
  }
})();
