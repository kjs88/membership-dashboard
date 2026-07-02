"""
Run Amarans ERP sync repeatedly inside one GitHub Actions job.

GitHub scheduled workflows are not a precise 5-minute timer. This loop keeps a
single job alive for a bounded segment and performs the precise interval inside
the runner after dependencies have already been installed.
"""

import argparse
import os
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone


KST = timezone(timedelta(hours=9))


def now_kst():
    return datetime.now(KST)


def in_active_window(dt, include_weekend=False, elapsed_seconds=0):
    # Weekend 16:00 session intentionally includes the next 00:00 tick.
    if include_weekend and dt.hour == 0 and elapsed_seconds >= 7 * 60 * 60:
        return True
    if dt.weekday() >= 5 and not include_weekend:
        return False
    return 8 <= dt.hour < 24


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--interval-minutes", type=int, required=True)
    parser.add_argument("--duration-minutes", type=int, required=True)
    parser.add_argument("--recent", type=int, default=60)
    parser.add_argument("--include-weekend", action="store_true")
    args = parser.parse_args()

    start = time.monotonic()
    deadline = start + max(1, args.duration_minutes) * 60
    interval = max(1, args.interval_minutes) * 60
    attempt = 0
    success = 0
    failure = 0

    env = os.environ.copy()
    env["AMARANS_IGNORE_AUTO_HOURS"] = "1"
    if args.include_weekend:
        env["AMARANS_IGNORE_AUTO_WEEKEND"] = "1"

    print("=" * 60)
    print("ERP sync loop started")
    print(f"KST start: {now_kst().isoformat(timespec='seconds')}")
    print(f"interval: {args.interval_minutes} min, duration: {args.duration_minutes} min")
    print("=" * 60)

    while True:
        current = now_kst()
        elapsed = time.monotonic() - start
        if elapsed > args.duration_minutes * 60:
            break

        if in_active_window(current, include_weekend=args.include_weekend, elapsed_seconds=elapsed):
            attempt += 1
            print(f"\n[{attempt}] KST {current.isoformat(timespec='seconds')} sync start", flush=True)
            cmd = [
                sys.executable,
                "scripts/amarans_api_v10.py",
                "--auto",
                "--recent",
                str(args.recent),
            ]
            completed = subprocess.run(cmd, env=env)
            if completed.returncode == 0:
                success += 1
                print(f"[{attempt}] sync success", flush=True)
            else:
                failure += 1
                print(f"[{attempt}] sync failed: exit {completed.returncode}", flush=True)
        else:
            print(f"KST {current.isoformat(timespec='seconds')} outside active window, waiting", flush=True)

        remaining = deadline - time.monotonic()
        if remaining <= 0:
            break
        time.sleep(min(interval, remaining))

    print("=" * 60)
    print(f"ERP sync loop finished: attempts={attempt}, success={success}, failure={failure}")
    print(f"KST end: {now_kst().isoformat(timespec='seconds')}")
    print("=" * 60)

    if attempt and success:
        return 0
    if attempt == 0:
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
