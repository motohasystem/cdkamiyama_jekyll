#!/usr/bin/env python3
"""Googleカレンダー（公開iCal）から今後の開催予定を取り出してJSONに書き出す。

繰り返し予定・個別に日時変更した回は recurring_ical_events で展開する。
出力に生成日時を含めないのは、予定が変わらない限りファイルを変えず、無駄なコミットを出さないため。
"""
import argparse
import json
import re
from datetime import datetime, timedelta
from pathlib import Path
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

import icalendar
import recurring_ical_events

from feed_guard import check_count, is_https

JST = ZoneInfo("Asia/Tokyo")

# 会場名にこの文字列を含む予定を、その道場の開催とみなす（上から順に判定、どれにも当たらなければ kamiyama）
DOJO_RULES = [
    ("広野", "hirono"),
]
DEFAULT_DOJO = "kamiyama"


def to_jst(value):
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=JST)
        return value.astimezone(JST)
    # 終日予定
    return datetime(value.year, value.month, value.day, tzinfo=JST)


def classify(location):
    for keyword, dojo in DOJO_RULES:
        if keyword in location:
            return dojo
    return DEFAULT_DOJO


def first_url(text):
    # 説明文中の最初の https URL（参加申込フォームなど）。http や javascript: は拾わない
    match = re.search(r"https://[^\s\"<>]+", text)
    return match.group(0) if match and is_https(match.group(0)) else ""


def parse_events(ics_bytes, start, end):
    calendar = icalendar.Calendar.from_ical(ics_bytes)
    events = []
    for ev in recurring_ical_events.of(calendar).between(start, end):
        if str(ev.get("STATUS", "")).upper() == "CANCELLED":
            continue
        dtstart = ev.get("DTSTART").dt
        dtend = ev.get("DTEND").dt if ev.get("DTEND") else dtstart
        location = str(ev.get("LOCATION", "")).strip()
        # "鮎喰川コモン, 日本、〒771-..." → 会場名と住所に分ける
        place, _, address = location.partition(", ")
        events.append({
            "dojo": classify(location),
            "title": str(ev.get("SUMMARY", "")).strip(),
            "start": to_jst(dtstart).isoformat(),
            "end": to_jst(dtend).isoformat(),
            "allDay": not isinstance(dtstart, datetime),
            "place": place,
            "address": address,
            "url": first_url(str(ev.get("DESCRIPTION", ""))),
        })
    events.sort(key=lambda e: e["start"])
    return events


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ics-url", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--days", type=int, default=120, help="何日先までの予定を書き出すか")
    parser.add_argument("--per-dojo", type=int, default=5, help="道場ごとに書き出す件数")
    parser.add_argument("--min-items", type=int, default=1, help="これ未満なら更新しない")
    parser.add_argument("--allow-drop", action="store_true", help="前回からの急減を許可する")
    args = parser.parse_args()

    req = Request(args.ics_url, headers={"User-Agent": "cdkamiyama-events-updater/1.0"})
    with urlopen(req) as resp:
        ics_bytes = resp.read()

    # 今日の0時から数える（当日の回は、終了時刻を過ぎるまでページ側で表示し続ける）
    today = datetime.combine(datetime.now(JST).date(), datetime.min.time(), tzinfo=JST)
    events = parse_events(ics_bytes, today, today + timedelta(days=args.days))

    counts = {}
    limited = []
    for ev in events:
        counts[ev["dojo"]] = counts.get(ev["dojo"], 0) + 1
        if counts[ev["dojo"]] <= args.per_dojo:
            limited.append(ev)

    check_count(len(limited), args.output, "events", args.min_items, args.allow_drop)

    payload = {"source": args.ics_url, "events": limited}

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(limited)} events to {output_path}")


if __name__ == "__main__":
    main()
