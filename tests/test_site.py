import importlib.util
from pathlib import Path
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/check-site.py'
spec = importlib.util.spec_from_file_location('site_check', SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class PublicLinks(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='public-site-links-')
        self.root = Path(self.tmp.name)
        self.template = '<html lang="en"><head><title>Fixture</title><meta name="viewport" content="width=device-width"></head><body><h1>Fixture</h1>{}</body></html>'

    def tearDown(self):
        self.tmp.cleanup()

    def write_home(self, links):
        (self.root / 'index.html').write_text(self.template.format(links))

    def test_existing_but_unshipped_document_is_refused(self):
        self.write_home('<a href="/README.md">Not public</a>')
        (self.root / 'README.md').write_text('not in upload')
        with self.assertRaisesRegex(AssertionError, 'outside the public upload set'):
            module.check(self.root)

    def test_missing_privacy_link_is_refused(self):
        self.write_home('<a href="/family-planner/privacy.html">Privacy</a>')
        with self.assertRaisesRegex(AssertionError, 'Missing local link'):
            module.check(self.root)

    def test_page_directory_and_anchor_resolve(self):
        self.write_home('<a href="/family-planner/#privacy">App information</a>')
        (self.root / 'family-planner').mkdir()
        (self.root / 'family-planner/index.html').write_text(self.template.format('<p id="privacy">Private fixture</p>'))
        module.check(self.root)
