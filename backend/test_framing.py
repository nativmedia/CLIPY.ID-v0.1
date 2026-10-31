"""Regression checks for shot-locked framing and real FFmpeg output."""
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch

import numpy as np
from app.models import Clip, JobOptions
from app.store import STORE
from app.pipeline.framing import build_stable_track, detect_shot_cuts
from app.pipeline.media import ffmpeg, probe_media
from app.pipeline.render import OUTPUT_SIZES, render_clip
from app.pipeline.subtitles import build_ass


class StableFramingTests(unittest.TestCase):
    def test_default_is_stable_without_zoom(self):
        options = JobOptions()
        self.assertEqual(options.framing_mode, 'stable')
        self.assertFalse(options.enable_zoom)

    def test_face_jitter_and_missing_samples_cannot_move_crop(self):
        points = [(0, .29, .5), (1, .31, .5), (2, .30, .5), (9, .32, .5)]
        track = build_stable_track(points, start=0, end=10)
        self.assertEqual(len(track), 1)
        self.assertAlmostEqual(track[0][1], .305)

    def test_separate_people_are_not_averaged_into_empty_center(self):
        points = [(i, .25 if i < 6 else .8, .5) for i in range(10)]
        self.assertEqual(build_stable_track(points, start=0, end=10), [(0, .25)])

    def test_camera_cut_changes_immediately_with_clip_relative_time(self):
        points = [(0, .2, .5), (4, .2, .5), (5, .8, .5), (9, .8, .5)]
        self.assertEqual(build_stable_track(points, start=2, end=9, shot_cuts=[5]), [(0, .2), (3, .8)])

    def test_partial_clips_share_the_same_shot_geometry(self):
        points = [(0, .2, .5), (3, .22, .5), (5, .21, .5), (8, .8, .5)]
        a = build_stable_track(points, start=0, end=4, shot_cuts=[7])
        b = build_stable_track(points, start=4, end=6, shot_cuts=[7])
        self.assertEqual(a, b)

    def test_new_shot_without_face_is_centered(self):
        self.assertEqual(build_stable_track([(1, .2, .5)], start=0, end=10, shot_cuts=[5]), [(0, .2), (5, .5)])

    def test_same_crop_is_merged_and_outside_cut_ignored(self):
        points = [(1, .25, .5), (7, .25, .5)]
        self.assertEqual(build_stable_track(points, start=0, end=10, shot_cuts=[5, 20]), [(0, .25)])

    def test_no_faces_is_one_centered_crop(self):
        self.assertEqual(build_stable_track([], start=4, end=8), [(0, .5)])

    def test_invalid_duration_is_rejected(self):
        with self.assertRaises(ValueError):
            build_stable_track([], start=4, end=4)


@unittest.skipUnless(shutil.which('ffmpeg') and shutil.which('ffprobe'), 'FFmpeg is not installed')
class FramingRenderTests(unittest.TestCase):
    def test_portrait_source_pads_to_landscape_with_follow_zoom(self):
        with tempfile.TemporaryDirectory() as directory:
            work = Path(directory)
            source = work / 'portrait.mp4'
            ffmpeg(['-f', 'lavfi', '-i', 'testsrc2=s=180x320:r=24:d=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', str(source)])
            out = render_clip(source, work / 'landscape.mp4', start=0, end=1, ass_path=None, keyframes=[], peak_time_rel=.5, aspect_ratio='16:9', framing_mode='follow', enable_zoom=True)
            meta = probe_media(out)
            self.assertEqual((meta['width'], meta['height']), (1280, 720))

    def test_every_ratio_renders_with_matching_subtitles_and_thumbnail(self):
        from app.pipeline.assets import render_thumbnail
        import cv2
        with tempfile.TemporaryDirectory() as directory:
            work = Path(directory)
            source = work / 'source.mp4'
            ffmpeg(['-f', 'lavfi', '-i', 'testsrc2=s=320x180:r=24:d=1', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', str(source)])
            for index, (ratio, (width, height)) in enumerate(OUTPUT_SIZES.items()):
                with self.subTest(ratio=ratio):
                    ass = build_ass([], clip_start=0, clip_end=1, out_path=work / f'{index}.ass', width=width, height=height)
                    self.assertIn(f'PlayResX: {width}\nPlayResY: {height}', ass.read_text(encoding='utf-8'))
                    out = render_clip(source, work / f'{index}.mp4', start=0, end=1, ass_path=ass, keyframes=[], peak_time_rel=.5, aspect_ratio=ratio)
                    meta = probe_media(out)
                    self.assertEqual((meta['width'], meta['height']), (width, height))
                    self.assertTrue(meta['has_audio'])
                    thumb = cv2.imread(str(render_thumbnail(out, work / f'{index}.jpg', timestamp=.2)))
                    self.assertAlmostEqual(thumb.shape[1] / thumb.shape[0], width / height, delta=.01)

    def test_locked_frames_do_not_drift_or_zoom_but_cut_changes_position(self):
        import cv2
        with tempfile.TemporaryDirectory() as directory:
            work = Path(directory)
            source = work / 'source.mp4'
            # A stationary horizontal gradient makes even small crop shifts visible.
            ffmpeg(['-f', 'lavfi', '-i', "nullsrc=s=1280x720:r=24,geq=r='255*X/W':g=80:b='255*(1-X/W)'",
                    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000', '-t', '3',
                    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', str(source)])
            out = render_clip(source, work / 'stable.mp4', start=0, end=3, ass_path=None,
                              keyframes=[(0, .25), (1.5, .75)], peak_time_rel=.75,
                              framing_mode='stable', enable_zoom=True)
            meta = probe_media(out)
            self.assertEqual((meta['width'], meta['height']), (720, 1280))
            self.assertTrue(meta['has_audio'])
            self.assertAlmostEqual(meta['duration'], 3, delta=.12)
            cap = cv2.VideoCapture(str(out))
            frames = []
            for t in (.25, 1, 2):
                cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
                ok, image = cap.read()
                self.assertTrue(ok)
                frames.append(image.astype(float))
            cap.release()
            self.assertLess(float(np.mean(np.abs(frames[0] - frames[1]))), 2)
            self.assertGreater(float(np.mean(np.abs(frames[0] - frames[2]))), 15)

            from app.pipeline.assets import render_thumbnail
            thumb = render_thumbnail(out, work / 'thumb.jpg', timestamp=.25)
            thumbnail = cv2.imread(str(thumb))
            self.assertEqual(thumbnail.shape[:2], (1280, 720))
            self.assertLess(float(np.mean(np.abs(thumbnail.astype(float) - frames[0]))), 8)

            # Following mode is still usable and keeps its interpolated motion.
            following = render_clip(source, work / 'follow.mp4', start=0, end=3, ass_path=None,
                                    keyframes=[(0, .25), (2, .75)], peak_time_rel=1,
                                    framing_mode='follow', enable_zoom=False)
            self.assertEqual(probe_media(following)['width'], 720)

    def test_scene_detector_finds_a_hard_cut(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'cuts.mp4'
            ffmpeg(['-f', 'lavfi', '-i', 'color=black:s=320x180:r=24:d=1',
                    '-f', 'lavfi', '-i', 'color=white:s=320x180:r=24:d=1',
                    '-filter_complex', '[0:v][1:v]concat=n=2:v=1:a=0[v]', '-map', '[v]',
                    '-c:v', 'libx264', str(source)])
            cuts = detect_shot_cuts(source)
            self.assertTrue(any(abs(t - 1) < .1 for t in cuts), cuts)


class ThumbnailTests(unittest.TestCase):
    def test_assets_use_rendered_clip_without_retained_source(self):
        from app.pipeline.orchestrator import generate_assets_for
        with tempfile.TemporaryDirectory() as directory:
            work = Path(directory)
            (work / 'clips').mkdir()
            rendered = work / 'clips/clip01.mp4'
            rendered.touch()
            job = STORE.create('https://youtu.be/dQw4w9WgXcQ', JobOptions(keep_source=False))
            job.clips = [Clip(id='clip01', index=0, start=30, end=50, duration=20, score=70,
                              transcript='Ini adalah contoh cerita untuk klip yang sudah selesai.')]
            try:
                with patch('app.pipeline.orchestrator.job_dir', return_value=work), \
                     patch('app.pipeline.assets.render_thumbnail') as thumbnail:
                    clips = generate_assets_for(job.id, ['clip01'])
                    self.assertEqual(thumbnail.call_args.args[0], rendered)
                    self.assertEqual(thumbnail.call_args.kwargs['timestamp'], 7)
                    self.assertIsNotNone(clips[0].assets.thumbnail_url)
            finally:
                STORE.delete(job.id)


if __name__ == '__main__':
    unittest.main()
