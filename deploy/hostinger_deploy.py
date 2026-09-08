#!/usr/bin/env python3
"""
Zero-touch Hostinger deploy for the "Where is Dad?" map.

What it does, start to finish, with nothing to click in hPanel:
  1. finds your active hosting plan (the one that already hosts brandworksmedia.com)
  2. creates the bambamgo.com website on it if it doesn't exist yet, and waits for it
  3. generates the OwnTracks secret token (kept in .hostinger/secret.json, never in git)
  4. zips the site with api/config.php baked in, uploads it, and deploys it
  5. checks the domain's DNS points at the new website and fixes it if not
  6. waits for https://bambamgo.com to answer and prints the OwnTracks URL

Needs only Python 3 (no packages) and a Hostinger API token:
  hPanel -> profile menu (top right) -> Account -> API -> Generate new token

Usage:
  HOSTINGER_API_TOKEN=xxxx python3 deploy/hostinger_deploy.py
  python3 deploy/hostinger_deploy.py --token xxxx
  python3 deploy/hostinger_deploy.py --dry-run        # build the zip, call nothing
Options:
  --domain bambamgo.com     which domain to deploy to
  --order-id 12345          force a specific hosting order
  --redeploy                only rebuild + upload + deploy (skip create/DNS)
"""
import argparse, datetime, json, os, secrets, ssl, sys, time, urllib.error, urllib.parse, urllib.request, zipfile

API = "https://developers.hostinger.com"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATE_DIR = os.path.join(ROOT, ".hostinger")
SECRET_FILE = os.path.join(STATE_DIR, "secret.json")
SITE_FILE = os.path.join(STATE_DIR, "site.json")
SITE_FILES = ["index.html", "manifest.webmanifest", ".htaccess", "assets", "api", "data/.htaccess"]
SKIP_NAMES = {"config.php", ".DS_Store"}

TOKEN = None
def log(msg): print(f"  {msg}", flush=True)
def step(msg): print(f"\n==> {msg}", flush=True)

# ---------------------------------------------------------------- HTTP helpers
def api(method, path, body=None, params=None, timeout=60):
    url = API + path
    if params:
        url += "?" + urllib.parse.urlencode(params, doseq=True)
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": f"Bearer {TOKEN}",
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "where-is-dad-deploy/1.0",
    })
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read()
            return json.loads(raw) if raw.strip() else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors="replace")
        raise RuntimeError(f"{method} {path} -> HTTP {e.code}: {raw[:800]}") from None

def rows(resp):
    """Hostinger lists come back as {"data":[...]} (paginated) or a bare list."""
    if isinstance(resp, dict):
        return resp.get("data", resp.get("items", []))
    return resp or []

def raw_request(method, url, headers, data=None, timeout=300):
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, dict(r.headers), r.read()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read()

# ---------------------------------------------------------------- steps
def load_secret():
    os.makedirs(STATE_DIR, exist_ok=True)
    if os.path.exists(SECRET_FILE):
        return json.load(open(SECRET_FILE))["token"]
    tok = secrets.token_hex(16)
    with open(SECRET_FILE, "w") as f:
        json.dump({"token": tok, "created": datetime.datetime.now().isoformat()}, f, indent=2)
    log(f"generated a new OwnTracks secret -> {os.path.relpath(SECRET_FILE, ROOT)}")
    return tok

def build_archive(domain, secret):
    stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    name = f"{domain.split('.')[0]}_{stamp}.zip"
    path = os.path.join(STATE_DIR, name)
    count = 0
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        for item in SITE_FILES:
            full = os.path.join(ROOT, item)
            if os.path.isdir(full):
                for dp, dns, fns in os.walk(full):
                    for fn in fns:
                        if fn in SKIP_NAMES: continue
                        fp = os.path.join(dp, fn)
                        z.write(fp, os.path.relpath(fp, ROOT)); count += 1
            elif os.path.exists(full):
                z.write(full, item); count += 1
            else:
                log(f"warning: {item} not found, skipping")
        z.writestr("api/config.php", "<?php\nreturn [\n    'token' => '%s',\n];\n" % secret); count += 1
        z.writestr("data/.gitkeep", "")
    log(f"archive {name}: {count} files, {os.path.getsize(path)//1024} KB")
    return path

def find_website(domain):
    for w in rows(api("GET", "/api/hosting/v1/websites", params={"domain": domain, "per_page": 50})):
        if str(w.get("domain", "")).lower() == domain.lower():
            return w
    return None

def pick_order(order_id, anchor_domain="brandworksmedia.com"):
    if order_id:
        return int(order_id)
    # Prefer the plan that already hosts the anchor domain, so both sites share one account.
    anchor = find_website(anchor_domain)
    if anchor and anchor.get("order_id"):
        log(f"using the plan that hosts {anchor_domain} (order {anchor['order_id']}, account {anchor.get('username')})")
        return int(anchor["order_id"])
    orders = rows(api("GET", "/api/hosting/v1/orders", params={"statuses[]": "active", "per_page": 50}))
    if not orders:
        orders = rows(api("GET", "/api/hosting/v1/orders", params={"per_page": 50}))
    log("orders: " + json.dumps(orders)[:600])
    active = [o for o in orders if str(o.get("status", "active")).lower() == "active"]
    if not active:
        raise SystemExit("No active hosting order found on this Hostinger account.")
    log(f"using order {active[0].get('id')}")
    return int(active[0]["id"])

def ensure_website(domain, order_id):
    site = find_website(domain)
    if site:
        log(f"website already exists (account {site.get('username')})")
        return site
    step(f"Creating website {domain} on order {order_id}")
    try:
        v = api("POST", "/api/hosting/v1/domains/verify-ownership", body={"domain": domain})
        log("ownership check: " + json.dumps(v)[:300])
        if isinstance(v, dict) and v.get("is_accessible") is False:
            raise SystemExit(f"Hostinger says {domain} is not accessible to this account: {json.dumps(v)}")
    except RuntimeError as e:
        log(f"ownership check skipped ({e})")
    body = {"domain": domain, "order_id": order_id}
    try:
        api("POST", "/api/hosting/v1/websites", body=body)
    except RuntimeError as e:
        if "datacenter" not in str(e).lower():
            raise
        dcs = rows(api("GET", "/api/hosting/v1/datacenters", params={"order_id": order_id}))
        code = dcs[0].get("code") if dcs and isinstance(dcs[0], dict) else dcs[0]
        log(f"first website on this plan, choosing datacenter {code}")
        api("POST", "/api/hosting/v1/websites", body=dict(body, datacenter_code=code))
    log("creation requested, waiting for it to appear (can take a few minutes)…")
    for i in range(40):
        time.sleep(15)
        site = find_website(domain)
        if site and site.get("username"):
            log(f"website ready: account {site['username']}")
            return site
        log(f"  still creating… ({(i+1)*15}s)")
    raise SystemExit("Website did not appear after 10 minutes. Check hPanel > Websites.")

def upload_and_deploy(domain, username, archive):
    step("Uploading the site")
    creds = api("POST", "/api/hosting/v1/files/upload-urls", body={"username": username, "domain": domain})
    base = creds["url"].rstrip("/")
    fname = os.path.basename(archive)
    hdr = {"X-Auth": creds["auth_key"], "X-Auth-Rest": creds["rest_auth_key"], "Tus-Resumable": "1.0.0"}
    size = os.path.getsize(archive)
    url = f"{base}/{fname}?override=true"
    st, _, body = raw_request("POST", url, dict(hdr, **{"Upload-Length": str(size), "Upload-Offset": "0"}))
    if st not in (200, 201):
        raise SystemExit(f"TUS create failed: HTTP {st} {body[:300]!r}")
    with open(archive, "rb") as f:
        st, h, body = raw_request("PATCH", url, dict(hdr, **{
            "Upload-Offset": "0", "Content-Type": "application/offset+octet-stream", "Content-Length": str(size)}), data=f.read())
    if st not in (200, 204):
        raise SystemExit(f"TUS upload failed: HTTP {st} {body[:300]!r}")
    log(f"uploaded {fname} ({size//1024} KB), server offset {h.get('Upload-Offset') or h.get('upload-offset')}")
    step("Deploying")
    r = api("POST", f"/api/hosting/v1/accounts/{username}/websites/{domain}/deploy", body={"archive_path": fname})
    log("deploy: " + (json.dumps(r)[:300] or "ok"))
    try:
        api("DELETE", f"/api/hosting/v1/accounts/{username}/websites/{domain}/cache/clear")
        log("cache cleared")
    except RuntimeError as e:
        log(f"cache clear skipped ({e})")

def site_ip(site):
    for k, v in (site or {}).items():
        if "ip" in k.lower() and isinstance(v, str) and v.count(".") == 3:
            return v
    return None

def ensure_dns(domain, site):
    step("Checking DNS")
    try:
        zone = api("GET", f"/api/dns/v1/zones/{domain}")
    except RuntimeError as e:
        log(f"could not read the DNS zone ({e}). If the domain is registered elsewhere, point an A record at the hosting IP.")
        return
    recs = rows(zone)
    a_at = [r for r in recs if r.get("type") == "A" and r.get("name") in ("@", domain)]
    current = [x.get("content") for r in a_at for x in r.get("records", [])]
    log(f"current A record(s) for @: {current or 'none'}")
    want = site_ip(site)
    if not want:
        log("hosting API did not report the website IP; leaving DNS as is (Hostinger normally sets it when the domain is in the same account).")
        return
    if want in current:
        log(f"DNS already points at {want}")
        return
    log(f"pointing @ and www at {want}")
    api("PUT", f"/api/dns/v1/zones/{domain}", body={"overwrite": True, "zone": [
        {"name": "@", "type": "A", "ttl": 300, "records": [{"content": want}]},
        {"name": "www", "type": "A", "ttl": 300, "records": [{"content": want}]},
    ]})
    log("DNS updated (propagation can take a few minutes)")

def verify(domain, secret, minutes=8):
    step("Waiting for the site to answer over https (SSL can take a few minutes on a new site)")
    ctx = ssl.create_default_context()
    url = f"https://{domain}/api/admin.php?token={secret}&action=status"
    deadline = time.time() + minutes * 60
    last = ""
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=20, context=ctx) as r:
                body = r.read().decode(errors="replace")
                if '"ok":true' in body.replace(" ", ""):
                    log("LIVE: " + body[:200])
                    return True
                last = f"HTTP {r.status} {body[:120]}"
        except Exception as e:
            last = str(e)[:120]
        log(f"  not yet ({last}) — retrying in 20s")
        time.sleep(20)
    log("Site did not answer in time. It may still be provisioning SSL; try the URL again in a few minutes.")
    return False

def main():
    global TOKEN
    ap = argparse.ArgumentParser()
    ap.add_argument("--domain", default="bambamgo.com")
    ap.add_argument("--token", default=os.environ.get("HOSTINGER_API_TOKEN"))
    ap.add_argument("--order-id", default=None)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--redeploy", action="store_true")
    a = ap.parse_args()
    domain = a.domain.lower().removeprefix("www.")
    secret = load_secret()
    archive = build_archive(domain, secret)
    if a.dry_run:
        with zipfile.ZipFile(archive) as z:
            for n in z.namelist(): log("   " + n)
        print("\nDry run complete. Nothing was sent to Hostinger.")
        return
    if not a.token:
        raise SystemExit("Need a Hostinger API token: set HOSTINGER_API_TOKEN or pass --token.")
    TOKEN = a.token.strip()

    step("Checking the Hostinger account")
    site = find_website(domain)
    if site is None and a.redeploy:
        raise SystemExit(f"{domain} has no website yet; run without --redeploy first.")
    if site is None:
        site = ensure_website(domain, pick_order(a.order_id))
    username = site["username"]
    log(f"site: {json.dumps({k: site.get(k) for k in ('domain','username','order_id','website_type','vhost_type')})}")

    upload_and_deploy(domain, username, archive)
    if not a.redeploy:
        ensure_dns(domain, site)
    with open(SITE_FILE, "w") as f:
        json.dump({"domain": domain, "username": username, "order_id": site.get("order_id"), "type": "static",
                   "deployed": datetime.datetime.now().isoformat()}, f, indent=2)
    live = verify(domain, secret)

    print("\n" + "=" * 64)
    print(f" Map:              https://{domain}/")
    print(f" Demo trip:        https://{domain}/?demo=1")
    print(f" OwnTracks URL:    https://{domain}/api/owntracks.php?token={secret}")
    print(f" Status / reset:   https://{domain}/api/admin.php?token={secret}&action=status")
    print(f" Secret stored in: {os.path.relpath(SECRET_FILE, ROOT)}  (keep it out of git)")
    print("=" * 64)
    if not live:
        sys.exit(2)

if __name__ == "__main__":
    main()
