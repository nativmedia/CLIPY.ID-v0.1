"""API contract checks without downloading videos or models."""
import unittest
from unittest.mock import patch
from types import SimpleNamespace
from fastapi.testclient import TestClient
from app.main import app


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_version_and_tooling_contract(self):
        response = self.client.get('/api/health')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['version'], '0.2.0')
        self.assertIsInstance(response.json()['ffmpeg'], bool)

    def test_invalid_source_and_duration_do_not_start_jobs(self):
        response = self.client.post('/api/jobs', json={'url': 'https://example.com/video'})
        self.assertEqual(response.status_code, 400)
        with patch('app.main.TOOLING', SimpleNamespace(ok=True)):
            response = self.client.post('/api/jobs', json={'url': 'https://youtu.be/dQw4w9WgXcQ', 'options': {'min_clip_seconds': 40, 'max_clip_seconds': 20}})
        self.assertEqual(response.status_code, 400)

    def test_missing_job_is_not_found(self):
        self.assertEqual(self.client.get('/api/jobs/nonexistent').status_code, 404)

    def test_session_mutation_rejects_external_origin(self):
        response = self.client.delete('/api/youtube-session', headers={'origin': 'https://example.com'})
        self.assertEqual(response.status_code, 403)

    def test_session_disconnect_works_with_current_server_origin(self):
        response = self.client.delete('/api/youtube-session', headers={'origin': 'http://testserver'})
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()['connected'])


if __name__ == '__main__':
    unittest.main()
