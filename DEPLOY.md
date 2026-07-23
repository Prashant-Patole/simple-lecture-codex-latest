# Production Deployment Guide

This document is for whoever administers `server1.simplelecture.com` (the Apache
host serving `simplelecture.com`).

## ⚠️ Current state vs. desired state

Right now the server is responding with **Vite dev-mode HTML** — every visitor
downloads un-bundled, un-minified TypeScript source plus an HMR WebSocket
client. Confirm with:

```bash
curl -s https://simplelecture.com/ | head -10
```

You'll see `/@react-refresh`, `/@vite/client`, and `/src/main.tsx`. That's
the development server. It must be replaced with a production build before
any SEO work matters.

The desired state is: Apache serves the contents of `dist/` (output of
`npm run build:seo`) as static files. No Node process needs to run at
request time.

---

## One-time setup

```bash
# As the deploy user, in the repo:
cd /path/to/simplelecturelatest

# Stop whatever's serving dev mode (replace with your actual setup):
pm2 stop simplelecture     # if PM2
# OR
systemctl stop simplelecture-vite     # if systemd
# OR
kill <PID-of-npm-run-dev>

# Install deps (CI mode — uses package-lock.json exactly)
npm ci

# Run the SEO build: vite build + prerender static routes
npm run build:seo
```

The build writes everything into `./dist/`. Inside `dist/` you'll find:

- `index.html` — the SPA shell (homepage, with proper meta + JSON-LD baked in)
- `programs/index.html`, `blog/index.html`, `about/index.html`, etc. —
  prerendered static route HTML (each with route-specific meta + JSON-LD)
- `assets/` — hashed JS / CSS / image bundles
- `.htaccess` — Apache config (SPA fallback, caching, security headers)
- `robots.txt`, `og-default.png`, `favicon.png`, etc. — verbatim copies of
  `public/`

---

## Apache configuration

Point your virtual host's `DocumentRoot` at `dist/` and ensure
`AllowOverride All` so the `.htaccess` is honoured.

### Minimal vhost example

```apache
<VirtualHost *:443>
  ServerName simplelecture.com
  ServerAlias www.simplelecture.com

  DocumentRoot /var/www/simplelecture/dist
  <Directory /var/www/simplelecture/dist>
    Options -Indexes +FollowSymLinks
    AllowOverride All
    Require all granted
  </Directory>

  ErrorLog ${APACHE_LOG_DIR}/simplelecture-error.log
  CustomLog ${APACHE_LOG_DIR}/simplelecture-access.log combined

  # SSL config — adjust paths to your certs
  SSLEngine on
  SSLCertificateFile /etc/letsencrypt/live/simplelecture.com/fullchain.pem
  SSLCertificateKeyFile /etc/letsencrypt/live/simplelecture.com/privkey.pem
</VirtualHost>
```

### Required Apache modules

```bash
a2enmod rewrite headers deflate mime ssl
systemctl reload apache2
```

If any of these are missing the `.htaccess` rules will be no-ops and the SPA
fallback won't work.

---

## Verifying it worked

After deploying, run these checks from any machine:

```bash
# 1. Confirm dev-mode artefacts are gone.
curl -s https://simplelecture.com/ | grep -E "@vite|@react-refresh|src/main"
# Expected: no output. If you still see these strings, dev mode is still running.

# 2. Confirm prerendered static routes have route-specific meta.
curl -s https://simplelecture.com/programs | grep -i "<title>"
# Expected: <title>All Programs | SimpleLecture</title>

curl -s https://simplelecture.com/blog | grep -i "<title>"
# Expected: <title>Blog – Educational Insights & Study Tips | SimpleLecture</title>

curl -s https://simplelecture.com/about | grep -i "og:title"
# Expected: <meta property="og:title" content="About Us | SimpleLecture" />

# 3. Confirm SPA fallback for unknown / dynamic paths.
curl -s https://simplelecture.com/this-does-not-exist | grep -i "<title>"
# Expected: the homepage title — meaning Apache served /index.html.

# 4. Confirm long cache on hashed assets.
curl -sI https://simplelecture.com/assets/index-XXXXX.js | grep -i cache-control
# Expected: Cache-Control: public, max-age=31536000, immutable

# 5. Confirm no-cache on HTML.
curl -sI https://simplelecture.com/ | grep -i cache-control
# Expected: Cache-Control: no-cache, must-revalidate, max-age=0
```

---

## Ongoing deploys

Every time you ship new code:

```bash
cd /path/to/simplelecturelatest
git pull
npm ci
npm run build:seo
# Apache picks up the new dist/ immediately — no service restart needed.
```

You can also wrap this in a `deploy.sh` if you want a one-liner. **Do not**
run `npm run dev` — it's only for local development.

---

## Adding new static routes to prerender

If you add a new public page like `/pricing`:

1. Open `scripts/prerender-static.mjs`.
2. Add an entry to the `ROUTES` array with `path`, `title`, `description`,
   `h1`, `lead`, optional `keywords` and `jsonLd`.
3. Commit, push, redeploy — `dist/pricing/index.html` will be generated.

For dynamic routes (`/course/:slug`, `/blog/:slug`, etc.) no action is needed
— they rely on Googlebot's / Bingbot's JS execution and are already
indexable thanks to the per-page `<SEOHead>` component.

---

## Rolling back

The previous deploy is whatever was in `dist/` before `npm run build:seo`
overwrote it. If you keep `dist-backup/` between deploys, swap them:

```bash
mv dist dist-broken
mv dist-backup dist
```

Or just check out an older commit, `npm ci`, and rebuild:

```bash
git log --oneline -10
git checkout <good-commit-sha>
npm ci
npm run build:seo
```

Apache changes nothing — it just reads whatever's in `dist/`.

---

## Troubleshooting

**Symptom: hitting `/programs` returns the homepage.**

The `.htaccess` SPA fallback is firing too aggressively, or
`dist/programs/index.html` wasn't generated. Check:

```bash
ls -la /var/www/simplelecture/dist/programs/
# Should contain index.html
```

If empty, re-run `npm run build:seo`. If present but Apache still serves the
homepage, `AllowOverride All` is probably missing from the `<Directory>`
block.

**Symptom: hashed JS / CSS files return 404.**

Vite hashes filenames on every build. If Apache caches the old `index.html`
but the new bundle, references won't match. The `.htaccess` sets
`Cache-Control: no-cache` on HTML to prevent this — make sure `mod_headers`
is enabled.

**Symptom: 500 on `.htaccess`.**

A directive isn't supported. Check `/var/log/apache2/error.log` and remove
the offending line — most likely you're on Apache <2.4 (`Require all
granted` won't work) or missing a module.
