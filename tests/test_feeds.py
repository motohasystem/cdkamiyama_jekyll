"""上流（note RSS / Google カレンダー）に不正なデータが入ったときの取り込み側の挙動を確認する。

実行: python -m unittest discover -s tests   （icalendar / recurring-ical-events が必要）
"""
import json
import sys
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import update_events_json  # noqa: E402
import update_note_feed_json  # noqa: E402
from feed_guard import check_count  # noqa: E402

JST = ZoneInfo("Asia/Tokyo")

RSS = b"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
  <item>
    <title>&lt;script&gt;alert(1)&lt;/script&gt;</title>
    <link>https://note.com/x/n/ok</link>
    <media:thumbnail>http://evil.example/a.png</media:thumbnail>
  </item>
  <item>
    <title>javascript link</title>
    <link>javascript:alert(1)</link>
  </item>
  <item>
    <title>data link</title>
    <link>data:text/html,&lt;script&gt;alert(1)&lt;/script&gt;</link>
  </item>
</channel>
</rss>"""

ICS = """BEGIN:VCALENDAR
VERSION:2.0
PRODID:test
BEGIN:VEVENT
UID:a@test
DTSTART;TZID=Asia/Tokyo:20990101T100000
DTEND;TZID=Asia/Tokyo:20990101T120000
SUMMARY:<img src=x onerror=alert(1)>
LOCATION:神山町立広野小学校\\, 住所
DESCRIPTION:申込 javascript:alert(1) http://insecure.example/form
END:VEVENT
BEGIN:VEVENT
UID:b@test
DTSTART;TZID=Asia/Tokyo:20990102T100000
DTEND;TZID=Asia/Tokyo:20990102T120000
SUMMARY:開催日
LOCATION:鮎喰川コモン\\, 住所
DESCRIPTION:<a href="https://docs.google.com/forms/x">申込</a>
END:VEVENT
END:VCALENDAR
"""


class NoteFeedTest(unittest.TestCase):
    def test_drops_non_https_links_and_thumbnails(self):
        items = update_note_feed_json.parse_items(RSS)
        self.assertEqual([i["link"] for i in items], ["https://note.com/x/n/ok"])
        self.assertEqual(items[0]["thumbnail"], "")

    def test_keeps_html_in_title_as_plain_text(self):
        # タイトルは文字列のまま保持し、エスケープや実行は描画側（textContent）に任せる
        items = update_note_feed_json.parse_items(RSS)
        self.assertEqual(items[0]["title"], "<script>alert(1)</script>")


class EventsTest(unittest.TestCase):
    def parse(self):
        start = datetime(2098, 12, 31, tzinfo=JST)
        end = datetime(2099, 2, 1, tzinfo=JST)
        return update_events_json.parse_events(ICS.encode(), start, end)

    def test_only_https_url_is_extracted(self):
        events = self.parse()
        self.assertEqual(events[0]["url"], "")
        self.assertEqual(events[1]["url"], "https://docs.google.com/forms/x")

    def test_classifies_dojo_by_location(self):
        self.assertEqual([e["dojo"] for e in self.parse()], ["hirono", "kamiyama"])


class GuardTest(unittest.TestCase):
    def test_stops_when_empty(self):
        with self.assertRaises(SystemExit):
            check_count(0, "/nonexistent.json", "items", 1, False)

    def test_stops_on_sharp_drop(self):
        with tempfile.TemporaryDirectory() as d:
            out = Path(d) / "feed.json"
            out.write_text(json.dumps({"items": [{}] * 10}), encoding="utf-8")
            with self.assertRaises(SystemExit):
                check_count(3, out, "items", 1, False)
            check_count(3, out, "items", 1, True)  # --allow-drop なら通る
            check_count(8, out, "items", 1, False)  # 小さな減少は通る


if __name__ == "__main__":
    unittest.main()
