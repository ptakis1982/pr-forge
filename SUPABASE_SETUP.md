# Supabase Setup Checklist

This project is still a local MVP prototype. These are the next Supabase steps for turning it into a live PWA.

## 1. Create A Supabase Project

In Supabase:

1. Create a new project.
2. Choose a project name.
3. Choose the closest region to your first users.
4. Save your database password somewhere secure.

Do not paste the database password or service role key into chat.

## 2. Values Needed By The App

The frontend app will eventually need:

```text
SUPABASE_URL=https://wkweyrhoxdrudlugnsqr.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_JUfiIBHawtkcESWuCIBhjw_kwyZmqcO
```

The publishable key is designed for browser apps, but it should still only be used with proper Row Level Security policies.

Do not expose:

```text
SUPABASE_SERVICE_ROLE_KEY
DATABASE_PASSWORD
DIRECT_DATABASE_URL
```

Those are server/admin secrets.

## 3. Enable Auth Providers

In Supabase Dashboard:

1. Go to Authentication.
2. Open Providers.
3. Enable Google.
4. Enable Facebook.

You will also need to create OAuth apps in:

- Google Cloud Console
- Meta for Developers

Supabase will show redirect URLs that must be copied into those provider dashboards.

### Facebook Provider Setup

In Meta for Developers:

1. Create a new app.
2. Add the Facebook Login product.
3. Choose web login.
4. Add your Supabase callback URL as a valid OAuth redirect URI:

```text
https://wkweyrhoxdrudlugnsqr.supabase.co/auth/v1/callback
```

5. Copy the Facebook App ID and App Secret.

In Supabase:

1. Go to Authentication.
2. Open Providers.
3. Open Facebook.
4. Enable Facebook.
5. Paste the App ID and App Secret.
6. Save.

Do not paste the Facebook App Secret into chat.

## 4. Create Storage Bucket

Create a private storage bucket:

```text
lift-videos
```

Recommended rules:

- Users can upload their own videos.
- Users can replace/delete their own videos.
- Video read access follows lift entry visibility.

For the first production build, we can implement signed URLs for private/friends-only videos.

After creating the bucket, run the SQL in:

```text
supabase-storage-policies.sql
```

Use Supabase Dashboard:

1. Open SQL Editor.
2. Create a new query.
3. Paste the full contents of `supabase-storage-policies.sql`.
4. Run the query.

## 5. Database Tables

Run the SQL in:

```text
supabase-schema.sql
```

Use Supabase Dashboard:

1. Open SQL Editor.
2. Create a new query.
3. Paste the full contents of `supabase-schema.sql`.
4. Run the query.

After the main schema is created, run later migrations as needed:

```text
supabase-friends-migration.sql
```

This adds profile discoverability and friend search/request support.

Initial production tables:

- `profiles`
- `exercises`
- `lift_entries`
- `videos`
- `friendships`
- `comments`
- `likes`
- `notifications`

## 6. Row Level Security

Every table should have Row Level Security enabled. The starter policies are included in `supabase-schema.sql`.

Minimum policy goals:

- Users can read and update their own profile.
- Users can read global exercises.
- Users can create and read their own custom exercises.
- Users can create, update, and delete their own lift entries.
- Users can read lift entries only when visibility allows it.
- Users can comment on and like visible lift entries.
- Users can manage friend requests involving their own profile.

## 7. What I Can Do Next

I can help create:

- Supabase Storage bucket policies.
- A production Next.js PWA app.
- Supabase Auth integration.
- Google/Facebook OAuth integration code.
- Video upload logic.
- Deployment setup for Vercel.

## 8. What You Need To Do

You need to personally handle:

- Creating the Supabase project.
- Creating Google and Facebook developer apps.
- Entering billing or payment details if requested.
- Copying redirect URLs between Supabase, Google, and Facebook dashboards.
- Owning the app domain if using a custom domain.
- Providing privacy policy and terms URLs before public launch.
