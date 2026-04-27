"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { displayDate, displayWeight, estimatedMaxKg, kg } from "@/lib/format";

const NAV = ["Home", "Add", "History", "Progress", "Workout", "Friends", "Profile"];

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

const EMPTY_PROFILE = {
  name: "",
  surname: "",
  nickname: "",
  profile_photo_url: "",
  sex: "prefer_not_to_say",
  birthday: "",
  bodyweight: "",
  preferred_unit: "kg",
  country: "",
  club: "",
  search_enabled: true,
  privacy_setting: "friends"
};

export default function HomePage() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [lifts, setLifts] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [friends, setFriends] = useState([]);
  const [friendResults, setFriendResults] = useState([]);
  const [friendSearchRan, setFriendSearchRan] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("Home");
  const [editingLiftId, setEditingLiftId] = useState("");
  const [progressExerciseId, setProgressExerciseId] = useState("");
  const [progressMode, setProgressMode] = useState("actual");
  const [editingWorkoutId, setEditingWorkoutId] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const { data } = await supabase.auth.getSession();
        if (!cancelled) setSession(data.session);
      } catch (error) {
        if (!cancelled) {
          setStatus(error.message || "Could not check session.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setStatus("");
      setLoading(false);
      if (!nextSession) {
        setProfile(null);
        setExercises([]);
        setLifts([]);
        setWorkouts([]);
        setFriends([]);
        setFriendResults([]);
      }
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSessionData() {
      if (!session?.user) return;
      try {
        await loadProfile(session, cancelled);
        await loadAppData(session, cancelled);
      } catch (error) {
        if (!cancelled) setStatus(error.message || "Could not load app data.");
      }
    }

    loadSessionData();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  async function loadProfile(currentSession = session, cancelled = false) {
    if (!currentSession?.user) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", currentSession.user.id)
      .maybeSingle();

    if (error) {
      if (!cancelled) {
        setStatus(error.message);
        setProfile(profileFromAuth(currentSession.user));
      }
      return;
    }

    if (!cancelled) setProfile(data ? profileFromRow(data) : profileFromAuth(currentSession.user));
  }

  async function loadAppData(currentSession = session, cancelled = false) {
    if (!currentSession?.user) return;
    if (!cancelled) setDataLoading(true);

    try {
      const [exerciseResult, liftResult, workoutResult, friendshipResult] = await Promise.all([
        supabase
          .from("exercises")
          .select("id,name,slug,lift_type,description,is_global,owner_user_id")
          .order("is_global", { ascending: false })
          .order("name", { ascending: true }),
        supabase
          .from("lift_entries")
          .select("*, exercises(name)")
          .eq("user_id", currentSession.user.id)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("workouts")
          .select("*, exercises(name), workout_rounds(*)")
          .eq("user_id", currentSession.user.id)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("friendships")
          .select("id,requester_id,recipient_id,status,created_at")
          .or(`requester_id.eq.${currentSession.user.id},recipient_id.eq.${currentSession.user.id}`)
          .order("created_at", { ascending: false })
      ]);

      if (cancelled) return;

      if (exerciseResult.error) setStatus(exerciseResult.error.message);
      else setExercises(exerciseResult.data || []);

      if (liftResult.error) setStatus(liftResult.error.message);
      else setLifts(liftResult.data || []);

      if (workoutResult.error) setStatus(workoutResult.error.message);
      else setWorkouts((workoutResult.data || []).map(sortWorkoutRounds));

      if (friendshipResult.error) setStatus(friendshipResult.error.message);
      else await hydrateFriendships(friendshipResult.data || [], currentSession.user.id, cancelled);
    } finally {
      if (!cancelled) setDataLoading(false);
    }
  }

  async function hydrateFriendships(friendships, userId, cancelled = false) {
    const otherIds = [...new Set(friendships.map((item) => item.requester_id === userId ? item.recipient_id : item.requester_id))];
    if (!otherIds.length) {
      if (!cancelled) setFriends([]);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id,name,surname,nickname,club,country,profile_photo_url")
      .in("id", otherIds);

    if (error) {
      if (!cancelled) setStatus(error.message);
      return;
    }

    const profilesById = new Map((data || []).map((profile) => [profile.id, profile]));
    const nextFriends = friendships.map((friendship) => {
      const otherId = friendship.requester_id === userId ? friendship.recipient_id : friendship.requester_id;
      const otherProfile = profilesById.get(otherId) || {};
      return {
        ...friendship,
        profile_id: otherId,
        incoming: friendship.recipient_id === userId && friendship.status === "pending",
        outgoing: friendship.requester_id === userId && friendship.status === "pending",
        accepted: friendship.status === "accepted",
        profile: otherProfile
      };
    });

    if (!cancelled) setFriends(nextFriends);
  }

  async function signIn(provider) {
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
        queryParams: provider === "google" ? { prompt: "select_account" } : undefined
      }
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function saveProfile(nextProfile) {
    if (!session?.user) return;
    setSaving(true);
    setStatus("");

    const payload = {
      id: session.user.id,
      email: session.user.email,
      name: nextProfile.name.trim(),
      surname: cleanOptional(nextProfile.surname),
      nickname: cleanOptional(nextProfile.nickname),
      profile_photo_url: cleanOptional(nextProfile.profile_photo_url),
      sex: nextProfile.sex,
      birthday: birthdayToIso(nextProfile.birthday),
      bodyweight: Number(nextProfile.bodyweight),
      preferred_unit: nextProfile.preferred_unit,
      country: nextProfile.country,
      club: cleanOptional(nextProfile.club),
      search_enabled: Boolean(nextProfile.search_enabled),
      privacy_setting: nextProfile.privacy_setting
    };

    const { data, error } = await supabase
      .from("profiles")
      .upsert(payload)
      .select("*")
      .single();

    setSaving(false);

    if (error) {
      setStatus(error.message);
      return;
    }

    setProfile(profileFromRow(data));
    setStatus("Profile saved.");
    setTab("Home");
    await loadAppData(session);
  }

  async function saveLift(form) {
    if (!session?.user || !profile) return;
    setSaving(true);
    setStatus("");

    const normalizedWeightKg = kg(form.weight, form.unit);
    const reps = Number(form.reps);
    const bestSameLift = lifts
      .filter((lift) => lift.exercise_id === form.exercise_id && Number(lift.reps) === reps)
      .reduce((best, lift) => Math.max(best, Number(lift.normalized_weight_kg || 0)), 0);
    const isPr = normalizedWeightKg > bestSameLift;

    const payload = {
      user_id: session.user.id,
      exercise_id: form.exercise_id,
      date: form.date,
      weight: Number(form.weight),
      unit: form.unit,
      normalized_weight_kg: normalizedWeightKg,
      reps,
      percentage_of_max: form.percentage_of_max ? Number(form.percentage_of_max) : null,
      estimated_1rm_kg: estimatedMaxKg(normalizedWeightKg, reps, form.percentage_of_max),
      notes: cleanOptional(form.notes),
      location: cleanOptional(form.location),
      bodyweight: form.bodyweight ? Number(form.bodyweight) : null,
      bodyweight_unit: profile.preferred_unit,
      straps_used: form.straps_used === "yes",
      is_pr: isPr,
      visibility: form.visibility
    };

    const { error } = await supabase.from("lift_entries").insert(payload);
    setSaving(false);

    if (error) {
      setStatus(error.message);
      return;
    }

    setStatus(isPr ? "Lift saved. New PR." : "Lift saved.");
    setTab("History");
    await loadAppData(session);
  }

  async function updateLift(liftId, form) {
    if (!session?.user || !profile) return;
    setSaving(true);
    setStatus("");

    const normalizedWeightKg = kg(form.weight, form.unit);
    const reps = Number(form.reps);
    const payload = {
      exercise_id: form.exercise_id,
      date: form.date,
      weight: Number(form.weight),
      unit: form.unit,
      normalized_weight_kg: normalizedWeightKg,
      reps,
      percentage_of_max: form.percentage_of_max ? Number(form.percentage_of_max) : null,
      estimated_1rm_kg: estimatedMaxKg(normalizedWeightKg, reps, form.percentage_of_max),
      notes: cleanOptional(form.notes),
      location: cleanOptional(form.location),
      bodyweight: form.bodyweight ? Number(form.bodyweight) : null,
      bodyweight_unit: profile.preferred_unit,
      straps_used: form.straps_used === "yes",
      visibility: form.visibility
    };

    const { error } = await supabase
      .from("lift_entries")
      .update(payload)
      .eq("id", liftId)
      .eq("user_id", session.user.id);

    setSaving(false);

    if (error) {
      setStatus(error.message);
      return;
    }

    setEditingLiftId("");
    setStatus("Lift updated.");
    await loadAppData(session);
    await recomputePrFlags(session);
    await loadAppData(session);
  }

  async function deleteLift(liftId) {
    if (!session?.user) return;
    setSaving(true);
    setStatus("");

    const { error } = await supabase
      .from("lift_entries")
      .delete()
      .eq("id", liftId)
      .eq("user_id", session.user.id);

    setSaving(false);

    if (error) {
      setStatus(error.message);
      return;
    }

    setEditingLiftId("");
    setStatus("Lift deleted.");
    await loadAppData(session);
    await recomputePrFlags(session);
    await loadAppData(session);
  }

  async function recomputePrFlags(currentSession = session) {
    if (!currentSession?.user) return;
    const { data, error } = await supabase
      .from("lift_entries")
      .select("id,exercise_id,reps,normalized_weight_kg,date,created_at")
      .eq("user_id", currentSession.user.id)
      .order("date", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      setStatus(error.message);
      return;
    }

    const best = {};
    const updates = (data || []).map((lift) => {
      const key = `${lift.exercise_id}:${lift.reps}`;
      const previousBest = best[key] || 0;
      const isPr = Number(lift.normalized_weight_kg) > previousBest;
      best[key] = Math.max(previousBest, Number(lift.normalized_weight_kg));
      return supabase.from("lift_entries").update({ is_pr: isPr }).eq("id", lift.id).eq("user_id", currentSession.user.id);
    });

    await Promise.all(updates);
  }

  async function saveWorkout(form) {
    if (!session?.user) return;
    setSaving(true);
    setStatus("");

    const rounds = form.rounds.filter((round) => round.percentage);
    if (!form.exercise_id || !form.base_weight || !rounds.length) {
      setSaving(false);
      setStatus("Choose exercise, base weight, and at least one round.");
      return;
    }

    const workoutPayload = {
      user_id: session.user.id,
      exercise_id: form.exercise_id,
      date: new Date().toISOString().slice(0, 10),
      base_weight: Number(form.base_weight),
      unit: form.unit,
      rounding: Number(form.rounding),
      visibility: form.visibility,
      notes: cleanOptional(form.notes)
    };

    const { data: workout, error: workoutError } = await supabase
      .from("workouts")
      .insert(workoutPayload)
      .select("*")
      .single();

    if (workoutError) {
      setSaving(false);
      setStatus(workoutError.message);
      return;
    }

    const roundPayload = rounds.map((round, index) => ({
      workout_id: workout.id,
      position: index + 1,
      percentage: Number(round.percentage),
      reps: round.reps ? Number(round.reps) : null,
      target_weight: roundedWorkoutWeight(form.base_weight, round.percentage, form.rounding),
      notes: cleanOptional(round.notes)
    }));

    const { error: roundsError } = await supabase.from("workout_rounds").insert(roundPayload);
    setSaving(false);

    if (roundsError) {
      setStatus(roundsError.message);
      return;
    }

    setStatus("Workout saved.");
    await loadAppData(session);
  }

  async function updateWorkout(workoutId, form) {
    if (!session?.user) return;
    setSaving(true);
    setStatus("");

    const rounds = form.rounds.filter((round) => round.percentage);
    const { error: workoutError } = await supabase
      .from("workouts")
      .update({
        exercise_id: form.exercise_id,
        base_weight: Number(form.base_weight),
        unit: form.unit,
        rounding: Number(form.rounding),
        visibility: form.visibility,
        notes: cleanOptional(form.notes)
      })
      .eq("id", workoutId)
      .eq("user_id", session.user.id);

    if (workoutError) {
      setSaving(false);
      setStatus(workoutError.message);
      return;
    }

    const { error: deleteRoundsError } = await supabase.from("workout_rounds").delete().eq("workout_id", workoutId);
    if (deleteRoundsError) {
      setSaving(false);
      setStatus(deleteRoundsError.message);
      return;
    }

    const roundPayload = rounds.map((round, index) => ({
      workout_id: workoutId,
      position: index + 1,
      percentage: Number(round.percentage),
      reps: round.reps ? Number(round.reps) : null,
      target_weight: roundedWorkoutWeight(form.base_weight, round.percentage, form.rounding),
      notes: cleanOptional(round.notes)
    }));

    const { error: roundsError } = await supabase.from("workout_rounds").insert(roundPayload);
    setSaving(false);

    if (roundsError) {
      setStatus(roundsError.message);
      return;
    }

    setEditingWorkoutId("");
    setStatus("Workout updated.");
    await loadAppData(session);
  }

  async function deleteWorkout(workoutId) {
    if (!session?.user) return;
    setSaving(true);
    setStatus("");

    const { error } = await supabase
      .from("workouts")
      .delete()
      .eq("id", workoutId)
      .eq("user_id", session.user.id);

    setSaving(false);

    if (error) {
      setStatus(error.message);
      return;
    }

    setEditingWorkoutId("");
    setStatus("Workout deleted.");
    await loadAppData(session);
  }

  async function searchFriends(query) {
    if (!session?.user) return;
    const term = query.trim();
    setFriendSearchRan(true);
    setStatus("");

    if (!term) {
      setFriendResults([]);
      return;
    }

    const safeTerm = term.replaceAll("%", "").replaceAll(",", " ");
    const { data, error } = await supabase
      .from("profiles")
      .select("id,name,surname,nickname,club,country,profile_photo_url")
      .neq("id", session.user.id)
      .or(`name.ilike.%${safeTerm}%,surname.ilike.%${safeTerm}%,nickname.ilike.%${safeTerm}%,club.ilike.%${safeTerm}%`)
      .limit(10);

    if (error) {
      setStatus(error.message);
      setFriendResults([]);
      return;
    }

    const knownIds = new Set(friends.map((friend) => friend.profile_id));
    setFriendResults((data || []).map((profile) => ({ ...profile, alreadyKnown: knownIds.has(profile.id) })));
  }

  async function sendFriendRequest(profileId) {
    if (!session?.user) return;
    setSaving(true);
    setStatus("");

    const { error } = await supabase.from("friendships").insert({
      requester_id: session.user.id,
      recipient_id: profileId,
      status: "pending"
    });

    setSaving(false);

    if (error) {
      setStatus(error.message);
      return;
    }

    setFriendResults((current) => current.map((profile) => profile.id === profileId ? { ...profile, alreadyKnown: true } : profile));
    setStatus("Friend request sent.");
    await loadAppData(session);
  }

  async function acceptFriendRequest(friendshipId) {
    if (!session?.user) return;
    setSaving(true);
    setStatus("");

    const { error } = await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("id", friendshipId)
      .eq("recipient_id", session.user.id);

    setSaving(false);

    if (error) {
      setStatus(error.message);
      return;
    }

    setStatus("Friend request accepted.");
    await loadAppData(session);
  }

  const profileComplete = useMemo(() => isProfileComplete(profile), [profile]);

  if (loading) {
    return <Centered message="Checking session..." />;
  }

  if (!session) {
    return (
      <Centered>
        <h1>PR Forge</h1>
        <p className="muted">Track records, attach lift videos, and follow friends&apos; progress.</p>
        <div className="grid">
          <button className="btn" onClick={() => signIn("google")}>Continue with Google</button>
          <button className="btn secondary" onClick={() => signIn("facebook")}>Continue with Facebook</button>
        </div>
      </Centered>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark">PR</div>
          <div>
            <div className="brand-title">PR Forge</div>
            <div className="brand-subtitle">{profile?.nickname || profile?.name || session.user.email}</div>
          </div>
        </div>
      </header>

      <main className="main">
        {!profileComplete ? (
          <ProfilePanel
            title="Complete profile"
            description="Bodyweight and country are required before tracking lifts."
            profile={profile}
            saving={saving}
            status={status}
            onSave={saveProfile}
            onSignOut={signOut}
          />
        ) : tab === "Profile" ? (
          <ProfilePanel
            title="Profile"
            description="OAuth-only account details and default privacy."
            profile={profile}
            saving={saving}
            status={status}
            onSave={saveProfile}
            onSignOut={signOut}
          />
        ) : (
          <Dashboard
            tab={tab}
            profile={profile}
            exercises={exercises}
            lifts={lifts}
            workouts={workouts}
            friends={friends}
            friendResults={friendResults}
            friendSearchRan={friendSearchRan}
            dataLoading={dataLoading}
            saving={saving}
            status={status}
            editingLiftId={editingLiftId}
            editingWorkoutId={editingWorkoutId}
            progressExerciseId={progressExerciseId}
            progressMode={progressMode}
            onEditLift={setEditingLiftId}
            onCancelEditLift={() => setEditingLiftId("")}
            onUpdateLift={updateLift}
            onDeleteLift={deleteLift}
            onEditWorkout={setEditingWorkoutId}
            onCancelEditWorkout={() => setEditingWorkoutId("")}
            onSaveWorkout={saveWorkout}
            onUpdateWorkout={updateWorkout}
            onDeleteWorkout={deleteWorkout}
            onSearchFriends={searchFriends}
            onSendFriendRequest={sendFriendRequest}
            onAcceptFriendRequest={acceptFriendRequest}
            onProgressExerciseChange={setProgressExerciseId}
            onProgressModeChange={setProgressMode}
            onSaveLift={saveLift}
            onSignOut={signOut}
          />
        )}
      </main>

      {profileComplete && (
        <nav className="bottom-nav" aria-label="Main navigation">
          {NAV.map((item) => (
            <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>
              {item === "Friends" && friends.some((friend) => friend.incoming) ? <span className="nav-dot" aria-hidden="true" /> : null}
              <span>{item}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

function Dashboard({
  tab,
  profile,
  exercises,
  lifts,
  workouts,
  friends,
  friendResults,
  friendSearchRan,
  dataLoading,
  saving,
  status,
  editingLiftId,
  editingWorkoutId,
  progressExerciseId,
  progressMode,
  onEditLift,
  onCancelEditLift,
  onUpdateLift,
  onDeleteLift,
  onEditWorkout,
  onCancelEditWorkout,
  onSaveWorkout,
  onUpdateWorkout,
  onDeleteWorkout,
  onSearchFriends,
  onSendFriendRequest,
  onAcceptFriendRequest,
  onProgressExerciseChange,
  onProgressModeChange,
  onSaveLift,
  onSignOut
}) {
  if (tab === "Add") {
    return (
      <AddLiftPanel
        profile={profile}
        exercises={exercises}
        saving={saving}
        status={status}
        onSaveLift={onSaveLift}
      />
    );
  }

  if (tab === "History") {
    return (
      <HistoryPanel
        profile={profile}
        exercises={exercises}
        lifts={lifts}
        dataLoading={dataLoading}
        saving={saving}
        status={status}
        editingLiftId={editingLiftId}
        onEditLift={onEditLift}
        onCancelEditLift={onCancelEditLift}
        onUpdateLift={onUpdateLift}
        onDeleteLift={onDeleteLift}
      />
    );
  }

  if (tab === "Progress") {
    return (
      <ProgressPanel
        profile={profile}
        exercises={exercises}
        lifts={lifts}
        selectedExerciseId={progressExerciseId || exercises[0]?.id || ""}
        mode={progressMode}
        onExerciseChange={onProgressExerciseChange}
        onModeChange={onProgressModeChange}
      />
    );
  }

  if (tab === "Workout") {
    return (
      <WorkoutPanel
        profile={profile}
        exercises={exercises}
        lifts={lifts}
        workouts={workouts}
        saving={saving}
        status={status}
        editingWorkoutId={editingWorkoutId}
        onEditWorkout={onEditWorkout}
        onCancelEditWorkout={onCancelEditWorkout}
        onSaveWorkout={onSaveWorkout}
        onUpdateWorkout={onUpdateWorkout}
        onDeleteWorkout={onDeleteWorkout}
      />
    );
  }

  if (tab === "Friends") {
    return (
      <FriendsPanel
        profile={profile}
        lifts={lifts}
        friends={friends}
        friendResults={friendResults}
        friendSearchRan={friendSearchRan}
        saving={saving}
        status={status}
        onSearchFriends={onSearchFriends}
        onSendFriendRequest={onSendFriendRequest}
        onAcceptFriendRequest={onAcceptFriendRequest}
      />
    );
  }

  if (tab !== "Home") {
    return (
      <section className="panel">
        <h1>{tab}</h1>
        <p className="muted">This production tab is next in the migration queue.</p>
      </section>
    );
  }

  return (
    <div className="grid">
      <section className="panel">
        <h1>Home</h1>
        <p className="muted">Welcome back, {profile.nickname || profile.name}. Your live profile is now saved in Supabase.</p>
        <div className="profile-summary">
          <span>Bodyweight: {profile.bodyweight} {profile.preferred_unit}</span>
          <span>Country: {countryName(profile.country)}</span>
          {profile.club ? <span>Club: {profile.club}</span> : null}
          <span>Privacy: {privacyLabel(profile.privacy_setting)}</span>
        </div>
        <div className="profile-summary">
          <span>{lifts.length} lift{lifts.length === 1 ? "" : "s"} logged</span>
          <span>{lifts.filter((lift) => lift.is_pr).length} PR{lifts.filter((lift) => lift.is_pr).length === 1 ? "" : "s"}</span>
          <span>{workouts.length} workout{workouts.length === 1 ? "" : "s"} saved</span>
        </div>
        <button className="btn secondary" onClick={onSignOut}>Sign out</button>
      </section>
    </div>
  );
}

function AddLiftPanel({ profile, exercises, saving, status, onSaveLift }) {
  const [form, setForm] = useState(() => ({
    exercise_id: exercises[0]?.id || "",
    date: new Date().toISOString().slice(0, 10),
    weight: "",
    unit: profile.preferred_unit,
    reps: "1",
    percentage_of_max: "",
    location: profile.club || "",
    bodyweight: profile.bodyweight || "",
    straps_used: "no",
    notes: "",
    visibility: profile.privacy_setting
  }));

  useEffect(() => {
    setForm((current) => ({
      ...current,
      exercise_id: current.exercise_id || exercises[0]?.id || "",
      unit: profile.preferred_unit,
      location: current.location || profile.club || "",
      bodyweight: current.bodyweight || profile.bodyweight || "",
      visibility: current.visibility || profile.privacy_setting
    }));
  }, [exercises, profile]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function submit(event) {
    event.preventDefault();
    onSaveLift(form);
  }

  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <h1>Add lift</h1>
          <p className="muted">Log a lift and PR Forge will detect records for that exercise and rep count.</p>
        </div>
      </div>

      {!exercises.length ? (
        <p className="empty">No exercises found. Check that the Supabase schema seed ran successfully.</p>
      ) : (
        <form className="form" onSubmit={submit}>
          <div className="split">
            <Field label="Exercise" required>
              <select required value={form.exercise_id} onChange={(event) => update("exercise_id", event.target.value)}>
                {exercises.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}
              </select>
            </Field>
            <Field label="Date" required>
              <input required type="date" value={form.date} onChange={(event) => update("date", event.target.value)} />
            </Field>
            <Field label="Weight lifted" required>
              <input required type="number" min="0.1" step="0.1" value={form.weight} onChange={(event) => update("weight", event.target.value)} />
            </Field>
            <Field label="Unit">
              <select value={form.unit} onChange={(event) => update("unit", event.target.value)}>
                <option value="kg">kg</option>
                <option value="lb">lb</option>
              </select>
            </Field>
            <Field label="Reps" required>
              <input required type="number" min="1" step="1" value={form.reps} onChange={(event) => update("reps", event.target.value)} />
            </Field>
            <Field label="Percentage of max">
              <input type="number" min="1" max="100" step="0.1" value={form.percentage_of_max} onChange={(event) => update("percentage_of_max", event.target.value)} />
            </Field>
            <Field label="Location, gym, or club">
              <input value={form.location} onChange={(event) => update("location", event.target.value)} />
            </Field>
            <Field label="Bodyweight today">
              <input type="number" min="1" step="0.1" value={form.bodyweight} onChange={(event) => update("bodyweight", event.target.value)} />
            </Field>
            <Field label="Were straps used?">
              <select value={form.straps_used} onChange={(event) => update("straps_used", event.target.value)}>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </Field>
            <Field label="Visibility">
              <select value={form.visibility} onChange={(event) => update("visibility", event.target.value)}>
                <option value="private">Only me</option>
                <option value="friends">Friends only</option>
                <option value="public">Public</option>
              </select>
            </Field>
          </div>
          <Field label="Notes">
            <textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder="How did it feel?" />
          </Field>
          {status ? <p className="status">{status}</p> : null}
          <button className="btn" disabled={saving} type="submit">{saving ? "Saving..." : "Save lift"}</button>
        </form>
      )}
    </section>
  );
}

function HistoryPanel({
  profile,
  exercises,
  lifts,
  dataLoading,
  saving,
  status,
  editingLiftId,
  onEditLift,
  onCancelEditLift,
  onUpdateLift,
  onDeleteLift
}) {
  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <h1>History</h1>
          <p className="muted">Your live lift entries saved in Supabase.</p>
        </div>
      </div>

      {dataLoading ? <p className="muted">Loading lifts...</p> : null}
      {!dataLoading && !lifts.length ? <p className="empty">No lifts logged yet.</p> : null}
      {status ? <p className="status">{status}</p> : null}
      <div className="list">
        {lifts.map((lift) => (
          editingLiftId === lift.id ? (
            <LiftEditRow
              key={lift.id}
              lift={lift}
              profile={profile}
              exercises={exercises}
              saving={saving}
              onCancel={onCancelEditLift}
              onUpdate={onUpdateLift}
              onDelete={onDeleteLift}
            />
          ) : (
            <article className="lift-row" key={lift.id}>
              <div>
                <div className="lift-title">
                  {lift.exercises?.name || "Exercise"}
                  {lift.is_pr ? <span className="badge">PR</span> : null}
                  <span className="badge blue">{privacyLabel(lift.visibility)}</span>
                </div>
                <div className="meta">
                  <span>{displayWeight(lift.normalized_weight_kg, profile.preferred_unit)}</span>
                  <span>{lift.reps} rep{Number(lift.reps) === 1 ? "" : "s"}</span>
                  <span>{displayDate(lift.date)}</span>
                  {lift.straps_used ? <span>Straps: yes</span> : <span>Straps: no</span>}
                </div>
                {lift.notes ? <p>{lift.notes}</p> : null}
                <div className="actions">
                  <button className="btn secondary" type="button" onClick={() => onEditLift(lift.id)}>Edit</button>
                </div>
              </div>
            </article>
          )
        ))}
      </div>
    </section>
  );
}

function LiftEditRow({ lift, profile, exercises, saving, onCancel, onUpdate, onDelete }) {
  const [form, setForm] = useState(() => ({
    exercise_id: lift.exercise_id,
    date: lift.date,
    weight: lift.weight,
    unit: lift.unit,
    reps: lift.reps,
    percentage_of_max: lift.percentage_of_max || "",
    location: lift.location || "",
    bodyweight: lift.bodyweight || "",
    straps_used: lift.straps_used ? "yes" : "no",
    notes: lift.notes || "",
    visibility: lift.visibility
  }));

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function submit(event) {
    event.preventDefault();
    onUpdate(lift.id, form);
  }

  return (
    <article className="lift-row">
      <form className="form" onSubmit={submit}>
        <div className="split">
          <Field label="Exercise" required>
            <select required value={form.exercise_id} onChange={(event) => update("exercise_id", event.target.value)}>
              {exercises.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}
            </select>
          </Field>
          <Field label="Date" required>
            <input required type="date" value={form.date} onChange={(event) => update("date", event.target.value)} />
          </Field>
          <Field label="Weight lifted" required>
            <input required type="number" min="0.1" step="0.1" value={form.weight} onChange={(event) => update("weight", event.target.value)} />
          </Field>
          <Field label="Unit">
            <select value={form.unit} onChange={(event) => update("unit", event.target.value)}>
              <option value="kg">kg</option>
              <option value="lb">lb</option>
            </select>
          </Field>
          <Field label="Reps" required>
            <input required type="number" min="1" step="1" value={form.reps} onChange={(event) => update("reps", event.target.value)} />
          </Field>
          <Field label="Percentage of max">
            <input type="number" min="1" max="100" step="0.1" value={form.percentage_of_max} onChange={(event) => update("percentage_of_max", event.target.value)} />
          </Field>
          <Field label="Location, gym, or club">
            <input value={form.location} onChange={(event) => update("location", event.target.value)} />
          </Field>
          <Field label="Bodyweight today">
            <input type="number" min="1" step="0.1" value={form.bodyweight} onChange={(event) => update("bodyweight", event.target.value)} />
          </Field>
          <Field label="Were straps used?">
            <select value={form.straps_used} onChange={(event) => update("straps_used", event.target.value)}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </Field>
          <Field label="Visibility">
            <select value={form.visibility} onChange={(event) => update("visibility", event.target.value)}>
              <option value="private">Only me</option>
              <option value="friends">Friends only</option>
              <option value="public">Public</option>
            </select>
          </Field>
        </div>
        <Field label="Notes">
          <textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} />
        </Field>
        <div className="actions">
          <button className="btn" disabled={saving} type="submit">{saving ? "Saving..." : "Save changes"}</button>
          <button className="btn secondary" type="button" onClick={onCancel}>Cancel</button>
          <button className="btn danger" disabled={saving} type="button" onClick={() => onDelete(lift.id)}>Delete lift</button>
        </div>
      </form>
    </article>
  );
}

function ProgressPanel({ profile, exercises, lifts, selectedExerciseId, mode, onExerciseChange, onModeChange }) {
  const exerciseLifts = lifts
    .filter((lift) => lift.exercise_id === selectedExerciseId)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.created_at).localeCompare(String(b.created_at)));
  const prs = exerciseLifts.filter((lift) => lift.is_pr).slice().reverse();
  const currentPr = prs[0];
  const previousPr = prs[1];
  const diff = currentPr && previousPr ? Number(currentPr.normalized_weight_kg) - Number(previousPr.normalized_weight_kg) : 0;
  const best = bestByReps(exerciseLifts);

  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <h1>Progress</h1>
          <p className="muted">Track PRs, best rep maxes, and actual vs predicted progress.</p>
        </div>
      </div>

      <div className="split">
        <Field label="Exercise">
          <select value={selectedExerciseId} onChange={(event) => onExerciseChange(event.target.value)}>
            {exercises.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}
          </select>
        </Field>
        <Field label="Chart value">
          <select value={mode} onChange={(event) => onModeChange(event.target.value)}>
            <option value="actual">Actual lifted weight</option>
            <option value="predicted">Predicted 100% / estimated 1RM</option>
          </select>
        </Field>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><span>Current PR</span><strong>{currentPr ? displayWeight(currentPr.normalized_weight_kg, profile.preferred_unit) : "-"}</strong></div>
        <div className="stat-card"><span>Last PR date</span><strong>{currentPr ? displayDate(currentPr.date) : "-"}</strong></div>
        <div className="stat-card"><span>From previous PR</span><strong>{diff > 0 ? `+${displayWeight(diff, profile.preferred_unit)}` : "-"}</strong></div>
      </div>

      <h2>Best by reps</h2>
      <div className="stats-grid">
        {[1, 3, 5].map((reps) => (
          <div className="stat-card" key={reps}>
            <span>{reps}RM</span>
            <strong>{best[reps] ? displayWeight(best[reps].normalized_weight_kg, profile.preferred_unit) : "-"}</strong>
          </div>
        ))}
      </div>

      <h2>Progress chart</h2>
      {exerciseLifts.length ? (
        <ProgressChart lifts={exerciseLifts} unit={profile.preferred_unit} mode={mode} />
      ) : (
        <p className="empty">No entries for this exercise yet.</p>
      )}
    </section>
  );
}

function WorkoutPanel({
  profile,
  exercises,
  lifts,
  workouts,
  saving,
  status,
  editingWorkoutId,
  onEditWorkout,
  onCancelEditWorkout,
  onSaveWorkout,
  onUpdateWorkout,
  onDeleteWorkout
}) {
  const editingWorkout = workouts.find((workout) => workout.id === editingWorkoutId);
  const defaultExerciseId = editingWorkout?.exercise_id || exercises[0]?.id || "";
  const defaultBase = editingWorkout ? editingWorkout.base_weight : bestTrainingBase(lifts, defaultExerciseId, profile.preferred_unit);
  const [form, setForm] = useState(() => workoutFormFromSource(editingWorkout, defaultExerciseId, defaultBase, profile));

  useEffect(() => {
    const nextExerciseId = editingWorkout?.exercise_id || form.exercise_id || exercises[0]?.id || "";
    const nextBase = editingWorkout ? editingWorkout.base_weight : (form.base_weight || bestTrainingBase(lifts, nextExerciseId, profile.preferred_unit));
    setForm(workoutFormFromSource(editingWorkout, nextExerciseId, nextBase, profile, form.rounds));
  }, [editingWorkoutId, exercises.length]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateRound(id, field, value) {
    setForm((current) => ({
      ...current,
      rounds: current.rounds.map((round) => round.id === id ? { ...round, [field]: value } : round)
    }));
  }

  function addRound() {
    setForm((current) => ({
      ...current,
      rounds: [...current.rounds, { id: `round_${Date.now()}`, percentage: "", reps: "", notes: "" }]
    }));
  }

  function removeRound(id) {
    setForm((current) => ({
      ...current,
      rounds: current.rounds.filter((round) => round.id !== id)
    }));
  }

  function changeExercise(value) {
    const base = bestTrainingBase(lifts, value, profile.preferred_unit);
    setForm((current) => ({ ...current, exercise_id: value, base_weight: base || "" }));
  }

  function submit() {
    if (editingWorkoutId) onUpdateWorkout(editingWorkoutId, form);
    else onSaveWorkout(form);
  }

  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <h1>Workout</h1>
          <p className="muted">Plan percentage rounds from your PR or a training max.</p>
        </div>
      </div>

      <div className="split">
        <Field label="Exercise">
          <select value={form.exercise_id} onChange={(event) => changeExercise(event.target.value)}>
            {exercises.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}
          </select>
        </Field>
        <Field label="Base weight / training max">
          <input type="number" min="1" step="0.1" value={form.base_weight} onChange={(event) => update("base_weight", event.target.value)} />
        </Field>
        <Field label="Round to nearest">
          <select value={form.rounding} onChange={(event) => update("rounding", event.target.value)}>
            {(form.unit === "kg" ? [["0.5", "0.5 kg"], ["1", "1 kg"], ["2.5", "2.5 kg"]] : [["1", "1 lb"], ["2.5", "2.5 lb"], ["5", "5 lb"]]).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </Field>
        <Field label="Visibility">
          <select value={form.visibility} onChange={(event) => update("visibility", event.target.value)}>
            <option value="private">Only me</option>
            <option value="friends">Friends only</option>
            <option value="public">Public</option>
          </select>
        </Field>
      </div>

      <div className="section-head subhead">
        <h2>Rounds</h2>
        <div className="actions">
          <button className="btn" type="button" disabled={saving} onClick={submit}>{editingWorkoutId ? "Save changes" : "Save workout"}</button>
          {editingWorkoutId ? (
            <>
              <button className="btn secondary" type="button" onClick={onCancelEditWorkout}>Cancel</button>
              <button className="btn danger" type="button" disabled={saving} onClick={() => onDeleteWorkout(editingWorkoutId)}>Delete workout</button>
            </>
          ) : null}
          <button className="btn secondary" type="button" onClick={addRound}>+ Round</button>
        </div>
      </div>

      {status ? <p className="status">{status}</p> : null}

      <div className="workout-rounds">
        {form.rounds.map((round, index) => {
          const target = form.base_weight && round.percentage ? roundedWorkoutWeight(form.base_weight, round.percentage, form.rounding) : 0;
          return (
            <div className="workout-round" key={round.id}>
              <div className="round-number">{index + 1}</div>
              <Field label="Percentage">
                <input type="number" min="0" step="0.5" value={round.percentage} onChange={(event) => updateRound(round.id, "percentage", event.target.value)} />
              </Field>
              <Field label="Reps">
                <input type="number" min="1" step="1" value={round.reps} onChange={(event) => updateRound(round.id, "reps", event.target.value)} />
              </Field>
              <div className="target-weight">
                <span>Target</span>
                <strong>{target ? `${target} ${form.unit}` : "-"}</strong>
              </div>
              <Field label="Notes">
                <input value={round.notes} onChange={(event) => updateRound(round.id, "notes", event.target.value)} />
              </Field>
              <button className="btn secondary icon-btn" type="button" onClick={() => removeRound(round.id)}>x</button>
            </div>
          );
        })}
      </div>

      <h2>Saved workouts</h2>
      {!workouts.length ? <p className="empty">Saved workout plans will appear here.</p> : null}
      <div className="list">
        {workouts.slice(0, 5).map((workout) => (
          <article className="lift-row" key={workout.id}>
            <div>
              <div className="lift-title">{workout.exercises?.name || "Workout"} <span className="badge blue">Workout</span></div>
              <div className="meta">
                <span>{displayDate(workout.date)}</span>
                <span>Base {workout.base_weight} {workout.unit}</span>
                <span>{workout.workout_rounds?.length || 0} round{(workout.workout_rounds?.length || 0) === 1 ? "" : "s"}</span>
              </div>
              <p>{(workout.workout_rounds || []).map((round) => `${round.percentage}% -> ${round.target_weight} ${workout.unit}`).join(", ")}</p>
              <div className="actions">
                <button className="btn secondary" type="button" onClick={() => onEditWorkout(workout.id)}>Edit</button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function FriendsPanel({
  lifts,
  friends,
  friendResults,
  friendSearchRan,
  saving,
  status,
  onSearchFriends,
  onSendFriendRequest,
  onAcceptFriendRequest
}) {
  const [query, setQuery] = useState("");
  const incoming = friends.filter((friend) => friend.incoming);
  const sent = friends.filter((friend) => friend.outgoing);
  const accepted = friends.filter((friend) => friend.accepted);
  const friendFeed = lifts.filter((lift) => lift.is_pr && friends.some((friend) => friend.accepted && friend.profile_id === lift.user_id));

  function submit(event) {
    event.preventDefault();
    onSearchFriends(query);
  }

  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <h1>Friends</h1>
          <p className="muted">Search, request, accept, and view friends&apos; PRs.</p>
        </div>
      </div>

      <div className="split">
        <div>
          <h2>Find friends</h2>
          <form className="form" onSubmit={submit}>
            <Field label="Name, nickname, or club" required>
              <input required value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Alex" />
            </Field>
            <button className="btn" type="submit">Find</button>
          </form>
          <div className="list inset-list">
            {friendResults.map((result) => (
              <article className="lift-row" key={result.id}>
                <div>
                  <div className="lift-title">{displayPerson(result)}</div>
                  <div className="meta">{[result.club, countryName(result.country)].filter(Boolean).join(" · ") || "Profile"}</div>
                </div>
                <div className="actions">
                  {result.alreadyKnown ? <span className="badge blue">Requested</span> : (
                    <button className="btn secondary" disabled={saving} type="button" onClick={() => onSendFriendRequest(result.id)}>Add friend</button>
                  )}
                </div>
              </article>
            ))}
            {!friendResults.length && friendSearchRan ? <p className="empty">No users found for &quot;{query}&quot;.</p> : null}
            {!friendResults.length && !friendSearchRan ? <p className="empty">Search results will appear here.</p> : null}
          </div>
        </div>

        <div>
          <h2>Requests</h2>
          <div className="list">
            {incoming.map((friend) => (
              <FriendRow key={friend.id} friend={friend} action={<button className="btn secondary" disabled={saving} type="button" onClick={() => onAcceptFriendRequest(friend.id)}>Accept</button>} />
            ))}
            {!incoming.length ? <p className="empty">No incoming requests.</p> : null}
          </div>

          <h2>Friends</h2>
          <div className="list">
            {accepted.map((friend) => <FriendRow key={friend.id} friend={friend} action={<span className="badge">Friends</span>} />)}
            {!accepted.length ? <p className="empty">Accepted friends will appear here.</p> : null}
          </div>

          {sent.length ? (
            <>
              <h2>Sent</h2>
              <div className="list">
                {sent.map((friend) => <FriendRow key={friend.id} friend={friend} action={<span className="badge blue">Sent</span>} />)}
              </div>
            </>
          ) : null}
        </div>
      </div>

      {status ? <p className="status">{status}</p> : null}

      <h2>Friends&apos; recent PRs</h2>
      {friendFeed.length ? (
        <div className="list">
          {friendFeed.slice(0, 10).map((lift) => (
            <article className="lift-row" key={lift.id}>
              <div>
                <div className="lift-title">{lift.exercises?.name || "Exercise"} <span className="badge">PR</span></div>
                <div className="meta">{displayWeight(lift.normalized_weight_kg)} · {lift.reps} rep{Number(lift.reps) === 1 ? "" : "s"} · {displayDate(lift.date)}</div>
                {lift.notes ? <p>{lift.notes}</p> : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty">Accepted friends&apos; PRs will appear here.</p>
      )}
    </section>
  );
}

function FriendRow({ friend, action }) {
  return (
    <article className="lift-row">
      <div>
        <div className="lift-title">{displayPerson(friend.profile)}</div>
        <div className="meta">{[friend.profile?.club, countryName(friend.profile?.country)].filter(Boolean).join(" · ") || "Profile"}</div>
      </div>
      <div className="actions">{action}</div>
    </article>
  );
}

function ProgressChart({ lifts, unit, mode }) {
  const width = 760;
  const height = 320;
  const pad = 92;
  const bottomPad = 76;
  const topPad = 52;
  const plotBottom = height - bottomPad;
  const values = lifts.map((lift) => chartLiftValue(lift, mode));
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(max - min, 1);
  const valueToY = (value) => plotBottom - ((value - min) / range) * (plotBottom - topPad);
  const points = lifts.map((lift, index) => {
    const value = chartLiftValue(lift, mode);
    return {
      x: pad + (index / Math.max(lifts.length - 1, 1)) * (width - pad * 2),
      y: valueToY(value),
      lift,
      value
    };
  });
  const mid = (min + max) / 2;
  const grid = [
    { y: valueToY(max), label: displayWeight(max, unit) },
    { y: valueToY(mid), label: displayWeight(mid, unit) },
    { y: valueToY(min), label: displayWeight(min, unit) }
  ];
  const d = points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");

  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Progress chart">
      <rect x="0" y="0" width={width} height={height} fill="#fbfcfd" />
      {grid.map((tick, index) => <line key={index} x1={pad} y1={tick.y} x2={width - pad} y2={tick.y} stroke="#e8edf3" strokeWidth="1" />)}
      <line x1={pad} y1={plotBottom} x2={width - pad} y2={plotBottom} stroke="#dbe2ea" strokeWidth="1.5" />
      <line x1={pad} y1={topPad} x2={pad} y2={plotBottom} stroke="#dbe2ea" strokeWidth="1.5" />
      <path d={d} fill="none" stroke="#0d766e" strokeWidth="4" />
      {points.map((point) => (
        <circle key={point.lift.id} cx={point.x} cy={point.y} r="5" fill="#ad3e32">
          <title>{displayDate(point.lift.date)}: {displayWeight(point.value, unit)}</title>
        </circle>
      ))}
      {points.map((point, index) => {
        const first = index === 0;
        const last = index === points.length - 1;
        const anchor = first ? "start" : last ? "end" : "middle";
        const x = point.x + (first ? 6 : last ? -6 : 0);
        return <text key={point.lift.id} x={x} y={height - 28} textAnchor={anchor} fill="#657286" fontSize="13">{formatChartDate(point.lift.date)}</text>;
      })}
      {grid.map((tick, index) => <text key={index} x={pad - 18} y={tick.y + 5} textAnchor="end" fill="#657286" fontSize="13">{tick.label}</text>)}
    </svg>
  );
}

function ProfilePanel({ title, description, profile, saving, status, onSave, onSignOut }) {
  const [form, setForm] = useState(profile || EMPTY_PROFILE);

  useEffect(() => {
    setForm(profile || EMPTY_PROFILE);
  }, [profile]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function submit(event) {
    event.preventDefault();
    onSave(form);
  }

  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <h1>{title}</h1>
          <p className="muted">{description}</p>
        </div>
      </div>

      <form className="form" onSubmit={submit}>
        <div className="split">
          <Field label="Name" required>
            <input required value={form.name} onChange={(event) => update("name", event.target.value)} />
          </Field>
          <Field label="Surname">
            <input value={form.surname || ""} onChange={(event) => update("surname", event.target.value)} />
          </Field>
          <Field label="Nickname">
            <input value={form.nickname || ""} onChange={(event) => update("nickname", event.target.value)} />
          </Field>
          <Field label="Profile photo URL">
            <input value={form.profile_photo_url || ""} onChange={(event) => update("profile_photo_url", event.target.value)} placeholder="https://..." />
          </Field>
          <Field label="Sex">
            <select value={form.sex} onChange={(event) => update("sex", event.target.value)}>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="non_binary">Non-binary</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </Field>
          <Field label="Birthday">
            <input value={form.birthday || ""} onChange={(event) => update("birthday", event.target.value)} placeholder="yyyy/mm/dd" />
          </Field>
          <Field label="Bodyweight" required>
            <input required type="number" min="1" step="0.1" value={form.bodyweight} onChange={(event) => update("bodyweight", event.target.value)} />
          </Field>
          <Field label="Unit">
            <select value={form.preferred_unit} onChange={(event) => update("preferred_unit", event.target.value)}>
              <option value="kg">kg</option>
              <option value="lb">lb</option>
            </select>
          </Field>
          <Field label="Country" required>
            <select required value={form.country} onChange={(event) => update("country", event.target.value)}>
              <option value="">Select country</option>
              {COUNTRIES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </select>
          </Field>
          <Field label="Club">
            <input value={form.club || ""} onChange={(event) => update("club", event.target.value)} placeholder="Gym or weightlifting club" />
          </Field>
          <Field label="Find me in search">
            <select value={String(form.search_enabled !== false)} onChange={(event) => update("search_enabled", event.target.value === "true")}>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </Field>
          <Field label="Default privacy">
            <select value={form.privacy_setting} onChange={(event) => update("privacy_setting", event.target.value)}>
              <option value="private">Only me</option>
              <option value="friends">Friends only</option>
              <option value="public">Public</option>
            </select>
          </Field>
        </div>

        {status ? <p className="status">{status}</p> : null}

        <div className="actions">
          <button className="btn" disabled={saving} type="submit">{saving ? "Saving..." : "Save profile"}</button>
          <button className="btn secondary" type="button" onClick={onSignOut}>Sign out</button>
        </div>
      </form>
    </section>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="field">
      <span>{label}{required ? " *" : ""}</span>
      {children}
    </label>
  );
}

function Centered({ children, message }) {
  return (
    <main className="main" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <section className="panel" style={{ width: "min(440px, 100%)" }}>
        {children || <p className="muted">{message}</p>}
      </section>
    </main>
  );
}

function profileFromAuth(user) {
  const fullName = user.user_metadata?.full_name || user.user_metadata?.name || "";
  const [name, ...rest] = fullName.split(" ").filter(Boolean);
  return {
    ...EMPTY_PROFILE,
    name: name || "",
    surname: rest.join(" "),
    profile_photo_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || ""
  };
}

function profileFromRow(row) {
  return {
    ...EMPTY_PROFILE,
    ...row,
    birthday: row.birthday ? String(row.birthday).replaceAll("-", "/") : "",
    bodyweight: row.bodyweight ?? ""
  };
}

function isProfileComplete(profile) {
  return Boolean(profile?.name && profile?.bodyweight && profile?.country);
}

function bestByReps(lifts) {
  return lifts.reduce((best, lift) => {
    const reps = Number(lift.reps);
    if (!best[reps] || Number(lift.normalized_weight_kg) > Number(best[reps].normalized_weight_kg)) {
      best[reps] = lift;
    }
    return best;
  }, {});
}

function chartLiftValue(lift, mode) {
  return mode === "predicted" ? Number(lift.estimated_1rm_kg || lift.normalized_weight_kg) : Number(lift.normalized_weight_kg);
}

function formatChartDate(date) {
  const parts = String(date).split("-");
  if (parts.length !== 3) return String(date);
  return `${parts[1]}-${parts[2]}`;
}

function roundedWorkoutWeight(baseWeight, percentage, rounding) {
  const target = Number(baseWeight) * (Number(percentage) / 100);
  const step = Number(rounding) || 1;
  return Math.round(target / step) * step;
}

function bestTrainingBase(lifts, exerciseId, unit) {
  const bestKg = lifts
    .filter((lift) => lift.exercise_id === exerciseId)
    .reduce((best, lift) => Math.max(best, Number(lift.estimated_1rm_kg || lift.normalized_weight_kg || 0)), 0);
  if (!bestKg) return "";
  const value = unit === "lb" ? bestKg / 0.45359237 : bestKg;
  return Math.round(value * 10) / 10;
}

function workoutFormFromSource(workout, exerciseId, baseWeight, profile, existingRounds) {
  if (workout) {
    return {
      exercise_id: workout.exercise_id,
      base_weight: workout.base_weight,
      unit: workout.unit,
      rounding: workout.rounding,
      visibility: workout.visibility,
      notes: workout.notes || "",
      rounds: (workout.workout_rounds || []).map((round) => ({
        id: round.id,
        percentage: round.percentage,
        reps: round.reps || "",
        notes: round.notes || ""
      }))
    };
  }

  return {
    exercise_id: exerciseId,
    base_weight: baseWeight || "",
    unit: profile.preferred_unit,
    rounding: profile.preferred_unit === "kg" ? "2.5" : "5",
    visibility: profile.privacy_setting,
    notes: "",
    rounds: existingRounds?.length ? existingRounds : [
      { id: "round_1", percentage: 50, reps: "", notes: "" },
      { id: "round_2", percentage: 60, reps: "", notes: "" },
      { id: "round_3", percentage: 70, reps: "", notes: "" },
      { id: "round_4", percentage: 80, reps: "", notes: "" }
    ]
  };
}

function sortWorkoutRounds(workout) {
  return {
    ...workout,
    workout_rounds: [...(workout.workout_rounds || [])].sort((a, b) => Number(a.position) - Number(b.position))
  };
}

function cleanOptional(value) {
  const trimmed = String(value || "").trim();
  return trimmed || null;
}

function birthdayToIso(value) {
  if (!value) return null;
  const normalized = String(value).trim().replaceAll("/", "-");
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function countryName(code) {
  if (!code) return "";
  return COUNTRIES.find(([value]) => value === code)?.[1] || code;
}

function privacyLabel(value) {
  if (value === "private") return "Only me";
  if (value === "public") return "Public";
  return "Friends only";
}

function displayPerson(profile) {
  if (!profile) return "User";
  const primary = profile.nickname || [profile.name, profile.surname].filter(Boolean).join(" ");
  return primary || "User";
}
