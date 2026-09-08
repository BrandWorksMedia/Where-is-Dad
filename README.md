# Where is Dad? 🛻

A kid-friendly, always-on road-trip map for **bambamgo.com**.
A cartoon white Tacoma drives across a hand-drawn Gulf Coast map as Dad
travels from Miami to Tomball, Texas. Position comes from the free
[OwnTracks](https://owntracks.org) app on Dad's iPhone. The map lives on a
wall-mounted iPad.

```
iPhone (OwnTracks, HTTP mode)
   └─► https://bambamgo.com/api/owntracks.php?token=SECRET   (PHP, saves data/latest.json)
                                        ▲
iPad (Safari, full-screen)  ◄── polls api/location.php every 10 s ── index.html
```

No database, no Node, no build step. Plain HTML/JS/CSS plus three tiny PHP
files, so it runs on the same Hostinger shared hosting as brandworksmedia.com.

---

## 1. Put it on Hostinger (bambamgo.com)

### Option A: Git deploy (recommended)
1. hPanel → **Websites** → bambamgo.com → **Advanced → Git**.
2. Repository: `https://github.com/BrandWorksMedia/Where-is-Dad`, branch: the one you want live (e.g. `main`), install path: leave blank (that is `public_html`).
   *If the repo is private, copy the SSH key hPanel shows and add it to GitHub → repo → Settings → Deploy keys.*
3. Click **Deploy**. Turn on **Auto deployment** if you want pushes to go live automatically.
4. Make sure the free SSL certificate is installed for bambamgo.com (hPanel → Security → SSL). Both OwnTracks and the iPad need https.

### Option B: File Manager
Zip the project, upload to `domains/bambamgo.com/public_html`, extract.

### Then, either way: create the secret
1. hPanel → **File Manager** → `public_html/api/`.
2. Copy `config.example.php` to **`config.php`** and replace the token with a long random string
   (for example run `openssl rand -hex 16` on a Mac, or just mash the keyboard).
3. Check it works: open `https://bambamgo.com/api/admin.php?token=YOUR-TOKEN&action=status`.
   You should see `"ok": true` and `"data_dir_writable": true`.

`data/` is where the live positions are stored. It is blocked from the web by
`.htaccess` and ignored by git, so redeploys never wipe the trip.

---

## 2. Set up OwnTracks on Dad's iPhone

1. Install **OwnTracks** from the App Store. Allow Location **Always** and Precise Location on.
2. Tap the (i) / settings icon:
   - **Mode:** `HTTP`
   - **URL:** `https://bambamgo.com/api/owntracks.php?token=YOUR-TOKEN`
   - **Device ID:** `tacoma`  **Tracker ID:** `DA` (anything two letters)
   - User ID / Password can stay empty (the token in the URL is the password).
3. Set the **monitoring mode** to **Move** (the icon at the top of the map screen cycles
   Quiet → Manual → Significant → Move). Move mode reports every few hundred metres,
   which is what makes the truck creep along in real time. Switch back to Significant
   after the trip to save battery.
4. Tap the "publish now" arrow once. On the server,
   `https://bambamgo.com/api/admin.php?token=YOUR-TOKEN&action=status` should now show a location.
5. Keep the phone plugged in while driving. Move mode is thirsty.

Before the real trip, clear any test points:
`https://bambamgo.com/api/admin.php?token=YOUR-TOKEN&action=reset`

---

## 3. Set up the wall iPad

1. Open Safari → `https://bambamgo.com`.
2. Share → **Add to Home Screen** → open it from the icon. It runs full screen with no browser bars.
3. Settings → Display & Brightness → **Auto-Lock → Never**.
4. Optional but great with an 11-year-old: Settings → Accessibility → **Guided Access**,
   then triple-click the button in the app to lock the iPad to it.
5. Keep it plugged in. The page refreshes itself twice a day and shows a small
   "Reconnecting…" pill if the Wi-Fi drops; it never needs touching.

Works in landscape or portrait.

---

## 4. Try it before the trip

- **Demo trip:** `https://bambamgo.com/?demo=1` drives the whole route in about three minutes.
- **Pretend Dad is somewhere:**
  `https://bambamgo.com/api/admin.php?token=YOUR-TOKEN&action=fake&lat=30.43&lon=-84.28&vel=100&cog=270`
  (`vel` is km/h, `cog` is heading in degrees; 270 = heading west).
- **Start fresh:** `…/api/admin.php?token=YOUR-TOKEN&action=reset`

### What the kid sees
| Situation | Map says |
|---|---|
| No position yet | "Dad hasn't left yet!" with the truck parked in Miami |
| Driving | "Dad is between Lake City and Tallahassee", speed, next stop, miles to go, hours left |
| Within 15 mi of a landmark | "Dad is near Pensacola, FL! ✈️" plus a fun fact |
| More than 30 mi off the road | "Dad is exploring near …" |
| Phone silent 20+ min | "Dad's phone is resting 😴 — last seen near …" |
| Within 6 mi of Tomball | "DAD MADE IT TO TOMBALL! 🎉" and confetti |

An orange dotted trail shows everywhere the truck has been.

---

## 5. Change names, landmarks, facts

Everything editable is in **`assets/config.js`**: the kid's name, the driver's
name, polling speed, and the list of landmarks (name, state, lat/lon, emoji,
fun fact, big or small, where the label goes). Keep landmarks in driving order:
the road is drawn through them and progress is measured along that line.

Map shapes and the truck drawing are in `assets/map.js`; colours and
animations in `assets/style.css`; the logic in `assets/app.js`.

---

## Files

```
index.html               the page
manifest.webmanifest     lets iOS run it as a full-screen app
.htaccess                https redirect, no caching of the page, hides repo files
assets/config.js         names, landmarks, facts  ← edit me
assets/map.js            cartoon map + truck (SVG)
assets/app.js            polling, progress maths, dashboard, demo mode
assets/style.css         looks + animations
assets/icon*.png|svg     home-screen icons
api/owntracks.php        receives OwnTracks posts  (POST, token required)
api/location.php         latest position + trail for the iPad  (GET, public)
api/admin.php            status / reset / fake position  (token required)
api/config.example.php   copy to api/config.php and set the token
data/                    live position files (created by PHP, not in git)
```

## Local testing

```bash
cp api/config.example.php api/config.php   # set a token
php -S 127.0.0.1:8088 -t .
curl -X POST "http://127.0.0.1:8088/api/owntracks.php?token=YOUR-TOKEN" \
  -d '{"_type":"location","lat":30.43,"lon":-84.28,"tst":'$(date +%s)',"vel":100,"cog":270,"batt":80}'
open http://127.0.0.1:8088/
```
