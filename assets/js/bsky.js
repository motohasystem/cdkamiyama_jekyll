(function() {
    const container = document.getElementById("bsky-posts");
    const anchor = document.getElementById("bskyrss");
    if (!container || !anchor) return;

    const jsonUrl = anchor.getAttribute("data-feed-json") || "/assets/data/note-feed.json";

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
                const link = item.link || "";
                const thumbnail = item.thumbnail || "";
                if (!title || !link) return;

                const li = document.createElement("li");
                li.className = "note-card";

                const a = document.createElement("a");
                a.href = link;
                a.target = "_blank";

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
