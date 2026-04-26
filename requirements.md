# PR Forge Requirements

## 1. Product Summary

PR Forge is a mobile and web application for tracking personal records in weightlifting, Olympic lifting, and related strength movements. Users can log lifts, automatically detect new personal records, upload videos, view progress over time, and follow friends' recent PRs.

The first version should focus on a clean individual tracking experience with lightweight social features.

## 2. MVP Scope

The MVP includes:

- Google login
- Facebook login
- User profile
- Predefined exercise list
- Custom exercises
- Add lift entry
- Automatic PR detection
- Video upload for lift entries
- Lift history
- Simple progress chart
- Friend requests
- Friends' PR feed

Out of scope for MVP:

- Full workout logging
- Training plans
- Apple Health, Garmin, Strava integrations
- AI form feedback
- Public leaderboards
- Bodyweight-adjusted scoring
- Competition mode
- Import/export

## 3. User Accounts

### Authentication

Users must be able to sign up and log in with:

- Google account
- Facebook account

The app must not store user passwords. Authentication should be handled by external OAuth identity providers only.

The app may store a user profile record linked to the external provider identity, but it should not provide an internal username/password login system. User records should be keyed by an external authentication identity reference, such as provider plus provider subject, instead of a separate internal login ID.

### Profile Fields

Each user profile should include:

- Name
- Surname, optional
- Nickname, optional
- Profile photo, uploaded from device photos or taken as a selfie where supported
- Sex: `female`, `male`, `non_binary`, `prefer_not_to_say`, or `self_describe`
- Birthday, optional, entered in `yyyy/mm/dd` format
- Bodyweight
- Preferred unit for bodyweight and lifts: `kg` or `lb`
- Country, selected from a standardized country list
- Club, optional
- Privacy setting: `public`, `friends`, or `private`

Google or Facebook may provide locale or region information depending on provider permissions and account data, but country should not be treated as guaranteed. Country must be collected during onboarding if it is not provided by the login provider.

### Acceptance Criteria

- A user can sign in with Google.
- A user can sign in with Facebook.
- A new user profile is created after first login.
- A returning user can access their existing profile.
- A user can update name, surname, nickname, photo, sex, birthday, bodyweight, preferred unit, country, club, and privacy setting.
- A user can upload a profile photo from their device.
- On supported mobile devices, a user can take a selfie for their profile photo.
- Bodyweight is required before a user can complete onboarding.
- Country is required before a user can complete onboarding.
- Country is selected from a standardized list to avoid inconsistent entries such as `Lietuva`, `LT`, and `LTU`.
- One preferred unit is used for both bodyweight and lift entries.

## 4. Exercises

### Predefined Exercises

The app should include the following predefined exercises:

- Snatch
- Power snatch
- Hang snatch
- Clean
- Power clean
- Hang clean
- Clean and jerk
- Jerk
- Split jerk
- Push press
- Front squat
- Back squat
- Deadlift
- Bench press
- Overhead squat

### Custom Exercises

Users should be able to create custom exercises.

Custom exercise fields:

- Name
- Lift type, optional
- Description explaining what kind of exercise it is
- Owner user reference

### Acceptance Criteria

- A user can select from predefined exercises when adding a lift.
- A user can create a custom exercise.
- A custom exercise must include a short explanation of what the exercise is.
- Custom exercises appear in that user's exercise selector.
- Users cannot edit or delete global predefined exercises.

## 5. Lift Logging

Users must be able to add a lift entry with:

- Exercise
- Date
- Weight lifted
- Unit: `kg` or `lb`
- Number of reps
- Percentage of max, optional
- Notes, optional
- Video upload, optional
- Location or gym, optional
- Bodyweight on that day, optional
- Whether lifting straps were used
- Visibility: `public`, `friends`, or `private`

Example:

```json
{
  "user_ref": "google:1234567890",
  "exercise_id": "clean_and_jerk",
  "date": "2026-04-25",
  "weight": 100,
  "unit": "kg",
  "reps": 1,
  "percentage_of_max": 95,
  "notes": "Felt strong today",
  "straps_used": false,
  "video_url": "https://...",
  "is_pr": true,
  "visibility": "friends"
}
```

### PR Detection

The app should automatically determine whether a new entry is a personal record for that user and exercise.

For MVP, PR detection should be based on:

- Same user
- Same exercise
- Same rep count
- Highest normalized weight

Weight should be normalized internally so kg and lb entries can be compared correctly.

Example:

If a user previously logged:

- Clean and jerk, 1 rep, 95 kg

And then logs:

- Clean and jerk, 1 rep, 100 kg

The new entry should be marked as a PR.

### Estimated 1RM

If reps are greater than 1, the app should calculate an estimated 1RM.

Recommended MVP formula:

```text
estimated_1rm = weight * (1 + reps / 30)
```

The formula should be applied using the lift entry's normalized weight.

### Acceptance Criteria

- A user can add a lift entry.
- Required fields are validated before saving.
- A lift can be logged in either kg or lb.
- The app stores normalized weight for comparison.
- The app marks a lift as a PR when it exceeds the previous best for the same exercise and rep count.
- The app calculates estimated 1RM for entries above 1 rep.
- The lift appears in the user's lift history after saving.

## 6. Video Upload

Users should be able to attach a video to each lift entry.

Videos should be stored in dedicated file/object storage, such as Amazon S3, Google Cloud Storage, Firebase Storage, Supabase Storage, or equivalent cloud storage. The database should store video metadata and storage references, not large video binary files directly.

### Video Requirements

- Attach video to a lift entry
- Show video in lift history
- Allow user to delete video
- Allow user to replace video
- Store thumbnail preview if available
- Store video file in object storage
- Store video metadata in the database

Optional:

- Compress video before upload

### Acceptance Criteria

- A user can upload a video while creating or editing a lift entry.
- A video is associated with exactly one lift entry.
- The video file is stored in a configured storage bucket.
- The database stores the video's storage provider, bucket, object key, URL, and metadata.
- A user can view the video from lift history.
- A user can delete a video from their own lift entry.
- A user can replace an existing video.
- Video visibility follows the lift entry visibility.

## 7. Progress Tracking

For each exercise, the app should show:

- Current PR
- Full lift history
- Progress chart over time
- Best lift by reps, such as 1RM, 3RM, and 5RM
- Estimated 1RM for multi-rep lifts
- Date of last PR
- Difference from previous PR

Example:

```text
Snatch PR improved from 70 kg to 75 kg.
```

### Acceptance Criteria

- A user can open an exercise detail view.
- The view shows the user's current PR for that exercise.
- The view shows a chronological lift history.
- The view includes a basic line chart of best lift over time.
- The view shows best known 1RM, 3RM, and 5RM where data exists.
- The view shows the latest PR date.
- If there is a previous PR, the view shows the improvement amount.

## 8. Friends And Social Features

Users should be able to:

- Search for friends
- Send friend requests
- Accept friend requests
- Reject friend requests
- View friends' PRs depending on privacy settings
- Like friends' lifts
- Comment on friends' lifts
- See a feed of recent PRs from friends

Optional future features:

- Groups, such as "My CrossFit gym"
- Leaderboards by exercise
- Progress comparison with friends

### Acceptance Criteria

- A user can search for another user by name.
- A user can send a friend request.
- A recipient can accept or reject a friend request.
- Accepted friends can see each other's `friends` visibility lifts.
- Users cannot see private lifts from other users.
- A user can like a visible friend lift.
- A user can comment on a visible friend lift.
- The dashboard includes recent visible PRs from friends.

## 9. Privacy

Users should control lift visibility:

- `private`: only the owner can view
- `friends`: accepted friends can view
- `public`: anyone can view

Video visibility must follow the parent lift entry visibility.

### Acceptance Criteria

- A user can set a default privacy level on their profile.
- A user can override visibility per lift entry.
- Private lifts are only visible to the owner.
- Friends-only lifts are visible to the owner and accepted friends.
- Public lifts are visible to anyone allowed by the app surface.
- Videos use the same access rules as their lift entries.

## 10. Notifications

The app may send notifications when:

- A friend sets a new PR
- Someone comments on a lift
- Someone likes a lift
- A friend request is received
- A user has not logged training for some time

For MVP, notifications can be stored in-app without push delivery.

### Acceptance Criteria

- A user receives an in-app notification for a friend request.
- A user receives an in-app notification when someone likes or comments on their lift.
- A user receives an in-app notification when a friend sets a visible PR.
- A user can mark notifications as read.

## 11. Search And Filters

Users should be able to filter lift history by:

- Exercise
- Date range
- PR only
- Lift type
- Reps
- Weight

### Acceptance Criteria

- A user can filter lift history by exercise.
- A user can filter lift history by date range.
- A user can show only PR entries.
- A user can filter by reps.
- A user can clear all filters.

## 12. Dashboard

The main dashboard should show:

- User's latest PRs
- Favourite exercises
- Recent lift entries
- Progress summary
- Friends' recent PRs

### Acceptance Criteria

- A signed-in user lands on the dashboard.
- The dashboard shows the user's latest PRs.
- The dashboard shows recent lift entries.
- The dashboard shows favorite exercises if any are selected.
- The dashboard shows a short progress summary.
- The dashboard shows recent visible PRs from friends.

## 13. Data Model

### users

| Field | Type | Notes |
| --- | --- | --- |
| auth_identity_ref | string | Primary key, derived from provider and provider subject |
| email | string | Unique where available |
| auth_provider | string | `google` or `facebook` |
| auth_provider_subject | string | Stable external provider user identifier |
| name | string | Required |
| surname | string | Optional |
| nickname | string | Optional |
| profile_photo_url | string | Optional |
| sex | string | `female`, `male`, `non_binary`, `prefer_not_to_say`, or `self_describe` |
| sex_self_description | string | Optional, used when sex is `self_describe` |
| birthday | date | Optional |
| bodyweight | number | Required |
| preferred_unit | string | `kg` or `lb`, used for bodyweight and lifts |
| country | string | Required, ISO 3166-1 alpha-2 code recommended |
| club | string | Optional |
| privacy_setting | string | `public`, `friends`, or `private` |
| created_at | datetime | Required |
| updated_at | datetime | Required |

### exercises

| Field | Type | Notes |
| --- | --- | --- |
| id | string | Primary key |
| name | string | Required |
| slug | string | Unique for global exercises |
| lift_type | string | Optional |
| description | text | Required for custom exercises, optional for global exercises |
| is_global | boolean | True for predefined exercises |
| owner_user_ref | string | Null for global exercises |
| created_at | datetime | Required |

### lift_entries

| Field | Type | Notes |
| --- | --- | --- |
| id | string | Primary key |
| user_ref | string | Required, references `users.auth_identity_ref` |
| exercise_id | string | Required |
| date | date | Required |
| weight | number | Required |
| unit | string | `kg` or `lb` |
| normalized_weight_kg | number | Required |
| reps | number | Required |
| percentage_of_max | number | Optional |
| estimated_1rm_kg | number | Optional |
| notes | text | Optional |
| location | string | Optional |
| bodyweight | number | Optional |
| bodyweight_unit | string | Optional, should match user's preferred unit by default |
| straps_used | boolean | Required |
| is_pr | boolean | Required |
| visibility | string | `public`, `friends`, or `private` |
| created_at | datetime | Required |
| updated_at | datetime | Required |

### videos

| Field | Type | Notes |
| --- | --- | --- |
| id | string | Primary key |
| lift_entry_id | string | Required |
| user_ref | string | Required, references `users.auth_identity_ref` |
| storage_provider | string | Example: `s3`, `gcs`, `firebase_storage`, or `supabase_storage` |
| storage_bucket | string | Required |
| storage_object_key | string | Required |
| video_url | string | Required |
| thumbnail_url | string | Optional |
| mime_type | string | Required |
| file_size_bytes | number | Optional |
| duration_seconds | number | Optional |
| created_at | datetime | Required |

### friendships

| Field | Type | Notes |
| --- | --- | --- |
| id | string | Primary key |
| requester_ref | string | Required, references `users.auth_identity_ref` |
| recipient_ref | string | Required, references `users.auth_identity_ref` |
| status | string | `pending`, `accepted`, or `rejected` |
| created_at | datetime | Required |
| updated_at | datetime | Required |

### comments

| Field | Type | Notes |
| --- | --- | --- |
| id | string | Primary key |
| lift_entry_id | string | Required |
| user_ref | string | Required, references `users.auth_identity_ref` |
| body | text | Required |
| created_at | datetime | Required |
| updated_at | datetime | Required |

### likes

| Field | Type | Notes |
| --- | --- | --- |
| id | string | Primary key |
| lift_entry_id | string | Required |
| user_ref | string | Required, references `users.auth_identity_ref` |
| created_at | datetime | Required |

### notifications

| Field | Type | Notes |
| --- | --- | --- |
| id | string | Primary key |
| user_ref | string | Recipient, references `users.auth_identity_ref` |
| actor_user_ref | string | Optional, references `users.auth_identity_ref` |
| type | string | Required |
| lift_entry_id | string | Optional |
| friendship_id | string | Optional |
| read_at | datetime | Optional |
| created_at | datetime | Required |

## 14. API Requirements

Suggested MVP API surface:

- `GET /me`
- `PATCH /me`
- `GET /exercises`
- `POST /exercises`
- `GET /lift-entries`
- `POST /lift-entries`
- `GET /lift-entries/:id`
- `PATCH /lift-entries/:id`
- `DELETE /lift-entries/:id`
- `POST /lift-entries/:id/video`
- `DELETE /lift-entries/:id/video`
- `GET /progress/:exerciseId`
- `GET /friends/search`
- `POST /friend-requests`
- `POST /friend-requests/:id/accept`
- `POST /friend-requests/:id/reject`
- `GET /feed`
- `POST /lift-entries/:id/likes`
- `DELETE /lift-entries/:id/likes`
- `POST /lift-entries/:id/comments`
- `GET /notifications`
- `PATCH /notifications/:id/read`

## 15. Core Screens

### Login

- Google login button
- Facebook login button
- Basic product name and app purpose

### Dashboard

- Latest PRs
- Recent lift entries
- Favorite exercises
- Progress summary
- Friends' recent PRs

### Add Lift

- Exercise selector
- Date picker
- Weight input
- Unit selector
- Reps input
- Optional percentage field
- Optional bodyweight field
- Optional location, gym, or club field, prefilled from profile club when available
- Straps used selector
- Optional notes field
- Optional video upload
- Visibility selector

### Lift History

- Filter controls
- List of lift entries
- PR badges
- Video thumbnails where available

### Exercise Progress

- Current PR
- Best lifts by reps
- Line chart
- Lift history for that exercise

### Friends

- Friend search
- Pending requests
- Friend list

### Feed

- Recent friends' PRs
- Like and comment actions

### Profile

- Name
- Surname
- Nickname
- Photo upload or selfie
- Sex
- Birthday
- Bodyweight
- Preferred unit
- Country
- Club
- Privacy setting

## 16. Business Rules

- Users can only edit or delete their own lift entries.
- Users can only delete or replace videos attached to their own lift entries.
- User authentication is handled through Google or Facebook OAuth only.
- The app must not store passwords.
- The app must not expose an internal username/password login.
- Each lift entry can have zero or one video in the MVP.
- Video files are stored in object storage, while the database stores metadata and storage references.
- Lift visibility controls access to the lift and its video.
- PR detection must compare normalized weights.
- PR detection is scoped by user, exercise, and rep count.
- Friend visibility requires an accepted friendship.
- A user cannot send duplicate pending friend requests to the same user.
- A user cannot friend themselves.
- A user can like a visible lift only once.

## 17. Non-Functional Requirements

### Performance

- Dashboard should load within 2 seconds on a normal connection after authentication.
- Lift history should support pagination or infinite scrolling.
- Video uploads should show progress feedback.

### Security

- All authenticated routes require a valid session.
- Users cannot access private or unauthorized friend-only lifts.
- File uploads must validate video file type and size.
- Server-side checks must enforce ownership and visibility.

### Accessibility

- Forms must have accessible labels.
- Buttons must have clear names.
- Charts should include text summaries.
- Color should not be the only indicator of PR status.

### Reliability

- Failed video uploads should not corrupt the lift entry.
- Lift entry creation should work without a video.
- The app should show clear errors for failed saves, uploads, or authentication.

## 18. Nice-To-Have Future Features

- Training plans
- Workout logging, not only PRs
- Wilks or Sinclair-style scoring
- Bodyweight-adjusted leaderboards
- Import and export to Excel or CSV
- Garmin integration
- Strava integration
- Apple Health integration
- AI form feedback from uploaded videos
- Competition mode
- Personal goals, such as "100 kg clean and jerk by December"

## 19. MVP Success Criteria

The MVP is successful when a user can:

- Sign in with Google
- Sign in with Facebook
- Complete their profile
- Add a lift for a predefined exercise
- Upload a video to that lift
- See whether the lift is a PR
- View lift history
- View simple progress over time
- Add a friend
- See a friend's visible PR in the feed
