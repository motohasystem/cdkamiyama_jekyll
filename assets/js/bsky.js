(function() {
    const container = document.getElementById("bsky-posts");
    const anchor = document.getElementById("bskyrss");
    if (!container || !anchor) return;

    const jsonUrl = anchor.getAttribute("data-feed-json") || "/assets/data/note-feed.json";

    // 許可するホスト（完全一致、またはそのサブドメイン）。画像は CSP の img-src とも揃えること
    const LINK_HOSTS = ["note.com"];
    const THUMBNAIL_HOSTS = ["assets.st-note.com"];

    function safeUrl(value, hosts) {
        if (typeof value !== "string" || !value) return "";
        try {
            const url = new URL(value);
            const hostOk = hosts.some(h => url.hostname === h || url.hostname.endsWith("." + h));
            return url.protocol === "https:" && hostOk ? url.href : "";
        } catch (e) {
            return "";
        }
    }

    fetch(jsonUrl)
        .then(res => {
            if (!res.ok) {
                throw new Error("Failed to fetch feed json: " + res.status);
            }
            return res.json();
        })
        .then(data => {
            const items = Array.isArray(data?.items) ? data.items : [];

            const list = document.createElement("ul");
            list.className = "note-cards";

            Array.from(items).slice(0, 5).forEach(item => {
                const title = item.title || "";
                // 上流（note）のURLは https かつ想定ドメインのものだけ使う（javascript: 等の混入対策）
                const link = safeUrl(item.link, LINK_HOSTS);
                const thumbnail = safeUrl(item.thumbnail, THUMBNAIL_HOSTS);
                if (!title || !link) return;

                const li = document.createElement("li");
                li.className = "note-card";

                const a = document.createElement("a");
                a.href = link;
                a.target = "_blank";
                a.rel = "noopener";

                if (thumbnail) {
                    const img = document.createElement("img");
                    img.src = thumbnail;
                    img.alt = title;
                    a.appendChild(img);
                }

                const titleEl = document.createElement("span");
                titleEl.textContent = title;
                a.appendChild(titleEl);

                li.appendChild(a);
                list.appendChild(li);
            });

            container.appendChild(list);
        })
        .catch(err => console.error("Feed JSON fetch error:", err));
})();
