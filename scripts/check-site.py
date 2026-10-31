#!/usr/bin/env python3
"""Check committed static-page structure and local link targets without a network."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]

class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids, self.links, self.h1 = set(), [], 0
        self.lang = self.viewport = self.title = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get('id'):
            self.ids.add(a['id'])
        self.h1 += tag == 'h1'
        self.lang |= tag == 'html' and bool(a.get('lang'))
        self.viewport |= tag == 'meta' and a.get('name') == 'viewport'
        self.title |= tag == 'title'
        for key in ('href', 'src'):
            if a.get(key):
                self.links.append(a[key])

def check(root=ROOT):
    pages = {}
    for p in [root / 'index.html', *sorted((root / 'family-planner').rglob('*.html'))]:
        page = Page()
        page.feed(p.read_text())
        assert page.lang and page.viewport and page.title and page.h1 == 1, f'Page structure: {p.relative_to(root)}'
        pages[p.resolve()] = page
    for p, page in pages.items():
        for href in page.links:
            url = urlsplit(href)
            if url.scheme or url.netloc:
                continue
            target = ((root / unquote(url.path).lstrip('/')) if url.path.startswith('/') else p.parent / unquote(url.path)).resolve() if url.path else p
            assert target.is_relative_to(root.resolve()), f'Link leaves site: {href}'
            if target.is_dir():
                target = target / 'index.html'
            assert target.is_file(), f'Missing local link: {p.name}: {href}'
            if url.fragment and target in pages:
                assert unquote(url.fragment) in pages[target].ids, f'Missing anchor: {href}'
    print(f'Checked {len(pages)} public HTML page(s) and local links.')

if __name__ == '__main__':
    check()
