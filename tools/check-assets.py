import re, sys, urllib.request, urllib.error, os

ROOT = '/home/oem/Documents/Bike Rider/BIKE RIDER'
BASE = 'http://127.0.0.1:45667/'
SKIP_PREFIX = ('http', 'data:', '#', '//')

refs = set()

html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
head = html[:html.index('</head>')]
for m in re.finditer(r'(?:href|src)="([^"]+)"', head):
    v = m.group(1)
    if v.startswith(SKIP_PREFIX) or 'javascript' in v:
        continue
    refs.add(v.split('?')[0].split('#')[0])

man = open(os.path.join(ROOT, 'manifest.webmanifest'), encoding='utf-8').read()
for m in re.finditer(r'"src":\s*"([^"]+)"', man):
    refs.add(m.group(1).lstrip('/'))

sw = open(os.path.join(ROOT, 'sw.js'), encoding='utf-8').read()
core = re.search(r'const CORE = \[(.*?)\];', sw, re.S)
if core:
    for m in re.finditer(r"'([^']+)'", core.group(1)):
        refs.add(m.group(1).lstrip('./') if m.group(1) != './' else 'index.html')

bcfg = os.path.join(ROOT, 'browserconfig.xml')
if os.path.exists(bcfg):
    for m in re.finditer(r'src="([^"]+)"', open(bcfg, encoding='utf-8').read()):
        refs.add(m.group(1).lstrip('/'))

bad = []
for r in sorted(refs):
    url = BASE + r.lstrip('./') if not r.startswith('./') else BASE + r[2:]
    try:
        with urllib.request.urlopen(url, timeout=8) as resp:
            code, n = resp.status, len(resp.read())
        flag = 'OK ' if code == 200 else 'HTTP%d' % code
        if code != 200:
            bad.append((r, flag))
    except urllib.error.HTTPError as e:
        flag = 'HTTP%d' % e.code
        bad.append((r, flag))
    except Exception as e:
        flag = type(e).__name__
        bad.append((r, flag))
    print(f'  {flag:<10} {r}')

print('---')
print(f'{len(refs) - len(bad)}/{len(refs)} references OK')
if bad:
    print('FAIL:')
    for r, f in bad:
        print(f'  {f} {r}')
    sys.exit(1)
print('all icon/asset references resolve')
