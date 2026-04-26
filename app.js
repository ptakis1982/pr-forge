const EXERCISES = [
  "Snatch",
  "Power snatch",
  "Hang snatch",
  "Clean",
  "Power clean",
  "Hang clean",
  "Clean and jerk",
  "Jerk",
  "Split jerk",
  "Push press",
  "Front squat",
  "Back squat",
  "Deadlift",
  "Bench press",
  "Overhead squat"
].map((name) => ({
  id: slug(name),
  name,
  liftType: name.includes("squat") ? "squat" : name.includes("press") || name.includes("jerk") ? "overhead" : "olympic",
  description: "Predefined strength or Olympic weightlifting movement.",
  global: true
}));

const SAMPLE_FRIENDS = [
  { ref: "google:sofia-demo", name: "Sofia", nickname: "Sofi", accepted: true },
  { ref: "facebook:martin-demo", name: "Martin", nickname: "M", accepted: false }
];

const SAMPLE_FEED = [
  {
    id: "feed-1",
    friend: "Sofia",
    exercise: "Snatch",
    weight: 74,
    unit: "kg",
    reps: 1,
    date: "2026-04-22",
    note: "New PR after three weeks."
  },
  {
    id: "feed-2",
    friend: "Sofia",
    exercise: "Front squat",
    weight: 112,
    unit: "kg",
    reps: 3,
    date: "2026-04-19",
    note: "Smooth triple."
  }
];

const SAMPLE_WORKOUT_FEED = [
  {
    id: "workout-feed-1",
    type: "workout",
    friend: "Sofia",
    exercise: "Clean",
    date: "2026-04-24",
    baseWeight: "100 kg",
    weight: "Base 100 kg",
    reps: 4,
    roundsCount: 4,
    note: "Planned 50%, 60%, 70%, 80%."
  }
];

const COUNTRIES = [
  ["LT", "Lithuania"],
  ["LV", "Latvia"],
  ["EE", "Estonia"],
  ["PL", "Poland"],
  ["DE", "Germany"],
  ["FR", "France"],
  ["GB", "United Kingdom"],
  ["IE", "Ireland"],
  ["ES", "Spain"],
  ["IT", "Italy"],
  ["NL", "Netherlands"],
  ["NO", "Norway"],
  ["SE", "Sweden"],
  ["FI", "Finland"],
  ["DK", "Denmark"],
  ["US", "United States"],
  ["CA", "Canada"],
  ["AU", "Australia"],
  ["NZ", "New Zealand"],
  ["UA", "Ukraine"]
];

const SUPABASE_URL = "https://wkweyrhoxdrudlugnsqr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_JUfiIBHawtkcESWuCIBhjw_kwyZmqcO";
const supabaseClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
let authSyncRun = 0;

const app = document.querySelector("#app");
const state = {
  tab: "dashboard",
  session: supabaseClient ? null : read("session", null),
  authReady: false,
  profile: supabaseClient ? null : read("profile", null),
  exercises: supabaseClient ? EXERCISES : read("exercises", EXERCISES),
  lifts: supabaseClient ? [] : read("lifts", []),
  friends: read("friends", SAMPLE_FRIENDS),
  friendResults: [],
  friendSearchTerm: "",
  friendSearchRan: false,
  likes: read("likes", {}),
  comments: read("comments", {}),
  likeCounts: {},
  filters: { exercise: "", prOnly: false, reps: "", from: "", to: "" },
  editingLiftId: "",
  editingWorkoutId: "",
  progressMode: "actual",
  workout: read("workout", null),
  savedWorkouts: read("saved_workouts", [])
};

let videoUrls = {};

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(`pr_tracker_${key}`)) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(`pr_tracker_${key}`, JSON.stringify(value));
}

function save() {
  if (!supabaseClient) {
    write("session", state.session);
    write("profile", state.profile);
    write("exercises", state.exercises);
    write("lifts", state.lifts);
  }
  write("friends", state.friends);
  write("likes", state.likes);
  write("comments", state.comments);
  write("workout", state.workout);
  write("saved_workouts", state.savedWorkouts);
}

function clearSupabaseLocalCache() {
  ["session", "profile", "exercises", "lifts"].forEach((key) => {
    localStorage.removeItem(`pr_tracker_${key}`);
  });
}

function kg(weight, unit) {
  return unit === "lb" ? weight * 0.45359237 : weight;
}

function displayWeight(weightKg, unit) {
  return unit === "lb" ? `${Math.round(weightKg / 0.45359237)} lb` : `${round(weightKg)} kg`;
}

function weightInUnit(weightKg, unit) {
  return unit === "lb" ? weightKg / 0.45359237 : weightKg;
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function exerciseName(id) {
  return state.exercises.find((exercise) => exercise.id === id)?.name ?? "Unknown exercise";
}

function toast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

function setTab(tab) {
  state.tab = tab;
  render();
}

async function signIn(provider) {
  if (provider === "google" && supabaseClient) {
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + window.location.pathname,
        queryParams: {
          prompt: "select_account"
        }
      }
    });
    if (error) toast(error.message);
    return;
  }
  if (provider === "facebook" && supabaseClient) {
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: "facebook",
      options: {
        redirectTo: window.location.origin + window.location.pathname
      }
    });
    if (error) toast(error.message);
    return;
  }

  const providerSubject = `${Date.now()}`;
  state.session = { provider, providerSubject, authRef: `${provider}:${providerSubject}` };
  if (!state.profile) {
    state.profile = {
      authIdentityRef: state.session.authRef,
      authProvider: provider,
      authProviderSubject: providerSubject,
      name: provider === "google" ? "Google User" : "Facebook User",
      surname: "",
      nickname: "",
      photo: "",
      photoDataUrl: "",
      sex: "prefer_not_to_say",
      sexSelfDescription: "",
      birthday: "",
      bodyweight: "",
      unit: "kg",
      country: "",
      club: "",
      searchEnabled: true,
      privacy: "friends"
    };
  }
  save();
  render();
}

async function signOut() {
  if (supabaseClient) {
    await supabaseClient.auth.signOut();
    clearSupabaseLocalCache();
  }
  state.session = null;
  state.profile = null;
  state.lifts = [];
  state.exercises = supabaseClient ? EXERCISES : state.exercises;
  save();
  render();
}

async function syncSupabaseSession(session) {
  const run = ++authSyncRun;
  if (!session?.user) {
    state.session = null;
    state.profile = null;
    state.lifts = [];
    state.authReady = true;
    if (supabaseClient) clearSupabaseLocalCache();
    save();
    render();
    return;
  }

  const user = session.user;
  state.session = {
    provider: user.app_metadata?.provider || "google",
    providerSubject: user.id,
    authRef: user.id,
    email: user.email
  };

  const { profile, error } = await findSupabaseProfile(user);

  if (error) {
    toast(error.message);
  }

  if (profile) {
    state.profile = fromSupabaseProfile(profile, user);
  } else {
    const fullName = user.user_metadata?.full_name || user.user_metadata?.name || "";
    const [firstName, ...rest] = fullName.split(" ").filter(Boolean);
    state.profile = {
      authIdentityRef: user.id,
      authProvider: state.session.provider,
      authProviderSubject: user.id,
      email: user.email || "",
      name: firstName || fullName || "New user",
      surname: rest.join(" "),
      nickname: "",
      photo: user.user_metadata?.avatar_url || "",
      photoDataUrl: "",
      sex: "prefer_not_to_say",
      sexSelfDescription: "",
      birthday: "",
      bodyweight: "",
      unit: "kg",
      country: "",
      club: "",
      searchEnabled: true,
      privacy: "friends"
    };
  }

  await loadSupabaseData(user.id);
  if (run !== authSyncRun) return;
  state.authReady = true;
  save();
  render();
}

async function findSupabaseProfile(user) {
  const byId = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (byId.error) return { profile: null, error: byId.error };
  if (byId.data) return { profile: byId.data, error: null };

  if (!user.email) return { profile: null, error: null };

  const byEmail = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("email", user.email)
    .maybeSingle();

  if (byEmail.error) return { profile: null, error: byEmail.error };
  return { profile: byEmail.data, error: null };
}

function fromSupabaseProfile(profile, user) {
  return {
    authIdentityRef: profile.id,
    authProvider: user.app_metadata?.provider || "google",
    authProviderSubject: profile.id,
    email: profile.email || user.email || "",
    name: profile.name || "",
    surname: profile.surname || "",
    nickname: profile.nickname || "",
    photo: profile.profile_photo_url || "",
    photoDataUrl: "",
    sex: profile.sex || "prefer_not_to_say",
    sexSelfDescription: profile.sex_self_description || "",
    birthday: normalizeBirthday(profile.birthday || ""),
    bodyweight: profile.bodyweight || "",
    unit: profile.preferred_unit || "kg",
    country: profile.country || "",
    club: profile.club || "",
    searchEnabled: profile.search_enabled !== false,
    privacy: profile.privacy_setting || "friends"
  };
}

async function loadSupabaseData(userId) {
  if (!supabaseClient || !userId) return;

  const { data: exercises, error: exerciseError } = await supabaseClient
    .from("exercises")
    .select("*")
    .order("is_global", { ascending: false })
    .order("name");

  if (exerciseError) {
    toast(exerciseError.message);
  } else if (exercises?.length) {
    state.exercises = exercises.map(fromSupabaseExercise);
  }

  const { data: lifts, error: liftsError } = await supabaseClient
    .from("lift_entries")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (liftsError) {
    toast(liftsError.message);
  } else {
    const liftIds = (lifts || []).map((lift) => lift.id);
    let videosByLiftId = new Map();
    if (liftIds.length) {
      const { data: videos, error: videosError } = await supabaseClient
        .from("videos")
        .select("*")
        .in("lift_entry_id", liftIds);
      if (videosError) {
        toast(videosError.message);
      } else {
        videosByLiftId = new Map((videos || []).map((video) => [video.lift_entry_id, video]));
      }
    }
    state.lifts = (lifts || []).map((lift) => fromSupabaseLift({
      ...lift,
      videos: videosByLiftId.get(lift.id) ? [videosByLiftId.get(lift.id)] : []
    }));
    await loadSupabaseFriends();
    await loadSupabaseSocial(state.lifts.map((lift) => lift.id));
    recomputePrs();
  }
}

async function loadSupabaseFriends() {
  if (!supabaseClient || !state.session?.authRef) return;
  const userId = state.session.authRef;
  const { data, error } = await supabaseClient
    .from("friendships")
    .select("*")
    .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) {
    toast(error.message);
    return;
  }
  const otherIds = [...new Set((data || []).map((row) => row.requester_id === userId ? row.recipient_id : row.requester_id))];
  let profilesById = new Map();
  if (otherIds.length) {
    const { data: profiles, error: profilesError } = await supabaseClient
      .from("profiles")
      .select("id,name,surname,nickname,club,country,profile_photo_url")
      .in("id", otherIds);
    if (profilesError) {
      toast(profilesError.message);
    } else {
      profilesById = new Map((profiles || []).map((profile) => [profile.id, profile]));
    }
  }
  state.friends = (data || []).map((row) => {
    const otherId = row.requester_id === userId ? row.recipient_id : row.requester_id;
    const profile = profilesById.get(otherId) || {};
    return {
      ref: row.id,
      profileId: otherId,
      name: [profile.name, profile.surname].filter(Boolean).join(" ") || "User",
      nickname: profile.nickname || "",
      club: profile.club || "",
      country: profile.country || "",
      status: row.status,
      accepted: row.status === "accepted",
      incoming: row.recipient_id === userId && row.status === "pending"
    };
  });
}

async function loadSupabaseSocial(liftIds) {
  state.likes = {};
  state.likeCounts = {};
  state.comments = {};
  if (!supabaseClient || !state.session?.authRef || !liftIds.length) return;

  const { data: likes, error: likesError } = await supabaseClient
    .from("likes")
    .select("lift_entry_id,user_id")
    .in("lift_entry_id", liftIds);

  if (likesError) {
    toast(likesError.message);
  } else {
    (likes || []).forEach((like) => {
      state.likeCounts[like.lift_entry_id] = (state.likeCounts[like.lift_entry_id] || 0) + 1;
      if (like.user_id === state.session.authRef) state.likes[like.lift_entry_id] = true;
    });
  }

  const { data: comments, error: commentsError } = await supabaseClient
    .from("comments")
    .select("id,lift_entry_id,user_id,body,created_at")
    .in("lift_entry_id", liftIds)
    .order("created_at", { ascending: true });

  if (commentsError) {
    toast(commentsError.message);
  } else {
    (comments || []).forEach((comment) => {
      state.comments[comment.lift_entry_id] = [
        ...(state.comments[comment.lift_entry_id] || []),
        {
          id: comment.id,
          body: comment.body,
          author: comment.user_id === state.session.authRef ? (state.profile?.nickname || state.profile?.name || "You") : "User"
        }
      ];
    });
  }
}

function fromSupabaseExercise(exercise) {
  return {
    id: exercise.id,
    name: exercise.name,
    liftType: exercise.lift_type || "",
    description: exercise.description || "",
    global: exercise.is_global,
    ownerUserRef: exercise.owner_user_id || ""
  };
}

function fromSupabaseLift(lift) {
  const video = Array.isArray(lift.videos) ? lift.videos[0] : lift.videos;
  return {
    id: lift.id,
    userRef: lift.user_id,
    exerciseId: lift.exercise_id,
    date: lift.date,
    weight: Number(lift.weight),
    unit: lift.unit,
    normalizedWeightKg: Number(lift.normalized_weight_kg),
    reps: Number(lift.reps),
    percentage: lift.percentage_of_max ?? "",
    estimated1rmKg: lift.estimated_1rm_kg ? Number(lift.estimated_1rm_kg) : estimatedMaxKg(Number(lift.normalized_weight_kg), Number(lift.reps), lift.percentage_of_max),
    notes: lift.notes || "",
    location: lift.location || "",
    bodyweight: lift.bodyweight ?? "",
    bodyweightUnit: lift.bodyweight_unit || userUnit(),
    strapsUsed: Boolean(lift.straps_used),
    visibility: lift.visibility,
    isPr: Boolean(lift.is_pr),
    video: video ? {
      storageProvider: video.storage_provider,
      storageBucket: video.storage_bucket,
      storageObjectKey: video.storage_object_key,
      name: video.storage_object_key.split("/").pop(),
      mimeType: video.mime_type,
      size: video.file_size_bytes
    } : null,
    createdAt: lift.created_at
  };
}

async function saveSupabaseLift(lift, file) {
  if (!supabaseClient || !state.session?.authRef || state.session.authRef.includes(":")) {
    return lift;
  }

  const payload = {
    user_id: state.session.authRef,
    exercise_id: lift.exerciseId,
    date: lift.date,
    weight: lift.weight,
    unit: lift.unit,
    normalized_weight_kg: lift.normalizedWeightKg,
    reps: lift.reps,
    percentage_of_max: lift.percentage || null,
    estimated_1rm_kg: lift.estimated1rmKg || null,
    notes: lift.notes || null,
    location: lift.location || null,
    bodyweight: lift.bodyweight || null,
    bodyweight_unit: lift.bodyweightUnit || userUnit(),
    straps_used: lift.strapsUsed,
    is_pr: lift.isPr,
    visibility: lift.visibility
  };

  const { data, error } = await supabaseClient
    .from("lift_entries")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;

  const savedLift = fromSupabaseLift({ ...data, videos: [] });

  if (file) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
    const objectKey = `${state.session.authRef}/${savedLift.id}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabaseClient.storage
      .from("lift-videos")
      .upload(objectKey, file, { contentType: file.type, upsert: true });
    if (uploadError) throw uploadError;

    const { error: videoError } = await supabaseClient.from("videos").insert({
      lift_entry_id: savedLift.id,
      user_id: state.session.authRef,
      storage_provider: "supabase_storage",
      storage_bucket: "lift-videos",
      storage_object_key: objectKey,
      mime_type: file.type || "video/mp4",
      file_size_bytes: file.size
    });
    if (videoError) throw videoError;

    savedLift.video = {
      storageProvider: "supabase_storage",
      storageBucket: "lift-videos",
      storageObjectKey: objectKey,
      name: safeName,
      mimeType: file.type,
      size: file.size
    };
  }

  return savedLift;
}

async function updateSupabaseLift(lift) {
  if (!supabaseClient || !state.session?.authRef || state.session.authRef.includes(":")) return;
  const { error } = await supabaseClient
    .from("lift_entries")
    .update({
      exercise_id: lift.exerciseId,
      date: lift.date,
      weight: lift.weight,
      unit: lift.unit,
      normalized_weight_kg: lift.normalizedWeightKg,
      reps: lift.reps,
      percentage_of_max: lift.percentage || null,
      estimated_1rm_kg: lift.estimated1rmKg || null,
      notes: lift.notes || null,
      location: lift.location || null,
      bodyweight: lift.bodyweight || null,
      bodyweight_unit: lift.bodyweightUnit || userUnit(),
      straps_used: lift.strapsUsed,
      is_pr: lift.isPr,
      visibility: lift.visibility
    })
    .eq("id", lift.id)
    .eq("user_id", state.session.authRef);
  if (error) throw error;
}

async function syncSupabasePrFlags() {
  if (!supabaseClient || !state.session?.authRef || state.session.authRef.includes(":")) return;
  await Promise.all(state.lifts.map((lift) =>
    supabaseClient
      .from("lift_entries")
      .update({ is_pr: lift.isPr })
      .eq("id", lift.id)
      .eq("user_id", state.session.authRef)
  ));
}

function isProfileComplete() {
  return Boolean(state.profile?.name && state.profile?.bodyweight && state.profile?.country);
}

function userUnit() {
  return state.profile?.unit || state.profile?.preferredUnit || state.profile?.bodyweightUnit || "kg";
}

function normalizeBirthday(value) {
  return String(value ?? "").trim().replaceAll("-", "/");
}

function validBirthday(value) {
  return !value || /^\d{4}\/\d{2}\/\d{2}$/.test(value);
}

function displayDate(isoDate) {
  if (!isoDate) return "";
  const [year, month, day] = String(isoDate).split("-");
  if (!year || !month || !day) return escapeHtml(isoDate);
  return `${year}-${month}-${day}`;
}

function parseDateInput(value) {
  const trimmed = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const slash = trimmed.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (slash) return `${slash[1]}-${slash[2]}-${slash[3]}`;
  const dot = trimmed.match(/^(\d{4})\.(\d{2})\.(\d{2})$/);
  if (dot) return `${dot[1]}-${dot[2]}-${dot[3]}`;
  return trimmed;
}

function validIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""));
}

function estimatedMaxKg(normalizedWeightKg, reps, percentage) {
  const pct = Number(percentage);
  if (pct > 0) return normalizedWeightKg / (pct / 100);
  return normalizedWeightKg * (1 + Number(reps) / 30);
}

function recomputePrs() {
  const ordered = [...state.lifts].sort((a, b) => `${a.date}-${a.createdAt}`.localeCompare(`${b.date}-${b.createdAt}`));
  const best = {};
  ordered.forEach((lift) => {
    const key = `${lift.exerciseId}:${lift.reps}`;
    const previous = best[key] ?? 0;
    lift.isPr = lift.normalizedWeightKg > previous;
    best[key] = Math.max(previous, lift.normalizedWeightKg);
  });
  state.lifts = ordered.sort((a, b) => `${b.date}-${b.createdAt}`.localeCompare(`${a.date}-${a.createdAt}`));
}

function isNewPr(lift) {
  const previousBest = state.lifts
    .filter((item) => item.exerciseId === lift.exerciseId && item.reps === lift.reps)
    .reduce((best, item) => Math.max(best, item.normalizedWeightKg), 0);
  return lift.normalizedWeightKg > previousBest;
}

function prNudge() {
  const prs = state.lifts.filter((lift) => lift.isPr);
  if (!prs.length) return "No PRs recorded yet. Pick a favorite lift and forge the first one.";

  const latestByExercise = new Map();
  prs.forEach((lift) => {
    const current = latestByExercise.get(lift.exerciseId);
    if (!current || lift.date > current.date) latestByExercise.set(lift.exerciseId, lift);
  });

  const oldest = [...latestByExercise.values()].sort((a, b) => a.date.localeCompare(b.date))[0];
  const days = Math.max(0, Math.floor((Date.now() - new Date(`${oldest.date}T00:00:00`).getTime()) / 86400000));
  const exercise = exerciseName(oldest.exerciseId);

  if (days === 0) return `Fresh work: you hit a ${exercise} PR today. Nice.`;
  if (days < 14) return `Your last ${exercise} PR was ${days} day${days === 1 ? "" : "s"} ago. Keep building.`;
  if (days < 60) return `Your last ${exercise} PR was ${days} days ago. Want to test it soon?`;
  const months = Math.max(2, Math.round(days / 30));
  return `Your last ${exercise} PR was about ${months} months ago. Is it time to forge a new one?`;
}

async function db() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("pr_tracker_video_storage", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("videos");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putVideo(liftId, file) {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("videos", "readwrite");
    tx.objectStore("videos").put(file, liftId);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteVideoBlob(liftId) {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("videos", "readwrite");
    tx.objectStore("videos").delete(liftId);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function getVideoUrl(liftId) {
  if (videoUrls[liftId]) return videoUrls[liftId];
  const lift = state.lifts.find((item) => item.id === liftId);
  if (lift?.video?.storageProvider === "supabase_storage" && supabaseClient) {
    const { data, error } = await supabaseClient.storage
      .from(lift.video.storageBucket)
      .createSignedUrl(lift.video.storageObjectKey, 60 * 15);
    if (!error && data?.signedUrl) {
      videoUrls[liftId] = data.signedUrl;
      return videoUrls[liftId];
    }
  }
  const database = await db();
  return new Promise((resolve) => {
    const tx = database.transaction("videos", "readonly");
    const request = tx.objectStore("videos").get(liftId);
    request.onsuccess = () => {
      if (!request.result) return resolve("");
      videoUrls[liftId] = URL.createObjectURL(request.result);
      resolve(videoUrls[liftId]);
    };
    request.onerror = () => resolve("");
  });
}

function shell(content) {
  const hasIncomingRequests = state.friends.some((friend) => friend.incoming);
  const nav = [
    ["dashboard", "Home"],
    ["add", "Add"],
    ["history", "History"],
    ["progress", "Progress"],
    ["workout", "Workout"],
    ["friends", "Friends"],
    ["profile", "Profile"]
  ];

  return `
    <div class="shell">
      <header class="app-header">
        <div class="brand">
          <div class="brand-mark">PR</div>
          <div>
            <div class="brand-title">PR Forge</div>
            <div class="brand-subtitle">${state.profile?.nickname || state.profile?.name || "Weightlifting"}</div>
          </div>
        </div>
      </header>
      <main class="main">${content}</main>
      <nav class="bottom-nav" aria-label="Main navigation">
        ${nav.map(([id, label]) => `
          <button class="${state.tab === id ? "active" : ""}" data-tab="${id}" aria-label="${label}">
            <span class="nav-icon">${navIcon(id)}</span>
            ${id === "friends" && hasIncomingRequests ? '<span class="nav-dot" aria-hidden="true"></span>' : ""}
            <span>${label}</span>
          </button>
        `).join("")}
      </nav>
    </div>
  `;
}

function navIcon(id) {
  const attrs = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  const icons = {
    dashboard: `<svg ${attrs}><path d="M3 10.5 12 3l9 7.5"></path><path d="M5 10v10h14V10"></path><path d="M9 20v-6h6v6"></path></svg>`,
    add: `<svg ${attrs}><path d="M12 5v14"></path><path d="M5 12h14"></path></svg>`,
    history: `<svg ${attrs}><path d="M8 6h13"></path><path d="M8 12h13"></path><path d="M8 18h13"></path><path d="M3 6h.01"></path><path d="M3 12h.01"></path><path d="M3 18h.01"></path></svg>`,
    progress: `<svg ${attrs}><path d="M3 17 9 11l4 4 8-8"></path><path d="M14 7h7v7"></path></svg>`,
    workout: `<svg ${attrs}><path d="M4 19h16"></path><path d="M6 19V9"></path><path d="M18 19V9"></path><path d="M3 9h4"></path><path d="M17 9h4"></path><path d="M7 12h10"></path></svg>`,
    friends: `<svg ${attrs}><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"></path><circle cx="9.5" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`,
    profile: `<svg ${attrs}><circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path></svg>`
  };
  return icons[id] || "";
}

function loginView() {
  return `
    <div class="login-wrap">
      <section class="panel login">
        <h1>PR Forge</h1>
        <p class="muted">Track records, attach lift videos, and follow friends' progress. No internal passwords are stored.</p>
        <div class="form">
          <button class="btn provider" data-signin="google">Continue with Google</button>
          <button class="btn provider" data-signin="facebook">Continue with Facebook</button>
          <button class="btn secondary" type="button" data-reset-local>Reset local app cache</button>
        </div>
      </section>
    </div>
  `;
}

function onboardingView() {
  return shell(`
    <div class="topbar">
      <div>
        <h1>Complete profile</h1>
        <div class="muted">Signed in as ${escapeHtml(state.session?.email || "unknown email")}. Bodyweight and country are required for the MVP.</div>
      </div>
    </div>
    ${profileForm(true)}
  `);
}

function profileForm(onboarding = false) {
  const p = state.profile;
  const currentUnit = userUnit();
  const currentPhoto = p.photoDataUrl || p.photo;
  return `
    <section class="panel">
      <div class="muted" style="margin-bottom:12px">Signed in as ${escapeHtml(state.session?.email || p.email || "unknown email")}</div>
      <form class="form" data-form="profile">
        <div class="profile-photo-row">
          <div class="avatar">${currentPhoto ? `<img src="${escapeHtml(currentPhoto)}" alt="Profile photo">` : escapeHtml((p.name || "P").slice(0, 1))}</div>
          <div class="field">
            <label for="photoFile">Profile photo</label>
            <input id="photoFile" name="photoFile" type="file" accept="image/*" capture="user">
            <small class="muted">Upload a photo or take a selfie on supported devices.</small>
          </div>
        </div>
        <div class="grid two">
          ${field("Name", "name", p.name, "text", true)}
          ${field("Surname", "surname", p.surname || "")}
          ${field("Nickname", "nickname", p.nickname)}
          <div class="field">
            <label for="sex">Sex</label>
            <select id="sex" name="sex">
              ${option("female", "Female", p.sex)}
              ${option("male", "Male", p.sex)}
              ${option("non_binary", "Non-binary", p.sex)}
              ${option("prefer_not_to_say", "Prefer not to say", p.sex)}
              ${option("self_describe", "Self describe", p.sex)}
            </select>
          </div>
          ${field("Self description", "sexSelfDescription", p.sexSelfDescription)}
          ${field("Birthday", "birthday", normalizeBirthday(p.birthday), "text", false, "yyyy/mm/dd")}
          ${field("Bodyweight", "bodyweight", p.bodyweight, "number", true)}
          <div class="field">
            <label for="unit">Unit</label>
            <select id="unit" name="unit">
              ${option("kg", "kg", currentUnit)}
              ${option("lb", "lb", currentUnit)}
            </select>
          </div>
          <div class="field">
            <label for="country">Country <span class="required">*</span></label>
            <select id="country" name="country" required>
              <option value="">Select country</option>
              ${COUNTRIES.map(([code, name]) => option(code, name, p.country)).join("")}
            </select>
          </div>
          ${field("Club", "club", p.club || "", "text", false, "Gym or weightlifting club")}
          <div class="field">
            <label for="searchEnabled">Find me in search</label>
            <select id="searchEnabled" name="searchEnabled">
              ${option("true", "Yes", String(p.searchEnabled !== false))}
              ${option("false", "No", String(p.searchEnabled !== false))}
            </select>
          </div>
          <div class="field">
            <label for="privacy">Default privacy</label>
            <select id="privacy" name="privacy">
              ${option("private", "Only me", p.privacy)}
              ${option("friends", "Friends only", p.privacy)}
              ${option("public", "Public", p.privacy)}
            </select>
          </div>
        </div>
        <div class="actions">
          <button class="btn" type="submit">${onboarding ? "Start tracking" : "Save profile"}</button>
          <button class="btn secondary" type="button" data-signout>Sign out</button>
        </div>
      </form>
    </section>
  `;
}

function field(label, name, value = "", type = "text", required = false, placeholder = "") {
  return `
    <div class="field">
      <label for="${name}">${label}${required ? ' <span class="required">*</span>' : ""}</label>
      <input id="${name}" name="${name}" type="${type}" value="${escapeHtml(value)}" placeholder="${placeholder}" ${required ? "required" : ""}>
    </div>
  `;
}

function dateField(label, name, isoValue = "", required = false) {
  return field(label, name, displayDate(isoValue), "text", required, "yyyy-mm-dd");
}

function option(value, label, selected) {
  return `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`;
}

function dashboardView() {
  const latestPrs = state.lifts.filter((lift) => lift.isPr).slice(0, 3);
  const incomingRequests = state.friends.filter((friend) => friend.incoming);

  return shell(`
    <div class="topbar">
      <div>
        <h1>Dashboard</h1>
        <div class="muted">What matters today.</div>
      </div>
    </div>
    ${incomingRequests.length ? `
      <section class="panel attention">
        <div>
          <h2>${incomingRequests.length} friend request${incomingRequests.length === 1 ? "" : "s"} waiting</h2>
          <p class="muted">Accept requests to unlock friends-only PRs.</p>
        </div>
        <button class="btn secondary" data-tab="friends">Review</button>
      </section>
    ` : ""}
    <div class="split" style="margin-top:${incomingRequests.length ? "16px" : "0"}">
      <section class="panel">
        <div class="section-head">
          <h2>Friends' latest PRs</h2>
          <button class="link-btn" data-tab="friends">See all</button>
        </div>
        ${feedList({ includeOwn: false, limit: 3, compact: true })}
      </section>
      <section class="panel">
        <h2>Your latest PRs</h2>
        ${latestPrs.length ? liftList(latestPrs) : empty("No PRs yet. Add your first lift.")}
      </section>
    </div>
    <section class="panel" style="margin-top:16px">
      <h2>PR nudge</h2>
      <p>${prNudge()}</p>
    </section>
  `);
}

function addLiftView() {
  return shell(`
    <div class="topbar">
      <div>
        <h1>Add lift</h1>
        <div class="muted">Log a lift, attach video, and the app will detect PRs.</div>
      </div>
    </div>
    <div class="split">
      <section class="panel">
        <form class="form" data-form="lift">
          <div class="grid two">
            <div class="field">
              <label for="exerciseId">Exercise <span class="required">*</span></label>
              <select id="exerciseId" name="exerciseId" required>
                ${state.exercises.map((exercise) => `<option value="${exercise.id}">${exercise.name}</option>`).join("")}
              </select>
            </div>
            ${dateField("Date", "date", new Date().toISOString().slice(0, 10), true)}
            ${field("Weight lifted", "weight", "", "number", true)}
            <div class="field">
              <label for="unit">Unit</label>
              <select id="unit" name="unit">
                ${option("kg", "kg", userUnit())}
                ${option("lb", "lb", userUnit())}
              </select>
            </div>
            ${field("Reps", "reps", "1", "number", true)}
            ${field("Percentage of max", "percentage", "", "number")}
            ${field("Location, gym, or club", "location", state.profile.club || "")}
            ${field("Bodyweight today", "bodyweight", state.profile.bodyweight, "number")}
          </div>
          <div class="field">
            <label for="strapsUsed">Were straps used?</label>
            <select id="strapsUsed" name="strapsUsed">
              ${option("no", "No", "no")}
              ${option("yes", "Yes", "no")}
            </select>
          </div>
          <div class="field">
            <label for="notes">Notes</label>
            <textarea id="notes" name="notes" placeholder="How did it feel?"></textarea>
          </div>
          <div class="grid two">
            <div class="field">
              <label for="visibility">Visibility</label>
              <select id="visibility" name="visibility">
                ${option("private", "Only me", state.profile.privacy)}
                ${option("friends", "Friends only", state.profile.privacy)}
                ${option("public", "Public", state.profile.privacy)}
              </select>
            </div>
            <div class="field">
              <label for="video">Video</label>
              <input id="video" name="video" type="file" accept="video/*">
            </div>
          </div>
          <button class="btn" type="submit">Save lift</button>
        </form>
      </section>
      <section class="panel">
        <h2>Custom exercise</h2>
        <form class="form" data-form="exercise">
          ${field("Exercise name", "name", "", "text", true)}
          ${field("Lift type", "liftType", "", "text", false, "olympic, squat, pull")}
          <div class="field">
            <label for="description">What kind of exercise is it? <span class="required">*</span></label>
            <textarea id="description" name="description" required></textarea>
          </div>
          <button class="btn secondary" type="submit">Add custom exercise</button>
        </form>
      </section>
    </div>
  `);
}

function historyView() {
  const filtered = filteredLifts();
  return shell(`
    <div class="topbar">
      <div>
        <h1>Lift history</h1>
        <div class="muted">Filter by exercise, date, reps, and PR status.</div>
      </div>
    </div>
    <section class="panel">
      <form class="grid three" data-form="filters">
        <div class="field">
          <label for="filterExercise">Exercise</label>
          <select id="filterExercise" name="exercise">
            <option value="">All exercises</option>
            ${state.exercises.map((exercise) => option(exercise.id, exercise.name, state.filters.exercise)).join("")}
          </select>
        </div>
        ${dateField("From", "from", state.filters.from)}
        ${dateField("To", "to", state.filters.to)}
        ${field("Reps", "reps", state.filters.reps, "number")}
        <div class="field">
          <label for="prOnly">PR only</label>
          <select id="prOnly" name="prOnly">
            ${option("false", "All lifts", String(state.filters.prOnly))}
            ${option("true", "PR only", String(state.filters.prOnly))}
          </select>
        </div>
        <div class="field">
          <label>&nbsp;</label>
          <button class="btn secondary" type="button" data-clear-filters>Clear filters</button>
        </div>
      </form>
    </section>
    <section class="panel" style="margin-top:16px">
      ${filtered.length ? liftList(filtered, true, true) : empty("No lifts match these filters.")}
    </section>
  `);
}

function progressView() {
  const selected = state.filters.exercise || state.exercises[0]?.id;
  const lifts = state.lifts.filter((lift) => lift.exerciseId === selected);
  const best = bestByReps(lifts);
  const prs = lifts.filter((lift) => lift.isPr);
  const latestPr = prs[0];
  const previousPr = prs[1];
  const diff = latestPr && previousPr ? latestPr.normalizedWeightKg - previousPr.normalizedWeightKg : 0;

  return shell(`
    <div class="topbar">
      <div>
        <h1>Progress</h1>
        <div class="muted">Best lifts and chart by exercise.</div>
      </div>
      <div class="field" style="max-width:280px">
        <label for="progressExercise">Exercise</label>
        <select id="progressExercise" data-progress-exercise>
          ${state.exercises.map((exercise) => option(exercise.id, exercise.name, selected)).join("")}
        </select>
      </div>
    </div>
    <section class="panel">
      <div class="field" style="max-width:320px">
        <label for="progressMode">Chart value</label>
        <select id="progressMode" data-progress-mode>
          ${option("actual", "Actual lifted weight", state.progressMode)}
          ${option("predicted", "Predicted 100% / estimated 1RM", state.progressMode)}
        </select>
      </div>
    </section>
    <div class="grid three">
      <section class="panel stat"><span class="muted">Current PR</span><strong>${latestPr ? displayWeight(latestPr.normalizedWeightKg, userUnit()) : "-"}</strong></section>
      <section class="panel stat"><span class="muted">Last PR date</span><strong>${latestPr ? displayDate(latestPr.date) : "-"}</strong></section>
      <section class="panel stat"><span class="muted">From previous PR</span><strong>${diff > 0 ? `+${displayWeight(diff, userUnit())}` : "-"}</strong></section>
    </div>
    <section class="panel" style="margin-top:16px">
      <h2>Best by reps</h2>
      <div class="grid three">
        ${[1, 3, 5].map((reps) => `<div class="card"><strong>${reps}RM</strong><div>${best[reps] ? displayWeight(best[reps].normalizedWeightKg, userUnit()) : "No data"}</div></div>`).join("")}
      </div>
    </section>
    <section class="panel" style="margin-top:16px">
      <h2>Progress chart</h2>
      ${lifts.length ? chart(lifts, state.progressMode) : empty("No entries for this exercise yet.")}
    </section>
  `);
}

function workoutDefaults() {
  const exerciseId = state.workout?.exerciseId || state.exercises[0]?.id || "";
  const unit = userUnit();
  const baseKg = bestWorkoutBaseKg(exerciseId);
  return {
    exerciseId,
    baseWeight: state.workout?.baseWeight || (baseKg ? round(weightInUnit(baseKg, unit)) : ""),
    unit,
    rounding: state.workout?.rounding || (unit === "kg" ? "2.5" : "5"),
    rounds: state.workout?.rounds?.length ? state.workout.rounds : [
      { id: `round_${Date.now()}_1`, percentage: 50, reps: "", notes: "" },
      { id: `round_${Date.now()}_2`, percentage: 60, reps: "", notes: "" },
      { id: `round_${Date.now()}_3`, percentage: 70, reps: "", notes: "" },
      { id: `round_${Date.now()}_4`, percentage: 80, reps: "", notes: "" }
    ]
  };
}

function bestWorkoutBaseKg(exerciseId) {
  const lifts = state.lifts.filter((lift) => lift.exerciseId === exerciseId);
  if (!lifts.length) return 0;
  return Math.max(...lifts.map((lift) => Number(lift.estimated1rmKg || lift.normalizedWeightKg || 0)));
}

function roundedWorkoutWeight(baseWeight, percentage, rounding) {
  const target = Number(baseWeight) * (Number(percentage) / 100);
  const step = Number(rounding) || 1;
  return Math.round(target / step) * step;
}

function formatWorkoutWeight(value, unit) {
  const rounded = Math.round(Number(value) * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded} ${unit}`;
}

function currentWorkoutFromDom() {
  const workout = workoutDefaults();
  const form = document.querySelector('[data-form="workout"]');
  if (form) {
    const data = Object.fromEntries(new FormData(form));
    workout.exerciseId = data.exerciseId || workout.exerciseId;
    workout.baseWeight = data.baseWeight || "";
    workout.rounding = data.rounding || workout.rounding;
  }
  workout.rounds = [...document.querySelectorAll("[data-workout-round]")].map((row) => ({
    id: row.dataset.workoutRound,
    percentage: row.querySelector('[name="percentage"]').value,
    reps: row.querySelector('[name="reps"]').value,
    notes: row.querySelector('[name="notes"]').value
  })).filter((roundItem) => roundItem.percentage);
  return workout;
}

function savedWorkoutActivity(workout) {
  const rounds = workout.rounds.map((roundItem) => {
    const target = roundedWorkoutWeight(workout.baseWeight, roundItem.percentage, workout.rounding);
    return {
      ...roundItem,
      targetWeight: formatWorkoutWeight(target, workout.unit)
    };
  });
  return {
    id: `workout_${Date.now()}`,
    type: "workout",
    userRef: state.profile.authIdentityRef,
    friend: state.profile?.nickname || state.profile?.name || "You",
    exerciseId: workout.exerciseId,
    exercise: exerciseName(workout.exerciseId),
    date: new Date().toISOString().slice(0, 10),
    baseWeightValue: workout.baseWeight,
    baseWeight: `${workout.baseWeight} ${workout.unit}`,
    weight: `Base ${workout.baseWeight} ${workout.unit}`,
    reps: rounds.length,
    roundingValue: workout.rounding,
    rounding: `${workout.rounding} ${workout.unit}`,
    roundsCount: rounds.length,
    rounds,
    note: rounds.map((roundItem) => `${roundItem.percentage}% -> ${roundItem.targetWeight}`).join(", ")
  };
}

function workoutFromSaved(savedWorkout) {
  return {
    exerciseId: savedWorkout.exerciseId,
    baseWeight: savedWorkout.baseWeightValue || parseFloat(savedWorkout.baseWeight) || "",
    unit: savedWorkout.unit || userUnit(),
    rounding: savedWorkout.roundingValue || parseFloat(savedWorkout.rounding) || (userUnit() === "kg" ? "2.5" : "5"),
    rounds: (savedWorkout.rounds || []).map((roundItem) => ({
      id: roundItem.id || `round_${Date.now()}_${Math.random()}`,
      percentage: roundItem.percentage,
      reps: roundItem.reps || "",
      notes: roundItem.notes || ""
    }))
  };
}

function workoutView() {
  state.workout = workoutDefaults();
  const workout = state.workout;
  const isEditingWorkout = Boolean(state.editingWorkoutId);
  const bestKg = bestWorkoutBaseKg(workout.exerciseId);
  const bestText = bestKg ? displayWeight(bestKg, workout.unit) : "No PR found yet";
  const roundingOptions = workout.unit === "kg" ? [["0.5", "0.5 kg"], ["1", "1 kg"], ["2.5", "2.5 kg"]] : [["1", "1 lb"], ["2.5", "2.5 lb"], ["5", "5 lb"]];

  return shell(`
    <div class="topbar">
      <div>
        <h1>Workout</h1>
        <div class="muted">Plan percentage rounds from your PR or a training max.</div>
      </div>
    </div>
    <section class="panel">
      <form class="form" data-form="workout">
        <div class="grid three">
          <div class="field">
            <label for="workoutExercise">Exercise</label>
            <select id="workoutExercise" name="exerciseId">
              ${state.exercises.map((exercise) => option(exercise.id, exercise.name, workout.exerciseId)).join("")}
            </select>
            <span class="hint">&nbsp;</span>
          </div>
          <div class="field">
            <label for="workoutBaseWeight">Base weight / training max</label>
            <input id="workoutBaseWeight" name="baseWeight" type="number" step="0.1" value="${escapeHtml(workout.baseWeight)}" placeholder="Enter max">
            <span class="hint">Best known max: ${bestText}</span>
          </div>
          <div class="field">
            <label for="workoutRounding">Round to nearest</label>
            <select id="workoutRounding" name="rounding">
              ${roundingOptions.map(([value, label]) => option(value, label, workout.rounding)).join("")}
            </select>
            <span class="hint">&nbsp;</span>
          </div>
        </div>
      </form>
    </section>
    <section class="panel" style="margin-top:16px">
      <div class="section-head">
        <h2>Rounds</h2>
        <div class="actions">
          <button class="btn" type="button" data-save-workout>${isEditingWorkout ? "Save changes" : "Save workout"}</button>
          ${isEditingWorkout ? '<button class="btn secondary" type="button" data-cancel-workout-edit>Cancel</button><button class="btn danger" type="button" data-delete-workout>Delete workout</button>' : ""}
          <button class="btn secondary" type="button" data-add-workout-round>+ Round</button>
        </div>
      </div>
      <div class="workout-rounds">
        ${workout.rounds.map((roundItem, index) => {
          const target = workout.baseWeight && roundItem.percentage ? roundedWorkoutWeight(workout.baseWeight, roundItem.percentage, workout.rounding) : 0;
          return `
            <div class="workout-round" data-workout-round="${roundItem.id}">
              <div class="round-number">${index + 1}</div>
              <div class="field">
                <label>Percentage</label>
                <input name="percentage" type="number" step="0.5" min="0" value="${escapeHtml(roundItem.percentage)}">
              </div>
              <div class="field">
                <label>Reps</label>
                <input name="reps" type="number" min="1" value="${escapeHtml(roundItem.reps)}" placeholder="Optional">
              </div>
              <div class="target-weight">
                <span class="muted">Target</span>
                <strong>${target ? formatWorkoutWeight(target, workout.unit) : "-"}</strong>
              </div>
              <div class="field">
                <label>Notes</label>
                <input name="notes" type="text" value="${escapeHtml(roundItem.notes)}" placeholder="Optional">
              </div>
              <button class="btn secondary icon-btn" type="button" data-remove-workout-round="${roundItem.id}" aria-label="Remove round">x</button>
            </div>
          `;
        }).join("")}
      </div>
    </section>
    <section class="panel" style="margin-top:16px">
      <h2>Saved workouts</h2>
      ${state.savedWorkouts.length ? `<div class="list">${state.savedWorkouts.slice(0, 3).map((workout) => `
        <div class="lift-row">
          <div>
            <div class="lift-title">${escapeHtml(workout.exercise)} <span class="badge blue">Workout</span></div>
            <div class="meta">${displayDate(workout.date)} &middot; ${escapeHtml(workout.baseWeight)} &middot; ${workout.roundsCount} round${workout.roundsCount === 1 ? "" : "s"}</div>
            <p>${escapeHtml(workout.note)}</p>
            <div class="actions">
              <button class="btn secondary" type="button" data-edit-workout="${workout.id}">Edit</button>
            </div>
          </div>
        </div>
      `).join("")}</div>` : empty("Saved workout plans will appear here.")}
    </section>
  `);
}

function friendsView() {
  const incomingRequests = state.friends.filter((friend) => friend.incoming);
  const sentRequests = state.friends.filter((friend) => !friend.accepted && !friend.incoming);
  const acceptedFriends = state.friends.filter((friend) => friend.accepted);
  return shell(`
    <div class="topbar">
      <div>
        <h1>Friends</h1>
        <div class="muted">Search, request, accept, and view friend PRs.</div>
      </div>
    </div>
    <div class="split">
      <section class="panel">
        <h2>Find friends</h2>
        <form class="form" data-form="friend">
          ${field("Name, nickname, or club", "name", "", "text", true, "Alex")}
          <button class="btn" type="submit">Find</button>
        </form>
        <div class="list" style="margin-top:12px">
          ${friendSearchResultsView()}
        </div>
      </section>
      <section class="panel">
        <h2>Requests</h2>
        <div class="list">
          ${incomingRequests.length ? incomingRequests.map(friendRow).join("") : empty("No incoming requests.")}
          ${sentRequests.length ? `<h3>Sent</h3>${sentRequests.map(friendRow).join("")}` : ""}
        </div>
      </section>
    </div>
    <section class="panel" style="margin-top:16px">
      <h2>Friends</h2>
      ${acceptedFriends.length ? `<div class="list">${acceptedFriends.map(friendRow).join("")}</div>` : empty("Accepted friends will appear here.")}
    </section>
    <section class="panel" style="margin-top:16px">
      <h2>Friends' PR feed</h2>
      ${feedList({ includeOwn: false })}
    </section>
  `);
}

function friendSearchRow(friend) {
  const alreadyKnown = state.friends.some((item) => item.profileId === friend.profileId);
  return `
    <div class="lift-row">
      <div>
        <div class="lift-title">${friend.name}${friend.nickname ? ` (${friend.nickname})` : ""}</div>
        <div class="meta">${[friend.club, friend.country].filter(Boolean).map(escapeHtml).join(" · ") || "Profile"}</div>
      </div>
      ${alreadyKnown ? '<span class="badge blue">Requested</span>' : `<button class="btn secondary" data-request-friend="${friend.profileId}">Add friend</button>`}
    </div>
  `;
}

function friendSearchResultsView() {
  if (state.friendResults.length) return state.friendResults.map(friendSearchRow).join("");
  if (state.friendSearchRan) return empty(`No users found for "${escapeHtml(state.friendSearchTerm)}".`);
  return empty("Search results will appear here.");
}

function friendRow(friend) {
  const status = friend.accepted ? "Accepted friend" : friend.incoming ? "Incoming request" : "Pending request";
  return `
    <div class="lift-row">
      <div>
        <div class="lift-title">${friend.name}${friend.nickname ? ` (${friend.nickname})` : ""}</div>
        <div class="meta">${status}</div>
      </div>
      ${friend.accepted ? '<span class="badge">Friends</span>' : friend.incoming ? `<button class="btn secondary" data-accept="${friend.ref}">Accept</button>` : '<span class="badge blue">Sent</span>'}
    </div>
  `;
}

function profileView() {
  return shell(`
    <div class="topbar">
      <div>
        <h1>Profile</h1>
        <div class="muted">OAuth-only account details and default privacy.</div>
      </div>
    </div>
    ${profileForm(false)}
  `);
}

function liftList(lifts, showVideo = true, editable = false) {
  return `<div class="list">${lifts.map((lift) => liftRow(lift, showVideo, editable)).join("")}</div>`;
}

function liftRow(lift, showVideo = true, editable = false) {
  if (editable && state.editingLiftId === lift.id) return liftEditRow(lift);
  const est = lift.reps > 1 ? `Estimated 1RM ${displayWeight(lift.estimated1rmKg, userUnit())}` : "";
  return `
    <div class="lift-row">
      <div>
        <div class="lift-title">
          ${exerciseName(lift.exerciseId)}
          ${lift.isPr ? '<span class="badge">PR</span>' : ""}
          <span class="badge blue">${lift.visibility}</span>
        </div>
        <div class="meta">
          <span>${displayWeight(lift.normalizedWeightKg, userUnit())}</span>
          <span>${lift.reps} rep${lift.reps === 1 ? "" : "s"}</span>
          <span>${displayDate(lift.date)}</span>
          ${est ? `<span>${est}</span>` : ""}
          ${lift.location ? `<span>${escapeHtml(lift.location)}</span>` : ""}
          <span>Straps: ${lift.strapsUsed ? "yes" : "no"}</span>
        </div>
        ${lift.notes ? `<p>${escapeHtml(lift.notes)}</p>` : ""}
        ${editable ? `
          <div class="actions">
            <button class="btn secondary" data-edit-lift="${lift.id}">Edit</button>
            ${lift.video ? `<button class="btn danger" data-delete-video="${lift.id}">Delete video</button>` : ""}
          </div>
        ` : ""}
      </div>
      ${showVideo && lift.video ? `<video class="video" controls data-video="${lift.id}"></video>` : ""}
    </div>
  `;
}

function liftEditRow(lift) {
  return `
    <div class="lift-row">
      <div>
        <form class="form" data-form="edit-lift" data-lift-id="${lift.id}">
          <div class="grid two">
            <div class="field">
              <label for="editExercise-${lift.id}">Exercise</label>
              <select id="editExercise-${lift.id}" name="exerciseId">
                ${state.exercises.map((exercise) => option(exercise.id, exercise.name, lift.exerciseId)).join("")}
              </select>
            </div>
            ${dateField("Date", "date", lift.date, true)}
            ${field("Weight lifted", "weight", lift.weight, "number", true)}
            <div class="field">
              <label for="editUnit-${lift.id}">Unit</label>
              <select id="editUnit-${lift.id}" name="unit">
                ${option("kg", "kg", lift.unit)}
                ${option("lb", "lb", lift.unit)}
              </select>
            </div>
            ${field("Reps", "reps", lift.reps, "number", true)}
            ${field("Percentage of max", "percentage", lift.percentage, "number")}
            ${field("Location, gym, or club", "location", lift.location)}
            ${field("Bodyweight today", "bodyweight", lift.bodyweight, "number")}
          </div>
          <div class="field">
            <label for="editStraps-${lift.id}">Were straps used?</label>
            <select id="editStraps-${lift.id}" name="strapsUsed">
              ${option("no", "No", lift.strapsUsed ? "yes" : "no")}
              ${option("yes", "Yes", lift.strapsUsed ? "yes" : "no")}
            </select>
          </div>
          <div class="field">
            <label for="editNotes-${lift.id}">Notes</label>
            <textarea id="editNotes-${lift.id}" name="notes">${escapeHtml(lift.notes)}</textarea>
          </div>
          <div class="field">
            <label for="editVisibility-${lift.id}">Visibility</label>
            <select id="editVisibility-${lift.id}" name="visibility">
              ${option("private", "Only me", lift.visibility)}
              ${option("friends", "Friends only", lift.visibility)}
              ${option("public", "Public", lift.visibility)}
            </select>
          </div>
          <div class="actions">
            <button class="btn" type="submit">Save changes</button>
            <button class="btn secondary" type="button" data-cancel-edit>Cancel</button>
            <button class="btn danger" type="button" data-delete-lift="${lift.id}">Delete lift</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function feedList(options = {}) {
  const includeOwn = options.includeOwn !== false;
  const limit = options.limit || 10;
  const compact = Boolean(options.compact);
  const visibleFriends = state.friends.filter((friend) => friend.accepted);
  const realFeed = state.lifts
    .filter((lift) => lift.isPr && (includeOwn || lift.userRef !== state.session?.authRef))
    .map((lift) => ({
      id: lift.id,
      type: "pr",
      real: true,
      friend: state.profile?.nickname || state.profile?.name || "You",
      exercise: exerciseName(lift.exerciseId),
      weight: displayWeight(lift.normalizedWeightKg, userUnit()),
      reps: lift.reps,
      date: lift.date,
      note: lift.notes || "New PR logged."
    }));
  const ownWorkoutFeed = includeOwn ? state.savedWorkouts.map((workout) => ({ ...workout, real: false })) : [];
  const samplePrFeed = includeOwn ? SAMPLE_FEED.map((item) => ({ ...item, type: "pr", real: false, weight: `${item.weight} ${item.unit}` })) : [];
  const sampleWorkoutFeed = !includeOwn && visibleFriends.length ? SAMPLE_WORKOUT_FEED.map((item) => ({ ...item, real: false })) : [];
  const feedItems = [...realFeed, ...ownWorkoutFeed, ...sampleWorkoutFeed, ...(realFeed.length || ownWorkoutFeed.length || sampleWorkoutFeed.length ? [] : samplePrFeed)]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, limit);
  if (!visibleFriends.length && !realFeed.length && !ownWorkoutFeed.length) return empty(includeOwn ? "Add a friend, save a workout, or log a PR to see activity here." : "Accepted friends' activity will appear here.");
  if (!feedItems.length) return empty("Accepted friends' activity will appear here.");
  return `<div class="list">${feedItems.map((item) => {
    const likes = item.real ? (state.likeCounts[item.id] || 0) : (state.likes[item.id] ? 1 : 0);
    const comments = state.comments[item.id] ?? [];
    const isWorkout = item.type === "workout";
    const title = isWorkout
      ? `${item.friend} planned ${item.exercise} workout <span class="badge blue">Workout</span>`
      : `${item.friend} hit ${item.exercise} <span class="badge">PR</span>`;
    const meta = isWorkout
      ? `${displayDate(item.date)} &middot; Base ${escapeHtml(item.baseWeight)} &middot; ${item.roundsCount} round${item.roundsCount === 1 ? "" : "s"}`
      : `${item.weight} &middot; ${item.reps} rep${item.reps === 1 ? "" : "s"} &middot; ${displayDate(item.date)}`;
    return `
      <div class="lift-row">
        <div>
          <div class="lift-title">${title}</div>
          <div class="meta">${item.weight} · ${item.reps} rep${item.reps === 1 ? "" : "s"} · ${displayDate(item.date)}</div>
          ${compact ? "" : `<p>${item.note}</p>`}
          <div class="meta">${likes} like${likes === 1 ? "" : "s"} · ${comments.length} comment${comments.length === 1 ? "" : "s"}</div>
          ${compact ? "" : comments.map((comment) => {
            const body = typeof comment === "string" ? comment : comment.body;
            const author = typeof comment === "string" ? (state.profile.nickname || state.profile.name) : comment.author;
            return `<p><strong>${escapeHtml(author)}:</strong> ${escapeHtml(body)}</p>`;
          }).join("")}
          ${compact ? "" : `<form class="comment-form" data-form="comment" data-feed-id="${item.id}">
            <input name="comment" placeholder="Write a comment" aria-label="Write a comment" required>
            <button class="btn secondary" type="submit">Post</button>
          </form>`}
        </div>
        <div class="actions">
          ${compact ? "" : `
          <button class="btn secondary" data-like="${item.id}">${state.likes[item.id] ? "Liked" : "Like"}</button>
          `}
        </div>
      </div>
    `;
  }).join("")}</div>`;
}

function filteredLifts() {
  return state.lifts.filter((lift) => {
    if (state.filters.exercise && lift.exerciseId !== state.filters.exercise) return false;
    if (state.filters.prOnly && !lift.isPr) return false;
    if (state.filters.reps && lift.reps !== Number(state.filters.reps)) return false;
    if (state.filters.from && lift.date < state.filters.from) return false;
    if (state.filters.to && lift.date > state.filters.to) return false;
    return true;
  });
}

function bestByReps(lifts) {
  return lifts.reduce((best, lift) => {
    if (!best[lift.reps] || lift.normalizedWeightKg > best[lift.reps].normalizedWeightKg) {
      best[lift.reps] = lift;
    }
    return best;
  }, {});
}

function favoriteExercise() {
  const counts = state.lifts.reduce((map, lift) => {
    map[lift.exerciseId] = (map[lift.exerciseId] ?? 0) + 1;
    return map;
  }, {});
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top ? { name: exerciseName(top[0]), count: top[1] } : null;
}

function chart(lifts, mode = "actual") {
  const ordered = [...lifts].sort((a, b) => a.date.localeCompare(b.date));
  const values = ordered.map((lift) => chartLiftValue(lift, mode));
  const max = Math.max(...values);
  const min = Math.min(...values);
  const width = 760;
  const height = 320;
  const pad = 92;
  const bottomPad = 76;
  const topPad = 52;
  const plotBottom = height - bottomPad;
  const mid = (min + max) / 2;
  const valueToY = (value) => plotBottom - ((value - min) / Math.max(max - min, 1)) * (plotBottom - topPad);
  const points = ordered.map((lift, index) => {
    const value = chartLiftValue(lift, mode);
    const x = pad + (index / Math.max(ordered.length - 1, 1)) * (width - pad * 2);
    const y = valueToY(value);
    return { x, y, lift, value };
  });
  const grid = [
    { value: max, y: valueToY(max), label: displayWeight(max, userUnit()) },
    { value: mid, y: valueToY(mid), label: displayWeight(mid, userUnit()) },
    { value: min, y: valueToY(min), label: displayWeight(min, userUnit()) }
  ];
  const d = points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
  return `
    <svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Progress chart">
      <rect x="0" y="0" width="${width}" height="${height}" fill="#fbfcfd"></rect>
      ${grid.map((tick) => `<line x1="${pad}" y1="${tick.y}" x2="${width - pad}" y2="${tick.y}" stroke="#e8edf3" stroke-width="1"></line>`).join("")}
      <line x1="${pad}" y1="${plotBottom}" x2="${width - pad}" y2="${plotBottom}" stroke="#dbe2ea" stroke-width="1.5"></line>
      <line x1="${pad}" y1="${topPad}" x2="${pad}" y2="${plotBottom}" stroke="#dbe2ea" stroke-width="1.5"></line>
      <path d="${d}" fill="none" stroke="#0d766e" stroke-width="4"></path>
      ${points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="5" fill="#ad3e32"><title>${displayDate(point.lift.date)}: ${displayWeight(point.value, userUnit())}</title></circle>`).join("")}
      ${points.map((point, index) => {
        const isFirst = index === 0;
        const isLast = index === points.length - 1;
        const anchor = isFirst ? "start" : isLast ? "end" : "middle";
        const x = point.x + (isFirst ? 6 : isLast ? -6 : 0);
        return `<text x="${x}" y="${height - 28}" text-anchor="${anchor}" fill="#657286" font-size="13">${formatChartDate(point.lift.date)}</text>`;
      }).join("")}
      ${grid.map((tick) => `<text x="${pad - 18}" y="${tick.y + 5}" text-anchor="end" fill="#657286" font-size="13">${tick.label}</text>`).join("")}
    </svg>
  `;
}

function chartLiftValue(lift, mode) {
  return mode === "predicted" ? Number(lift.estimated1rmKg || lift.normalizedWeightKg) : Number(lift.normalizedWeightKg);
}

function formatChartDate(date) {
  const parts = String(date).split("-");
  if (parts.length !== 3) return escapeHtml(date);
  return `${parts[1]}-${parts[2]}`;
}

function empty(message) {
  return `<div class="empty">${message}</div>`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function readFileDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function hydrateVideos() {
  const videos = [...document.querySelectorAll("video[data-video]")];
  await Promise.all(videos.map(async (video) => {
    video.src = await getVideoUrl(video.dataset.video);
  }));
}

function render() {
  if (!state.authReady && supabaseClient) {
    app.innerHTML = `
      <div class="login-wrap">
        <section class="panel login">
          <h1>PR Forge</h1>
          <p class="muted">Checking session...</p>
        </section>
      </div>
    `;
    return;
  }
  if (!state.session) {
    app.innerHTML = loginView();
  } else if (!isProfileComplete()) {
    app.innerHTML = onboardingView();
  } else if (state.tab === "dashboard") {
    app.innerHTML = dashboardView();
  } else if (state.tab === "add") {
    app.innerHTML = addLiftView();
  } else if (state.tab === "history") {
    app.innerHTML = historyView();
  } else if (state.tab === "progress") {
    app.innerHTML = progressView();
  } else if (state.tab === "workout") {
    app.innerHTML = workoutView();
  } else if (state.tab === "friends") {
    app.innerHTML = friendsView();
  } else {
    app.innerHTML = profileView();
  }
  bind();
  hydrateVideos();
}

function bind() {
  document.querySelectorAll("[data-signin]").forEach((button) => {
    button.addEventListener("click", () => signIn(button.dataset.signin));
  });
  document.querySelectorAll("[data-signout]").forEach((button) => {
    button.addEventListener("click", signOut);
  });
  document.querySelector("[data-reset-local]")?.addEventListener("click", async () => {
    clearSupabaseLocalCache();
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
    toast("Local app cache reset. Refreshing...");
    setTimeout(() => window.location.reload(), 700);
  });
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => setTab(button.dataset.tab));
  });

  document.querySelector('[data-form="profile"]')?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    data.birthday = normalizeBirthday(data.birthday);
    if (!validBirthday(data.birthday)) {
      toast("Birthday must use yyyy/mm/dd");
      return;
    }
    delete data.photoFile;
    state.profile = {
      ...state.profile,
      ...data,
      unit: data.unit,
      preferredUnit: data.unit,
      bodyweightUnit: data.unit
    };
    const file = form.photoFile.files[0];
    if (file) {
      state.profile.photoDataUrl = await readFileDataUrl(file);
      state.profile.photo = "";
    }
    if (supabaseClient && state.session?.authRef && !state.session.authRef.includes(":")) {
      const { error } = await supabaseClient.from("profiles").upsert({
        id: state.session.authRef,
        email: state.session.email || state.profile.email || null,
        name: state.profile.name,
        surname: state.profile.surname || null,
        nickname: state.profile.nickname || null,
        profile_photo_url: state.profile.photoDataUrl || state.profile.photo || null,
        sex: state.profile.sex,
        sex_self_description: state.profile.sexSelfDescription || null,
        birthday: state.profile.birthday ? state.profile.birthday.replaceAll("/", "-") : null,
        bodyweight: Number(state.profile.bodyweight),
        preferred_unit: state.profile.unit,
        country: state.profile.country,
        club: state.profile.club || null,
        search_enabled: state.profile.searchEnabled === "true" || state.profile.searchEnabled === true,
        privacy_setting: state.profile.privacy
      });
      if (error) {
        toast(error.message);
        return;
      }
    }
    save();
    state.tab = "dashboard";
    toast("Profile saved");
    render();
  });

  document.querySelector('[data-form="exercise"]')?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    let exercise = {
      id: `${slug(data.name)}_${Date.now()}`,
      name: data.name,
      liftType: data.liftType,
      description: data.description,
      global: false,
      ownerUserRef: state.profile.authIdentityRef
    };
    if (supabaseClient && state.session?.authRef && !state.session.authRef.includes(":")) {
      const { data: savedExercise, error } = await supabaseClient
        .from("exercises")
        .insert({
          name: data.name,
          slug: `${slug(data.name)}_${Date.now()}`,
          lift_type: data.liftType || null,
          description: data.description,
          is_global: false,
          owner_user_id: state.session.authRef
        })
        .select("*")
        .single();
      if (error) {
        toast(error.message);
        return;
      }
      exercise = fromSupabaseExercise(savedExercise);
    }
    state.exercises.push(exercise);
    save();
    toast("Custom exercise added");
    render();
  });

  document.querySelector('[data-form="lift"]')?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    data.date = parseDateInput(data.date);
    if (!validIsoDate(data.date)) {
      toast("Date must use yyyy-mm-dd");
      return;
    }
    const file = form.video.files[0];
    const normalizedWeightKg = kg(Number(data.weight), data.unit);
    const lift = {
      id: `lift_${Date.now()}`,
      userRef: state.profile.authIdentityRef,
      exerciseId: data.exerciseId,
      date: data.date,
      weight: Number(data.weight),
      unit: data.unit,
      normalizedWeightKg,
      reps: Number(data.reps),
      percentage: data.percentage ? Number(data.percentage) : "",
      estimated1rmKg: estimatedMaxKg(normalizedWeightKg, Number(data.reps), data.percentage),
      notes: data.notes,
      location: data.location,
      bodyweight: data.bodyweight ? Number(data.bodyweight) : "",
      bodyweightUnit: userUnit(),
      strapsUsed: data.strapsUsed === "yes",
      visibility: data.visibility,
      isPr: false,
      video: file ? {
        storageProvider: "browser_indexeddb",
        storageBucket: "local-mvp-video-storage",
        storageObjectKey: `videos/${state.profile.authIdentityRef}/${Date.now()}-${file.name}`,
        name: file.name,
        mimeType: file.type,
        size: file.size
      } : null,
      createdAt: new Date().toISOString()
    };
    lift.isPr = isNewPr(lift);
    try {
      let savedLift = lift;
      if (supabaseClient && state.session?.authRef && !state.session.authRef.includes(":")) {
        savedLift = await saveSupabaseLift(lift, file);
      } else if (file) {
        await putVideo(lift.id, file);
      }
      state.lifts.unshift(savedLift);
      recomputePrs();
      save();
      toast(savedLift.isPr ? "Lift saved. New PR." : "Lift saved");
      state.tab = "history";
      render();
    } catch (error) {
      toast(error.message || "Could not save lift");
    }
  });

  document.querySelector('[data-form="filters"]')?.addEventListener("input", (event) => {
    const data = Object.fromEntries(new FormData(event.currentTarget));
    data.from = parseDateInput(data.from);
    data.to = parseDateInput(data.to);
    state.filters = { ...data, prOnly: data.prOnly === "true" };
    render();
  });

  document.querySelector("[data-clear-filters]")?.addEventListener("click", () => {
    state.filters = { exercise: "", prOnly: false, reps: "", from: "", to: "" };
    render();
  });

  document.querySelector("[data-progress-exercise]")?.addEventListener("change", (event) => {
    state.filters.exercise = event.target.value;
    render();
  });
  document.querySelector("[data-progress-mode]")?.addEventListener("change", (event) => {
    state.progressMode = event.target.value;
    render();
  });

  document.querySelector('[data-form="workout"]')?.addEventListener("change", (event) => {
    const previousExercise = state.workout?.exerciseId;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const next = {
      ...workoutDefaults(),
      ...data,
      rounds: state.workout?.rounds || []
    };
    if (data.exerciseId !== previousExercise) {
      const bestKg = bestWorkoutBaseKg(data.exerciseId);
      next.baseWeight = bestKg ? round(weightInUnit(bestKg, userUnit())) : "";
    }
    state.workout = next;
    save();
    render();
  });

  document.querySelector("[data-add-workout-round]")?.addEventListener("click", () => {
    state.workout = workoutDefaults();
    state.workout.rounds = [
      ...state.workout.rounds,
      { id: `round_${Date.now()}`, percentage: "", reps: "", notes: "" }
    ];
    save();
    render();
  });

  document.querySelector("[data-save-workout]")?.addEventListener("click", () => {
    const workout = currentWorkoutFromDom();
    if (!workout.exerciseId || !workout.baseWeight || !workout.rounds.length) {
      toast("Choose exercise, base weight, and at least one round.");
      return;
    }
    state.workout = workout;
    const savedWorkout = savedWorkoutActivity(workout);
    if (state.editingWorkoutId) {
      savedWorkout.id = state.editingWorkoutId;
      state.savedWorkouts = state.savedWorkouts.map((item) => item.id === state.editingWorkoutId ? savedWorkout : item);
      state.editingWorkoutId = "";
      toast("Workout updated");
    } else {
      state.savedWorkouts = [savedWorkout, ...state.savedWorkouts].slice(0, 20);
      toast("Workout saved");
    }
    save();
    render();
  });

  document.querySelector("[data-cancel-workout-edit]")?.addEventListener("click", () => {
    state.editingWorkoutId = "";
    state.workout = null;
    save();
    render();
  });

  document.querySelector("[data-delete-workout]")?.addEventListener("click", () => {
    if (!state.editingWorkoutId) return;
    state.savedWorkouts = state.savedWorkouts.filter((item) => item.id !== state.editingWorkoutId);
    state.editingWorkoutId = "";
    state.workout = null;
    save();
    toast("Workout deleted");
    render();
  });

  document.querySelectorAll("[data-edit-workout]").forEach((button) => {
    button.addEventListener("click", () => {
      const savedWorkout = state.savedWorkouts.find((item) => item.id === button.dataset.editWorkout);
      if (!savedWorkout) return;
      state.editingWorkoutId = savedWorkout.id;
      state.workout = workoutFromSaved(savedWorkout);
      render();
    });
  });

  document.querySelectorAll("[data-remove-workout-round]").forEach((button) => {
    button.addEventListener("click", () => {
      state.workout = workoutDefaults();
      state.workout.rounds = state.workout.rounds.filter((roundItem) => roundItem.id !== button.dataset.removeWorkoutRound);
      save();
      render();
    });
  });

  document.querySelectorAll("[data-workout-round]").forEach((row) => {
    row.addEventListener("change", () => {
      state.workout = workoutDefaults();
      state.workout.rounds = state.workout.rounds.map((roundItem) => {
        if (roundItem.id !== row.dataset.workoutRound) return roundItem;
        return {
          ...roundItem,
          percentage: row.querySelector('[name="percentage"]').value,
          reps: row.querySelector('[name="reps"]').value,
          notes: row.querySelector('[name="notes"]').value
        };
      });
      save();
      render();
    });
  });

  document.querySelectorAll("[data-edit-lift]").forEach((button) => {
    button.addEventListener("click", () => {
      state.editingLiftId = button.dataset.editLift;
      render();
    });
  });

  document.querySelector("[data-cancel-edit]")?.addEventListener("click", () => {
    state.editingLiftId = "";
    render();
  });

  document.querySelector('[data-form="edit-lift"]')?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const id = form.dataset.liftId;
    const existing = state.lifts.find((lift) => lift.id === id);
    if (!existing) return;
    const data = Object.fromEntries(new FormData(form));
    data.date = parseDateInput(data.date);
    if (!validIsoDate(data.date)) {
      toast("Date must use yyyy-mm-dd");
      return;
    }
    const normalizedWeightKg = kg(Number(data.weight), data.unit);
    const updatedLift = {
      ...existing,
      exerciseId: data.exerciseId,
      date: data.date,
      weight: Number(data.weight),
      unit: data.unit,
      normalizedWeightKg,
      reps: Number(data.reps),
      percentage: data.percentage ? Number(data.percentage) : "",
      estimated1rmKg: estimatedMaxKg(normalizedWeightKg, Number(data.reps), data.percentage),
      notes: data.notes,
      location: data.location,
      bodyweight: data.bodyweight ? Number(data.bodyweight) : "",
      bodyweightUnit: userUnit(),
      strapsUsed: data.strapsUsed === "yes",
      visibility: data.visibility
    };
    state.lifts = state.lifts.map((lift) => lift.id === id ? updatedLift : lift);
    recomputePrs();
    try {
      await updateSupabaseLift(state.lifts.find((lift) => lift.id === id));
      await syncSupabasePrFlags();
      state.editingLiftId = "";
      save();
      toast("Lift updated");
      render();
    } catch (error) {
      toast(error.message || "Could not update lift");
    }
  });

  document.querySelector('[data-form="friend"]')?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const query = data.name.trim().toLowerCase();
    state.friendSearchTerm = data.name.trim();
    state.friendSearchRan = true;
    if (supabaseClient && state.session?.authRef && !state.session.authRef.includes(":")) {
      const { data: profiles, error } = await supabaseClient
        .from("profiles")
        .select("id,name,surname,nickname,club,country,profile_photo_url")
        .eq("search_enabled", true)
        .neq("id", state.session.authRef)
        .or(`name.ilike.%${query}%,surname.ilike.%${query}%,nickname.ilike.%${query}%,club.ilike.%${query}%,country.ilike.%${query}%`)
        .limit(12);
      if (error) {
        toast(error.message);
        return;
      }
      state.friendResults = (profiles || []).map((profile) => ({
        ref: profile.id,
        profileId: profile.id,
        name: [profile.name, profile.surname].filter(Boolean).join(" ") || "User",
        nickname: profile.nickname || "",
        club: profile.club || "",
        country: profile.country || "",
        accepted: false
      }));
    } else {
      state.friendResults = SAMPLE_FRIENDS
        .filter((friend) => [friend.name, friend.nickname].filter(Boolean).some((value) => value.toLowerCase().includes(query)))
        .map((friend) => ({ ...friend, profileId: friend.ref, club: friend.ref.includes("sofia") ? "Demo WL Club" : "Demo Gym", country: "LT" }));
    }
    save();
    toast("Search complete");
    render();
  });

  document.querySelectorAll("[data-request-friend]").forEach((button) => {
    button.addEventListener("click", async () => {
      const friend = state.friendResults.find((item) => item.profileId === button.dataset.requestFriend);
      if (!friend) return;
      if (supabaseClient && state.session?.authRef && !state.session.authRef.includes(":")) {
        const { error } = await supabaseClient.from("friendships").insert({
          requester_id: state.session.authRef,
          recipient_id: friend.profileId,
          status: "pending"
        });
        if (error) {
          toast(error.message);
          return;
        }
        await loadSupabaseFriends();
      } else {
        state.friends.push({
          ref: friend.ref,
          profileId: friend.profileId,
          name: friend.name,
          nickname: friend.nickname || "",
          accepted: false
        });
      }
      save();
      toast("Friend request sent");
      render();
    });
  });

  document.querySelectorAll("[data-accept]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (supabaseClient && state.session?.authRef && !state.session.authRef.includes(":")) {
        const { error } = await supabaseClient
          .from("friendships")
          .update({ status: "accepted" })
          .eq("id", button.dataset.accept);
        if (error) {
          toast(error.message);
          return;
        }
        await loadSupabaseFriends();
      } else {
        state.friends = state.friends.map((friend) => friend.ref === button.dataset.accept ? { ...friend, accepted: true } : friend);
      }
      save();
      toast("Friend request accepted");
      render();
    });
  });

  document.querySelectorAll("[data-like]").forEach((button) => {
    button.addEventListener("click", async () => {
      const liftId = button.dataset.like;
      if (supabaseClient && state.session?.authRef && !state.session.authRef.includes(":") && state.lifts.some((lift) => lift.id === liftId)) {
        if (state.likes[liftId]) {
          const { error } = await supabaseClient
            .from("likes")
            .delete()
            .eq("lift_entry_id", liftId)
            .eq("user_id", state.session.authRef);
          if (error) {
            toast(error.message);
            return;
          }
          state.likes[liftId] = false;
          state.likeCounts[liftId] = Math.max((state.likeCounts[liftId] || 1) - 1, 0);
        } else {
          const { error } = await supabaseClient
            .from("likes")
            .insert({ lift_entry_id: liftId, user_id: state.session.authRef });
          if (error) {
            toast(error.message);
            return;
          }
          state.likes[liftId] = true;
          state.likeCounts[liftId] = (state.likeCounts[liftId] || 0) + 1;
        }
      } else {
        state.likes[liftId] = !state.likes[liftId];
      }
      save();
      render();
    });
  });

  document.querySelectorAll('[data-form="comment"]').forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      const text = data.comment.trim();
      if (!text) return;
      const liftId = form.dataset.feedId;
      if (supabaseClient && state.session?.authRef && !state.session.authRef.includes(":") && state.lifts.some((lift) => lift.id === liftId)) {
        const { data: savedComment, error } = await supabaseClient
          .from("comments")
          .insert({
            lift_entry_id: liftId,
            user_id: state.session.authRef,
            body: text
          })
          .select("id,lift_entry_id,user_id,body,created_at")
          .single();
        if (error) {
          toast(error.message);
          return;
        }
        state.comments[liftId] = [
          ...(state.comments[liftId] ?? []),
          {
            id: savedComment.id,
            body: savedComment.body,
            author: state.profile.nickname || state.profile.name || "You"
          }
        ];
      } else {
        state.comments[liftId] = [...(state.comments[liftId] ?? []), text];
      }
      save();
      render();
    });
  });

  document.querySelectorAll("[data-delete-lift]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.deleteLift;
      if (supabaseClient && state.session?.authRef && !state.session.authRef.includes(":")) {
        const lift = state.lifts.find((item) => item.id === id);
        if (lift?.video?.storageProvider === "supabase_storage") {
          await supabaseClient.storage.from(lift.video.storageBucket).remove([lift.video.storageObjectKey]);
        }
        const { error } = await supabaseClient.from("lift_entries").delete().eq("id", id);
        if (error) {
          toast(error.message);
          return;
        }
      }
      state.lifts = state.lifts.filter((lift) => lift.id !== id);
      await deleteVideoBlob(id);
      recomputePrs();
      save();
      toast("Lift deleted");
      render();
    });
  });

  document.querySelectorAll("[data-delete-video]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.deleteVideo;
      const lift = state.lifts.find((item) => item.id === id);
      if (supabaseClient && lift?.video?.storageProvider === "supabase_storage") {
        const removeResult = await supabaseClient.storage.from(lift.video.storageBucket).remove([lift.video.storageObjectKey]);
        if (removeResult.error) {
          toast(removeResult.error.message);
          return;
        }
        const { error } = await supabaseClient.from("videos").delete().eq("lift_entry_id", id);
        if (error) {
          toast(error.message);
          return;
        }
      }
      state.lifts = state.lifts.map((lift) => lift.id === id ? { ...lift, video: null } : lift);
      await deleteVideoBlob(id);
      save();
      toast("Video deleted");
      render();
    });
  });

}

async function boot() {
  if (!supabaseClient) {
    state.authReady = true;
    recomputePrs();
    render();
    return;
  }

  const { data } = await supabaseClient.auth.getSession();
  await syncSupabaseSession(data.session);
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    syncSupabaseSession(session);
  });
  recomputePrs();
}

boot().catch((error) => {
  state.authReady = true;
  app.innerHTML = `
    <div class="login-wrap">
      <section class="panel login">
        <h1>PR Forge</h1>
        <p class="muted">Could not start the app.</p>
        <pre class="empty">${escapeHtml(error.message || String(error))}</pre>
        <button class="btn secondary" type="button" onclick="location.reload()">Reload</button>
      </section>
    </div>
  `;
});
