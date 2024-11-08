(function (d, s, id) {
    var js,
        fjs = d.getElementsByTagName(s)[0];
    const anchor = d.getElementById(id);
    if (anchor == null) return;
    const feedurl = anchor.getAttribute("feed");

    function loadRSS(url, callback) {
        console.log({ url });
        const proxyurl = "https://api.rss2json.com/v1/api.json?rss_url=" + url;

        fetch(proxyurl)
            .then((response) => {
                if (!response.ok) {
                    throw new Error(
                        "Error fetching RSS feed:",
                        response.statusText
                    );
                }
                return response.text();
            })
            .then((str) => {
                const data = JSON.parse(str);
                callback(data);
            })
            .catch((error) => {
                console.error("Network error while fetching RSS feed:", error);
            });
    }

    // タイムスタンプから、現在時刻から見た相対的な時間表現に変換する
    function makeRelativeTime(timestamp) {
        const now = new Date();
        const date = new Date(timestamp);
        const diff = now - date;
        const sec = Math.floor(diff / 1000);
        const min = Math.floor(sec / 60);
        const hour = Math.floor(min / 60);
        const day = Math.floor(hour / 24);
        const week = Math.floor(day / 7);
        const month = Math.floor(day / 30);
        const year = Math.floor(day / 365);

        if (year > 0) {
            return year + "年前";
        } else if (month > 0) {
            return month + "ヶ月前";
        } else if (week > 0) {
            return week + "週間前";
        } else if (day > 0) {
            return day + "日前";
        } else if (hour > 0) {
            return hour + "時間前";
        } else if (min > 0) {
            return min + "分前";
        } else {
            return sec + "秒前";
        }
    }

    // nodeのinnerTextを分析して、URLと思われる部分をリンクに変換する
    function insert_link(node) {
        const text = node.innerText;
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        // const urlRegex = /(?<!\d{1,2}\/)([\w.-]+\/[\w\/.-]+)/g;
        const urls = text.match(urlRegex);
        if (urls == null) return node;

        urls.forEach((url) => {
            const link = document.createElement("a");
            link.href = url;
            link.textContent = url;
            node.innerHTML = node.innerHTML.replace(url, link.outerHTML);
        });

        return node;
    }

    function processRSS(data) {
        console.log({ data });

        const some = anchor.getAttribute("some");
        const keywords = some.split(/\s/).filter((word) => word.length > 0);

        const node = document.createElement("ul");
        node.classList.add("bluesky-timeline-item");

        data.items
            .filter((item) => {
                // item.descriptionに、pickup属性の文字列が含まれているかどうかをチェック
                console.log(item.description);
                return keywords.some(
                    (keyword) => item.description.indexOf(keyword) !== -1
                );
            })
            .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
            .slice(0, 5)
            .forEach((item) => {
                const link = item.link;
                console.log({ item });

                const description = item.description;
                const pubDate = item.pubDate;
                const relativeTime = makeRelativeTime(pubDate);
                const guid = item.guid;
                const content = item.content;

                const datelink = document.createElement("a");
                Object.assign(datelink, {
                    href: link,
                    textContent: relativeTime,
                    target: "_blank",
                    className: "item",
                });

                const date = document.createElement("li");
                date.className = "bsky-date";
                // date.appendChild(datelink)
                date.appendChild(datelink);

                let message = document.createElement("li");
                Object.assign(message, {
                    innerText: description,
                    className: "bsky-msg",
                });
                message = insert_link(message);

                node.appendChild(date);
                node.appendChild(message);
            });

        const wrapper = document.getElementById("bsky-posts");
        wrapper.appendChild(node);

        for (let i = 0; i < data.items.length; i++) {
            const item = data.items[i];
            const link = item.link;
            const description = item.description;
            const pubDate = item.pubDate;
            const guid = item.guid;
            const content = item.content;

            console.log("Link:", link);
            console.log("Description:", description);
            console.log("Publish Date:", pubDate);
            console.log("GUID:", guid);
            console.log("---");
        }
    }

    loadRSS(feedurl, processRSS);
})(document, "a", "bskyrss");
