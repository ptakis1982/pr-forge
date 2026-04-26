"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const NAV = ["Home", "Add", "History", "Progress", "Friends", "Profile"];

export default function HomePage() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("Home");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

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
            <div className="brand-subtitle">{session.user.email}</div>
          </div>
        </div>
      </header>

      <main className="main">
        <section className="panel">
          <h1>{tab}</h1>
          <p className="muted">
            This is the deployable Next.js shell. The current prototype features will be migrated into these tabs next.
          </p>
          <button className="btn secondary" onClick={signOut}>Sign out</button>
        </section>
      </main>

      <nav className="bottom-nav" aria-label="Main navigation">
        {NAV.map((item) => (
          <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>
            <span>{item}</span>
          </button>
        ))}
      </nav>
    </div>
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
