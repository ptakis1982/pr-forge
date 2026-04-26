# PR Forge MVP

This is a local-first MVP prototype for PR Forge.

## Run

Open the running local app:

```text
http://127.0.0.1:4173/
```

If the server is not running, start it from this folder:

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

## Production App Folder

The deployable Next.js PWA shell now lives in:

```text
pr-forge-web
```

See:

```text
pr-forge-web/DEPLOYMENT.md
```

The current root-level `index.html`, `app.js`, and `styles.css` files remain the working prototype while features are migrated into the Next.js app.

## Test Google Login Locally

Google OAuth is now wired through Supabase.

Before testing, make sure Google provider is enabled in Supabase and your Google email is added as a test user in Google OAuth consent screen.

Local callback/origin notes:

- Supabase project URL: `https://wkweyrhoxdrudlugnsqr.supabase.co`
- Local app URL: `http://127.0.0.1:4173/`

If Google blocks local redirect during testing, add this URL in Supabase Authentication URL settings:

```text
http://127.0.0.1:4173/
```

For production, replace this with the deployed PWA URL.

## What Works

- PWA manifest and service worker
- Mobile-first header with bottom thumb navigation
- Google-style sign-in
- Real Google sign-in through Supabase Auth
- Facebook-style sign-in
- No internal password flow
- Required onboarding profile with bodyweight and country
- Optional nickname and birthday
- Optional surname and club
- Profile photo upload or selfie capture on supported devices
- Standardized country selector
- Sex field with common options
- One shared unit preference for bodyweight and lifts
- Predefined exercises
- Custom exercises with description
- Add lift entry
- Save lift entries to Supabase after Google login
- Automatic PR detection by exercise and rep count
- Estimated 1RM for multi-rep lifts
- Straps-used field on lift entries
- Video attachment, replacement, and deletion
- Local video blob storage using IndexedDB
- Supabase video upload path is available after Google login
- Database-like video metadata stored with lift entries
- Lift history filters
- Progress chart
- Workout percentage calculator with editable training max, rounds, saved plans, and feed activity
- Friend request demo flow
- Friends' PR feed with likes and comments
- Inline comments on friends' PR feed items
- Likes and comments persist to Supabase for real PR lift entries

## Prototype Storage

This MVP stores app data in browser `localStorage`.

Video files are stored separately in browser `IndexedDB`, while lift entries keep metadata such as storage provider, bucket name, object key, MIME type, and file size. This mirrors the intended production architecture where video files should live in object storage and the database should store metadata/references.

## Production Notes

For production, replace the local prototype layer with:

- Google OAuth
- Facebook OAuth
- Backend session handling
- Database tables from `requirements.md`
- Object storage such as S3, Google Cloud Storage, Firebase Storage, or Supabase Storage
- Server-side privacy and ownership checks

See `SUPABASE_SETUP.md` for the Supabase production checklist.
