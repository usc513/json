(function () {
  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  // Felt-need topic configuration
  const TOPIC_CONFIG = [
    {
      id: "loss-grief",
      title: "Loss & Grief",
      description: "Resources for those walking through loss, sadness, or deep hurt.",
      matchTags: ["Loss", "Grief", "Pain", "Death", "Hurting", "Trauma"]
    },
    {
      id: "anxiety-stress",
      title: "Anxiety & Overwhelm",
      description: "Help when your mind won’t stop racing and your heart feels heavy.",
      matchTags: ["Anxiety", "Stress", "Overwhelmed", "Fear", "Worry"]
    },
    {
      id: "healing-trauma",
      title: "Healing & Recovery",
      description: "Finding hope and healing from what you’ve been through.",
      matchTags: ["Trauma", "Healing", "Hurting", "Weary", "Tired"]
    },
    {
      id: "purpose-meaning",
      title: "Purpose & Calling",
      description: "For when you’re asking, \"Why am I here?\" and \"Does my life matter?\"",
      matchTags: ["Purpose", "Meaning", "Goals", "Discovery", "Personal Growth"]
    },
    {
      id: "marriage-family",
      title: "Marriage & Family",
      description: "Encouragement for the relationships that matter most.",
      matchTags: ["Marriage", "Family", "Parenting", "Kids", "Relationships"]
    },
    {
      id: "faith-doubt",
      title: "Faith & Doubt",
      description: "Honest answers for big questions about God and Christianity.",
      matchTags: ["Faith", "Doubts", "Christianity", "Christian Faith", "Apologetics"]
    }
  ];

  function stripHtml(html) {
    const div = document.createElement("div");
    div.innerHTML = html || "";
    return (div.textContent || div.innerText || "").trim();
  }

  function normalizePost(item) {
    const base = "https://www.encounterchurch.com";

    const fullUrl = item.fullUrl
      ? item.fullUrl.startsWith("http")
        ? item.fullUrl
        : base.replace(/\/$/, "") + item.fullUrl
      : item.url || "";

    let tags = item.tags || item.categories || [];
    if (Array.isArray(tags)) {
      tags = tags
        .map(function (t) {
          if (typeof t === "string") return t;
          if (t && typeof t === "object" && t.name) return t.name;
          return "";
        })
        .filter(Boolean);
    } else {
      tags = [];
    }

    const excerpt =
      item.excerpt && item.excerpt.length
        ? stripHtml(item.excerpt)
        : item.body
        ? stripHtml(item.body).slice(0, 200) + "..."
        : "";

    return {
      title: item.title || "Untitled",
      url: fullUrl,
      tags: tags,
      excerpt: excerpt,
      thumbnail: item.assetUrl || "",
      publishOn: Number(item.publishOn) || 0
    };
  }

  function groupByTopics(posts, maxTopics, maxPostsPerTopic) {
    const topics = [];

    TOPIC_CONFIG.forEach(function (topic) {
      const matches = posts
        .filter(function (p) {
          if (!p.tags || !p.tags.length) return false;
          return p.tags.some(function (tag) {
            return topic.matchTags.includes(tag);
          });
        })
        .sort(function (a, b) {
          return (b.publishOn || 0) - (a.publishOn || 0);
        })
        .slice(0, maxPostsPerTopic);

      if (matches.length) {
        topics.push({
          id: topic.id,
          title: topic.title,
          description: topic.description,
          posts: matches
        });
      }
    });

    return topics.slice(0, maxTopics);
  }

  function renderWidget(root, topics, askEndpoint, siteName) {
    root.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.className = "felt-widget-root";

    // Header
    const header = document.createElement("div");
    header.className = "felt-widget-header";

    const h2 = document.createElement("h2");
    h2.textContent = "Find Help for What You’re Facing";
    header.appendChild(h2);

    const p = document.createElement("p");
    p.textContent =
      "Explore topics and articles from " +
      (siteName || "our church") +
      " or ask a Bible question.";
    header.appendChild(p);

    wrapper.appendChild(header);

    // Topics grid
    if (topics.length) {
      const grid = document.createElement("div");
      grid.className = "felt-widget-topics-grid";

      topics.forEach(function (topic) {
        const card = document.createElement("div");
        card.className = "felt-topic-card";

        const title = document.createElement("h3");
        title.textContent = topic.title;
        card.appendChild(title);

        const desc = document.createElement("p");
        desc.className = "felt-topic-description";
        desc.textContent = topic.description;
        card.appendChild(desc);

        const postList = document.createElement("div");
        postList.className = "felt-topic-posts";

        topic.posts.forEach(function (post) {
          const item = document.createElement("a");
          item.className = "felt-topic-post";
          item.href = post.url;

          // Thumbnail
          if (post.thumbnail) {
            const imgWrap = document.createElement("div");
            imgWrap.className = "felt-topic-thumb";

            const img = document.createElement("img");
            img.src = post.thumbnail;
            img.alt = post.title;

            imgWrap.appendChild(img);
            item.appendChild(imgWrap);
          }

          const textWrap = document.createElement("div");
          textWrap.className = "felt-topic-text";

          const t = document.createElement("div");
          t.className = "felt-topic-post-title";
          t.textContent = post.title;
          textWrap.appendChild(t);

          if (post.excerpt) {
            const ex = document.createElement("div");
            ex.className = "felt-topic-post-excerpt";
            ex.textContent = post.excerpt;
            textWrap.appendChild(ex);
          }

          item.appendChild(textWrap);
          postList.appendChild(item);
        });

        card.appendChild(postList);
        grid.appendChild(card);
      });

      wrapper.appendChild(grid);
    } else {
      const noTopics = document.createElement("p");
      noTopics.className = "felt-widget-empty";
      noTopics.textContent =
        "We’re adding resources for this page. Check back soon.";
      wrapper.appendChild(noTopics);
    }

    // Ask-a-question box
    if (askEndpoint) {
      const askBox = document.createElement("div");
      askBox.className = "felt-ask-box";

      const askTitle = document.createElement("h3");
      askTitle.textContent = "Ask a Bible Question";
      askBox.appendChild(askTitle);

      const askText = document.createElement("p");
      askText.textContent =
        "Have a question about God, the Bible, or faith? Ask below and get a thoughtful, Bible-based response.";
      askBox.appendChild(askText);

      const form = document.createElement("form");
      form.className = "felt-ask-form";

      const textarea = document.createElement("textarea");
      textarea.placeholder = "Type your question here…";
      textarea.required = true;
      form.appendChild(textarea);

      const button = document.createElement("button");
      button.type = "submit";
      button.textContent = "Ask Now";
      form.appendChild(button);

      const status = document.createElement("div");
      status.className = "felt-ask-status";
      askBox.appendChild(status);

      const answer = document.createElement("div");
      answer.className = "felt-ask-answer";
      askBox.appendChild(answer);

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        const q = textarea.value.trim();
        if (!q) return;

        status.textContent = "Thinking...";
        answer.textContent = "";
        button.disabled = true;

        fetch(askEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            question: q,
            pageUrl: window.location.href
          })
        })
          .then(function (res) {
            if (!res.ok) {
              throw new Error("Network response was not ok");
            }
            return res.json();
          })
          .then(function (data) {
            status.textContent = "";
            const text =
              (data && (data.answer || data.message)) ||
              "Thanks for your question. We’ll follow up soon.";
            answer.textContent = text;
            textarea.value = "";
          })
          .catch(function (err) {
            console.error("[FeltWidget] ask error", err);
            status.textContent =
              "Sorry, something went wrong. Please try again later.";
          })
          .finally(function () {
            button.disabled = false;
          });
      });

      askBox.appendChild(form);
      wrapper.appendChild(askBox);
    }

    root.appendChild(wrapper);
  }

  function initOne(root) {
    const feedUrl = root.getAttribute("data-feed-url");
    const maxTopics = parseInt(
      root.getAttribute("data-max-topics") || "6",
      10
    );
    const maxPostsPerTopic = parseInt(
      root.getAttribute("data-max-posts-per-topic") || "3",
      10
    );
    const askEndpoint = root.getAttribute("data-ask-endpoint") || "";
    const siteName = root.getAttribute("data-site-name") || "";

    if (!feedUrl) {
      console.warn("[FeltWidget] Missing data-feed-url");
      return;
    }

    root.innerHTML = "<p>Loading topics...</p>";

    fetch(feedUrl)
      .then(function (res) {
        if (!res.ok) {
          throw new Error("Network response was not ok");
        }
        return res.json();
      })
      .then(function (data) {
        const items =
          data.items ||
          (data.collection && data.collection.items) ||
          [];

        if (!items.length) {
          root.innerHTML = "<p>No posts available yet.</p>";
          return;
        }

        const posts = items.map(normalizePost);
        const topics = groupByTopics(
          posts,
          maxTopics,
          maxPostsPerTopic
        );

        renderWidget(root, topics, askEndpoint, siteName);
      })
      .catch(function (err) {
        console.error("[FeltWidget] feed error", err);
        root.innerHTML =
          "<p>Unable to load resources right now. Please try again later.</p>";
      });
  }

  ready(function () {
    const roots = document.querySelectorAll(".felt-widget");
    if (!roots.length) return;
    roots.forEach(initOne);
  });
})();
