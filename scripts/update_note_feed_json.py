#!/usr/bin/env python3
import argparse
import json
from pathlib import Path
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

from feed_guard import check_count, is_https


def parse_items(xml_bytes):
    root = ET.fromstring(xml_bytes)
    channel = root.find("./channel")
    if channel is None:
        return []

    items = []
    for item in channel.findall("./item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        pub_date = (item.findtext("pubDate") or "").strip()

        thumbnail = ""
        for child in item:
            tag = child.tag
            if tag == "{http://search.yahoo.com/mrss/}thumbnail":
                thumbnail = (child.text or "").strip()
                if not thumbnail:
                    thumbnail = (child.attrib.get("url") or "").strip()
                break

        # https 以外のURLは捨てる（javascript: 等の混入対策。描画側の bsky.js でもドメインを検査している）
        if thumbnail and not is_https(thumbnail):
            thumbnail = ""
        if title and is_https(link):
            items.append({
                "title": title,
                "link": link,
                "thumbnail": thumbnail,
                "publishedAt": pub_date,
            })
    return items


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--feed-url", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--limit", type=int, default=20)
    parser.add_argument("--min-items", type=int, default=1, help="これ未満なら更新しない")
    parser.add_argument("--allow-drop", action="store_true", help="前回からの急減を許可する")
    args = parser.parse_args()

    req = Request(args.feed_url, headers={"User-Agent": "cdkamiyama-feed-updater/1.0"})
    with urlopen(req) as resp:
        xml_bytes = resp.read()

    items = parse_items(xml_bytes)[: args.limit]
    check_count(len(items), args.output, "items", args.min_items, args.allow_drop)

    # 生成日時は入れない（記事に変化がなければファイルも変わらず、無駄なコミット＝デプロイを出さないため）
    payload = {
        "source": args.feed_url,
        "items": items,
    }

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
