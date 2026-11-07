(function() {
    const section = document.getElementById("next-events");
    if (!section) return;

    const jsonUrl = section.getAttribute("data-events-json") || "/assets/data/events.json";
    const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

    // 表示はすべて日本時間で行う（閲覧者の端末のタイムゾーンに左右されないように）
    function jstParts(date) {
        const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
        return {
            year: jst.getUTCFullYear(),
            month: jst.getUTCMonth() + 1,
            day: jst.getUTCDate(),
            weekday: WEEKDAYS[jst.getUTCDay()],
            time: String(jst.getUTCHours()).padStart(2, "0") + ":" + String(jst.getUTCMinutes()).padStart(2, "0"),
        };
    }

    function isHttps(value) {
        try {
            return typeof value === "string" && new URL(value).protocol === "https:";
        } catch (e) {
            return false;
        }
    }

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text) node.textContent = text;
        return node;
    }

    function render(card, event) {
        const start = new Date(event.start);
        const end = new Date(event.end);
        const s = jstParts(start);
        const today = jstParts(new Date());
        const isToday = s.year === today.year && s.month === today.month && s.day === today.day;

        const head = el("div", "next-events__head");
        head.appendChild(el("span", "next-events__name", card.getAttribute("data-name")));
        head.appendChild(el("span", isToday ? "next-events__badge is-today" : "next-events__badge", isToday ? "本日開催" : "次回の開催"));
        card.appendChild(head);

        const dateLine = el("p", "next-events__date");
        dateLine.appendChild(el("span", "next-events__md", s.month + "/" + s.day));
        dateLine.appendChild(el("span", "next-events__wd", "（" + s.weekday + "）"));
        card.appendChild(dateLine);

        if (!event.allDay) {
            card.appendChild(el("p", "next-events__time", s.time + " 〜 " + jstParts(end).time));
        }
        if (event.place) {
            card.appendChild(el("p", "next-events__place", event.place));
        }

        // 申込URLが予定の説明にあればそれを、なければ道場ごとのリンクを出す
        // カレンダー由来のURLは https のものだけ使う（javascript: 等の混入対策）
        const eventUrl = isHttps(event.url) ? event.url : "";
        const href = eventUrl || card.getAttribute("data-link");
        if (href) {
            const a = el("a", "next-events__link", eventUrl ? "参加申込はこちら" : card.getAttribute("data-link-label") || "詳しくはこちら");
            a.href = href;
            if (/^https?:/.test(href)) {
                a.target = "_blank";
                a.rel = "noopener";
            }
            card.appendChild(a);
        }
        card.hidden = false;
    }

    fetch(jsonUrl)
        .then(res => {
            if (!res.ok) {
                throw new Error("Failed to fetch events json: " + res.status);
            }
            return res.json();
        })
        .then(data => {
            const events = Array.isArray(data?.events) ? data.events : [];
            const now = Date.now();
            let shown = 0;

            section.querySelectorAll(".next-events__card").forEach(card => {
                const dojo = card.getAttribute("data-dojo");
                // 終了時刻を過ぎていない最初の回（JSONが多少古くても正しい回を選べる）
                const next = events.find(ev => ev.dojo === dojo && new Date(ev.end).getTime() > now);
                if (next) {
                    render(card, next);
                    shown++;
                }
            });
            section.hidden = shown === 0;
        })
        .catch(err => {
            console.error(err);
        });
})();
