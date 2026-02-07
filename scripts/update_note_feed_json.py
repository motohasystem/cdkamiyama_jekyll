#!/usr/bin/env python3
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET


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

        if title and link:
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
    args = parser.parse_args()

    req = Request(args.feed_url, headers={"User-Agent": "cdkamiyama-feed-updater/1.0"})
    with urlopen(req) as resp:
        xml_bytes = resp.read()

    items = parse_items(xml_bytes)
    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": args.feed_url,
        "items": items[: args.limit],
    }

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
