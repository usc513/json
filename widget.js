(function () {
  document.addEventListener("DOMContentLoaded", function () {
    const container = document.getElementById("related-posts");
    if (!container) return;

    const feedUrl = container.getAttribute("data-feed-url");
    const currentSlug = (container.getAttribute("data-current-slug") || "").replace(/^\/|\/$/g, "");
    const maxItems = parseInt(container.getAttribute("data-max-items") || "3", 10);

    if (!feedUrl) {
      console.warn("[RelatedPosts] Missing data-feed-url on #related-posts.");
      return;
    }

    fetch(feedUrl)
      .then(function (res) {
        if (!res.ok) {
          throw new Error("Network response was not ok");
        }
        return res.json();
      })
      .then(function (data) {
        // Squarespace JSON usually has items on data.items or data.collection.items
        const items = data.items || (data.collection && data.collection.items) || [];
        if (!items.length) {
          console.warn("[RelatedPosts] No items found in JSON feed.");
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

          // Try to derive a slug from the URL: /blog/this-is-the-slug/
          let slugFromUrl = "";
          try {
            // If URL is relative, prepend dummy origin
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
          // We can still render "recent posts" if we want
        }

        const currentTags = new Set(
          (currentPost && currentPost.tags) || []
        );

        // Score posts by how many tags they share with the current post
        const scored = normalized
          .filter(function (p) {
            // Exclude current post
            if (currentPost && p.url === currentPost.url) return false;
            return true;
          })
          .map(function (p) {
            let score = 0;

            if (currentTags.size > 0) {
              p.tags.forEach(function (tag) {
                if (currentTags.has(tag)) score += 2; // weighted for shared tags
              });
            }

            // Optional: slight bump based on published date if available
            const timestamp =
              p.raw && (p.raw.publishOn || p.raw.firstPublishedOn || p.raw.timestamp);
            if (timestamp) {
              // newer posts get a tiny bump
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
          console.info("[RelatedPosts] No related posts to display.");
          return;
        }

        renderRelatedPosts(container, top);
      })
      .catch(function (err) {
        console.error("[RelatedPosts] Error fetching or processing feed:", err);
      });
  });

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

      // Optional: show tags under the title
      if (post.tags && post.tags.length) {
        const tags = document.createElement("div");
        tags.className = "related-post-tags";
        tags.textContent = post.tags.join(", ");
        li.appendChild(tags);
      }

      list.appendChild(li);
    });

    wrapper.appendChild(list);

    // Clear any placeholder text and inject
    container.innerHTML = "";
    container.appendChild(wrapper);
  }
})();
