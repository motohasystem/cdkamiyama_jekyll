(function() {
    const container = document.getElementById("bsky-posts");
    const anchor = document.getElementById("bskyrss");
    if (!container || !anchor) return;

    const feedUrl = anchor.getAttribute("feed");
    const proxyUrl = "https://api.allorigins.win/raw?url=" + encodeURIComponent(feedUrl);

    fetch(proxyUrl)
        .then(res => res.text())
        .then(str => {
            const parser = new DOMParser();
            const xml = parser.parseFromString(str, "application/xml");
            const items = xml.querySelectorAll("item");

            const list = document.createElement("ul");
            list.className = "note-cards";

            Array.from(items).slice(0, 5).forEach(item => {
                const title = item.querySelector("title")?.textContent || "";
                const link = item.querySelector("link")?.textContent || "";

                // media:thumbnailはテキストコンテンツとしてURLを持つ
                let thumbnail = "";
                const mediaThumbnail = item.getElementsByTagNameNS("http://search.yahoo.com/mrss/", "thumbnail")[0];
                if (mediaThumbnail) {
                    thumbnail = mediaThumbnail.textContent || "";
                }

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
        .catch(err => console.error("RSS fetch error:", err));
})();
