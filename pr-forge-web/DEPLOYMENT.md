# PR Forge Next.js Deployment

This folder is the production PWA shell for PR Forge.

## Local Setup

Copy the example env file:

```powershell
Copy-Item .env.local.example .env.local
```

Install dependencies and run:

```powershell
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## Vercel Deployment

1. Push this project to GitHub.
2. Create a Vercel project from `pr-forge-web`.
3. Add environment variables:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

4. Deploy.

## OAuth URLs To Update

After Vercel gives you a URL, add it in Supabase:

- Authentication -> URL Configuration -> Site URL
- Authentication -> URL Configuration -> Redirect URLs

Also add the Vercel URL to:

- Google OAuth authorized JavaScript origins
- Google OAuth redirect/origin settings as needed
- Facebook Login valid OAuth redirect settings through Supabase callback

Supabase OAuth callback remains:

```text
https://wkweyrhoxdrudlugnsqr.supabase.co/auth/v1/callback
```

## Migration Status

Created:

- Next.js project skeleton
- Supabase client
- PWA manifest
- Mobile shell and bottom navigation
- Google/Facebook OAuth buttons

Still to migrate from the prototype:

- Profile form
- Exercise list
- Add lift
- History/edit lift
- Progress chart
- Friends search/requests/feed
- Video upload/edit
