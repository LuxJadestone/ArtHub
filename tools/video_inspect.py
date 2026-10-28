#!/usr/bin/env python3
"""Prepare time-indexed video evidence for Codex's image-reading tool."""
import argparse
import json
import math
from pathlib import Path
import shutil
import subprocess
import sys
from urllib.parse import urlsplit


def run(args, timeout=120):
    result = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    if result.returncode:
        raise ValueError(f"{args[0]} failed: {result.stderr[-3000:]}")
    return result.stdout


def positive(value):
    number = float(value)
    if not math.isfinite(number) or number <= 0:
        raise argparse.ArgumentTypeError("must be a finite positive number")
    return number


def nonnegative(value):
    number = float(value)
    if not math.isfinite(number) or number < 0:
        raise argparse.ArgumentTypeError("must be a finite nonnegative number")
    return number


def prepare(args):
    for binary in ("ffmpeg", "ffprobe"):
        if not shutil.which(binary):
            raise ValueError(f"Missing {binary}; install FFmpeg first")
    if not 1 <= args.max_frames <= 120:
        raise ValueError("--max-frames must be between 1 and 120")
    if not 128 <= args.width <= 1920:
        raise ValueError("--width must be between 128 and 1920")
    is_url = urlsplit(args.source).scheme in ("http", "https")
    source = None if is_url else Path(args.source).expanduser().resolve()
    if not is_url and not source.is_file():
        raise ValueError("Local video does not exist")
    out = Path(args.output).expanduser().resolve()
    # Never mix stale evidence with a new run or overwrite user files.
    if out.exists() and any(out.iterdir()):
        raise ValueError("Output directory must be new or empty; choose another --output")
    out.mkdir(parents=True, exist_ok=True)
    subtitle_paths = []
    if is_url:
        if not shutil.which("yt-dlp"):
            raise ValueError("URL input needs yt-dlp; activate .venv and install requirements-video.txt")
        download = out / "download"
        download.mkdir()
        run([
            "yt-dlp", "--ignore-config", "--no-playlist", "--socket-timeout", "20",
            "--retries", "2", "--max-filesize", "500M",
            "-f", "b[height<=720]/bv[height<=720]+ba/b",
            "--write-subs", "--write-auto-subs", "--sub-langs", "zh.*,en.*",
            "--sub-format", "vtt", "--merge-output-format", "mkv",
            "--print", "after_move:filepath", "-o", str(download / "source.%(ext)s"),
            "--", args.source,
        ], timeout=600)
        videos = [p for p in download.glob("source.*")
                  if p.suffix.lower() in (".mp4", ".mkv", ".webm", ".flv", ".mov", ".avi")]
        if len(videos) != 1:
            raise ValueError("Download did not produce exactly one supported video")
        source = videos[0]
        subtitle_paths = sorted(download.glob("*.vtt"))
    if args.subtitles:
        subtitle = Path(args.subtitles).expanduser().resolve()
        if not subtitle.is_file():
            raise ValueError("Subtitle file does not exist")
        subtitle_paths.append(subtitle)
    info = json.loads(run(["ffprobe", "-v", "error", "-show_format", "-show_streams",
                           "-of", "json", str(source)]))
    videos = [s for s in info["streams"] if s["codec_type"] == "video"
              and not s.get("disposition", {}).get("attached_pic")]
    if not videos:
        raise ValueError("No video stream found")
    duration = float(info["format"].get("duration") or videos[0].get("duration") or 0)
    if not math.isfinite(duration) or duration <= 0:
        raise ValueError("Video must have a known, positive duration")
    end = min(args.end if args.end is not None else duration, duration)
    if end <= args.start:
        raise ValueError("Selected range must be nonempty and within video duration")
    count = min(args.max_frames, max(1, math.ceil((end - args.start) / args.interval)))
    # Midpoint sampling avoids EOF seeks and clearly defines uncovered gaps.
    step = (end - args.start) / count
    frames = []
    for i in range(count):
        requested = args.start + (i + 0.5) * step
        frame = out / f"frame-{i:03d}.jpg"
        # Input seeking remains accurate with transcoding; times are approximate.
        log = subprocess.run([
            "ffmpeg", "-hide_banner", "-loglevel", "info", "-nostdin", "-n",
            "-ss", f"{requested:.6f}", "-i", str(source), "-map", f"0:{videos[0]['index']}",
            "-frames:v", "1", "-vf",
            f"scale=w='min({args.width},iw)':h=-2,showinfo",
            "-q:v", "2", str(frame),
        ], capture_output=True, text=True, timeout=120)
        if log.returncode or not frame.is_file() or not frame.stat().st_size:
            raise ValueError(f"Frame extraction failed at {requested:.3f}s: {log.stderr[-1500:]}")
        frames.append({"requested_time_seconds": round(requested, 6), "path": str(frame)})
    audio_path = None
    if args.audio and any(s["codec_type"] == "audio" for s in info["streams"]):
        audio_path = out / "audio.wav"
        run(["ffmpeg", "-v", "error", "-nostdin", "-n", "-ss", str(args.start),
             "-i", str(source), "-t", str(end - args.start), "-vn", "-ac", "1",
             "-ar", "16000", str(audio_path)])
    manifest = {
        "schema_version": 1, "source_file": str(source),
        "duration_seconds": duration, "range_seconds": [args.start, end],
        "sampling": "Uniform midpoint samples; requested seek times, not exact decoded PTS. Brief events may be missed.",
        "sample_spacing_seconds": step, "frames": frames,
        "subtitles": [str(p) for p in subtitle_paths],
        "audio": str(audio_path) if audio_path else None,
        "audio_offset_seconds": args.start if audio_path else None,
        "analysis_status": "Prepared only. Codex must open frames before making visual claims. Audio is not transcribed.",
    }
    target = out / "manifest.json"
    target.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(target)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", help="Local video path or public HTTP(S) video page")
    parser.add_argument("--output", required=True, help="New or empty evidence directory")
    parser.add_argument("--start", type=nonnegative, default=0)
    parser.add_argument("--end", type=positive)
    parser.add_argument("--interval", type=positive, default=5, help="Desired spacing in seconds; capped by --max-frames")
    parser.add_argument("--max-frames", type=int, default=24)
    parser.add_argument("--width", type=int, default=960)
    parser.add_argument("--subtitles", help="Optional local subtitle file")
    parser.add_argument("--audio", action="store_true", help="Export mono audio; does not transcribe or listen")
    try:
        prepare(parser.parse_args())
    except (ValueError, OSError, subprocess.TimeoutExpired) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
