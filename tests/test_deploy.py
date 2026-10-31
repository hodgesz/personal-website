"""Exercise deploy.sh on synthetic committed data; npx never contacts a service."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'deploy.sh'

class DeploymentBoundary(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='website-deploy-test-')
        self.root = Path(self.tmp.name)
        self.repo = self.root / 'repo'
        self.repo.mkdir()
        self.bin = self.root / 'bin'
        self.bin.mkdir()
        self.manifest = self.root / 'upload.txt'
        (self.bin / 'npx').write_text('#!/bin/sh\nfind . -type f | sort > "$TEST_UPLOAD_MANIFEST"\nexit "${TEST_NPX_EXIT:-0}"\n')
        (self.bin / 'npx').chmod(0o755)
        self.env = {**os.environ, 'PATH': str(self.bin) + os.pathsep + os.environ['PATH'], 'TEST_UPLOAD_MANIFEST': str(self.manifest)}
        self.git('init', '-q')
        self.git('config', 'user.name', 'Synthetic Test')
        self.git('config', 'user.email', 'test@example.com')
        shutil.copyfile(SCRIPT, self.repo / 'deploy.sh')
        for name, text in {'index.html':'<h1>Synthetic</h1>', 'styles.css':'body{}', 'assets/public.txt':'public fixture', 'family-planner/index.html':'public app info', 'family-planner/privacy.html':'public privacy', 'family-planner/info.css':'public style', 'HANDOFF.md':'not for upload', '.github/workflows/ci.yml':'private deployment boundary fixture', 'content/claim-matrix.md':'do not upload'}.items():
            p = self.repo / name
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(text)
        self.git('add', '.')
        self.git('commit', '-qm', 'Synthetic fixture')

    def tearDown(self):
        self.tmp.cleanup()

    def git(self, *args):
        return subprocess.run(['git', *args], cwd=self.repo, check=True, capture_output=True, text=True)

    def deploy(self, *args):
        return subprocess.run(['bash', 'deploy.sh', 'HEAD', *args], cwd=self.repo, env=self.env, capture_output=True, text=True)

    def test_only_committed_allowlist_reaches_upload(self):
        (self.repo / 'index.html').write_text('UNCOMMITTED DRAFT')
        (self.repo / 'assets/untracked.txt').write_text('UNTRACKED')
        result = self.deploy()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.manifest.read_text().splitlines(), ['./assets/public.txt', './family-planner/index.html', './family-planner/info.css', './family-planner/privacy.html', './index.html', './styles.css'])

    def test_missing_linked_resume_is_refused(self):
        (self.repo / 'index.html').write_text('assets/Jonathan_Hodges_VP_Data_AI_Resume_3Page.pdf')
        self.git('add', 'index.html')
        self.git('commit', '-qm', 'Synthetic missing link')
        result = self.deploy()
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(self.manifest.exists())

    def test_failed_upload_propagates(self):
        self.env['TEST_NPX_EXIT'] = '23'
        self.assertEqual(self.deploy().returncode, 23)

    def test_bad_mode_is_refused_before_upload(self):
        self.assertEqual(self.deploy('--invalid').returncode, 2)
        self.assertFalse(self.manifest.exists())

if __name__ == '__main__':
    unittest.main()
