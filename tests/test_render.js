// 上流データに不正な値が入ったときの描画側（bsky.js / next_events.js）の挙動を確認する。
// 実行: node tests/test_render.js   （依存パッケージなし。最小限の DOM を自前で用意する）
const assert = require("assert");
const fs = require("fs");
const path = require("path");

function makeNode(tag, attrs = {}) {
    return {
        tag, attrs, children: [], hidden: true, className: "",
        getAttribute(k) { return this.attrs[k] ?? null; },
        appendChild(c) { this.children.push(c); return c; },
        set innerHTML(v) { throw new Error("innerHTML は使わない: " + v); },
    };
}

function all(node) {
    return [node, ...node.children.flatMap(all)];
}

async function run(file, setup) {
    const src = fs.readFileSync(path.join(__dirname, "..", "assets", "js", file), "utf8");
    const env = setup();
    global.document = env.document;
    global.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve(env.data) });
    eval(src);
    await new Promise(r => setTimeout(r, 10));
    return env;
}

(async () => {
    // --- bsky.js（note フィード） ---
    {
        const container = makeNode("div");
        const env = await run("bsky.js", () => ({
            data: { items: [
                { title: "<img src=x onerror=alert(1)>", link: "https://note.com/a/n/1", thumbnail: "https://assets.st-note.com/a.png" },
                { title: "bad thumb", link: "https://note.com/a/n/2", thumbnail: "https://evil.example/x.png" },
                { title: "js", link: "javascript:alert(1)" },
                { title: "data", link: "data:text/html,<script>alert(1)</script>" },
                { title: "other host", link: "https://evil.example/" },
                { title: "lookalike", link: "https://note.com.evil.example/" },
            ] },
            // bsky.js は先頭5件だけ描画するので、検査したい項目は5件以内に収める
            document: {
                getElementById: id => (id === "bsky-posts" ? container : makeNode("a", { "data-feed-json": "x" })),
                createElement: tag => makeNode(tag),
            },
        }));
        const links = all(container).filter(n => n.tag === "a");
        assert.deepStrictEqual(links.map(a => a.href), ["https://note.com/a/n/1", "https://note.com/a/n/2"]);
        const imgs = all(container).filter(n => n.tag === "img");
        assert.deepStrictEqual(imgs.map(i => i.src), ["https://assets.st-note.com/a.png"]);
        const span = all(container).find(n => n.tag === "span");
        assert.strictEqual(span.textContent, "<img src=x onerror=alert(1)>"); // テキストとして入る
        assert.ok(links.every(a => a.rel === "noopener"));
        console.log("ok bsky.js");
        void env;
    }

    // --- next_events.js（開催予定） ---
    {
        const future = new Date(Date.now() + 86400000).toISOString();
        const later = new Date(Date.now() + 90000000).toISOString();
        const cards = [
            makeNode("div", { "data-dojo": "kamiyama", "data-name": "神山" }),
            makeNode("div", { "data-dojo": "hirono", "data-name": "広野", "data-link": "https://hirono.example/" }),
        ];
        const section = makeNode("section");
        section.querySelectorAll = () => cards;
        await run("next_events.js", () => ({
            data: { events: [
                { dojo: "kamiyama", title: "<script>alert(1)</script>", start: future, end: later, place: "<b>x</b>", url: "javascript:alert(1)" },
                { dojo: "hirono", title: "t", start: future, end: later, place: "p", url: "http://insecure.example/" },
            ] },
            document: { getElementById: () => section, createElement: tag => makeNode(tag) },
        }));
        const hrefs = cards.map(c => (all(c).find(n => n.tag === "a") || {}).href);
        assert.deepStrictEqual(hrefs, [undefined, "https://hirono.example/"]); // 不正URLは使わず、道場リンクに戻る
        const place = all(cards[0]).find(n => n.className === "next-events__place");
        assert.strictEqual(place.textContent, "<b>x</b>");
        console.log("ok next_events.js");
    }
})().catch(e => { console.error(e); process.exit(1); });
