"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

const NAV = ["Home", "Add", "History", "Progress", "Friends", "Profile"];

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("Home");
  const [status, setStatus] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setSession(data.session);
      if (data.session) await loadProfile(data.session);
      setLoading(false);
    }

    init();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      setStatus("");
      if (nextSession) {
        await loadProfile(nextSession);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function loadProfile(currentSession = session) {
    if (!currentSession?.user) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", currentSession.user.id)
      .maybeSingle();

    if (error) {
      setStatus(error.message);
      setProfile(profileFromAuth(currentSession.user));
      return;
    }

    setProfile(data ? profileFromRow(data) : profileFromAuth(currentSession.user));
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
          <Dashboard tab={tab} profile={profile} onSignOut={signOut} />
        )}
      </main>

      {profileComplete && (
        <nav className="bottom-nav" aria-label="Main navigation">
          {NAV.map((item) => (
            <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>
              <span>{item}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

function Dashboard({ tab, profile, onSignOut }) {
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
        <button className="btn secondary" onClick={onSignOut}>Sign out</button>
      </section>
    </div>
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
  return COUNTRIES.find(([value]) => value === code)?.[1] || code;
}

function privacyLabel(value) {
  if (value === "private") return "Only me";
  if (value === "public") return "Public";
  return "Friends only";
}
