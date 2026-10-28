"""Integration checks using real FFmpeg-generated video, without network access."""
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "tools" / "video_inspect.py"


@unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "FFmpeg required")
class VideoInspectionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.root = Path(cls.temp.name)
        cls.video = cls.root / "fixture.mp4"
        subprocess.run([
            "ffmpeg", "-v", "error", "-f", "lavfi", "-i",
            "testsrc2=size=320x240:rate=10:duration=4", "-f", "lavfi", "-i",
            "sine=frequency=440:duration=4", "-c:v", "mpeg4", "-c:a", "aac",
            "-shortest", str(cls.video),
        ], check=True)

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def invoke(self, *options):
        return subprocess.run([sys.executable, str(SCRIPT), str(self.video), *options],
                              capture_output=True, text=True)

    def test_selected_range_audio_and_frame_cap(self):
        out = self.root / "selected"
        result = self.invoke("--start", "1", "--end", "3", "--interval", "0.1",
                             "--max-frames", "4", "--audio", "--output", str(out))
        self.assertEqual(result.returncode, 0, result.stderr)
        data = json.loads((out / "manifest.json").read_text())
        self.assertEqual([f["requested_time_seconds"] for f in data["frames"]],
                         [1.25, 1.75, 2.25, 2.75])
        for frame in data["frames"]:
            info = json.loads(subprocess.check_output([
                "ffprobe", "-v", "error", "-show_streams", "-of", "json", frame["path"]]))
            self.assertEqual(info["streams"][0]["width"], 320)
        audio = json.loads(subprocess.check_output([
            "ffprobe", "-v", "error", "-show_format", "-of", "json", data["audio"]]))
        self.assertAlmostEqual(float(audio["format"]["duration"]), 2, places=2)
        self.assertEqual(data["audio_offset_seconds"], 1)

    def test_existing_output_is_preserved(self):
        out = self.root / "existing"
        out.mkdir()
        sentinel = out / "keep.txt"
        sentinel.write_text("user file")
        result = self.invoke("--output", str(out))
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(sentinel.read_text(), "user file")
        self.assertEqual(list(out.iterdir()), [sentinel])

    def test_out_of_range_cannot_succeed(self):
        out = self.root / "bad-range"
        result = self.invoke("--start", "10", "--output", str(out))
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse((out / "manifest.json").exists())

    def test_invalid_interval_cannot_succeed(self):
        for interval in ("0", "-1", "nan", "inf"):
            with self.subTest(interval=interval):
                result = self.invoke("--interval", interval, "--output", str(self.root / "bad"))
                self.assertNotEqual(result.returncode, 0)


if __name__ == "__main__":
    unittest.main()
