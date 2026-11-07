"""取り込み結果の安全確認（update_note_feed_json.py / update_events_json.py 共通）。

異常と判断したらファイルを書き換えずに終了コード 1 で止める。
ワークフローは失敗扱いになりコミットもデプロイも起きないので、サイトには前回の内容が出続ける。
"""
import json
import sys
from pathlib import Path
from urllib.parse import urlparse


def is_https(url):
    try:
        return urlparse(url).scheme == "https"
    except ValueError:
        return False


def previous_count(output_path, key):
    try:
        data = json.loads(Path(output_path).read_text(encoding="utf-8"))
        return len(data.get(key) or [])
    except (OSError, ValueError):
        return None


def check_count(new_count, output_path, key, min_items, allow_drop):
    """件数が min_items 未満、または前回の半分未満に急減していたら止める。"""
    if new_count < min_items:
        sys.exit(f"ERROR: {key} が {new_count} 件しかありません（最低 {min_items} 件）。上流の障害か改ざんの可能性があるため更新を中止します。")

    prev = previous_count(output_path, key)
    if not allow_drop and prev and prev >= 4 and new_count * 2 < prev:
        sys.exit(f"ERROR: {key} が前回 {prev} 件から {new_count} 件に急減しました。意図した変更なら --allow-drop を付けて手動実行してください。")
