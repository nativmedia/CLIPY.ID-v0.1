import unittest
from app.pipeline.downloader import import_session,disconnect_chrome,session_status
class SessionTests(unittest.TestCase):
 def tearDown(self):disconnect_chrome()
 def test_valid_session_and_disconnect(self):
  result=import_session('# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t2147483647\tSID\ttest-only\n.example.com\tTRUE\t/\tFALSE\t2147483647\tOTHER\texcluded\n')
  self.assertTrue(result['connected'])
  from app.pipeline import downloader
  self.assertEqual(len(downloader._SESSION_JAR),1)
  disconnect_chrome();self.assertFalse(session_status()['connected'])
 def test_invalid_or_unrelated_rejected(self):
  for text in ['invalid','# Netscape HTTP Cookie File\n.example.com\tTRUE\t/\tFALSE\t2147483647\tSID\ttest\n','x'*262145]:
   with self.assertRaises(RuntimeError):import_session(text)
if __name__=='__main__':unittest.main()
