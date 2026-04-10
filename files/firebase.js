// ============================================================
//  firebase.js  ← named firebase.js for compatibility, but
//  this file actually initialises the SUPABASE client.
//  (The dashboard imports it as "firebase.js")
// ============================================================

/**
 * 🔧 CONFIGURATION — paste your Supabase project details here
 *
 * Steps to get these values:
 * 1. Go to https://supabase.com and sign up (free)
 * 2. Create a new project
 * 3. Go to Project Settings → API
 * 4. Copy "Project URL" into SUPABASE_URL below
 * 5. Copy "anon public" key into SUPABASE_ANON_KEY below
 */

export const SUPABASE_URL  = "https://YOUR_PROJECT_ID.supabase.co";
export const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_PUBLIC_KEY";

// Storage bucket name — create this in Supabase Storage dashboard
export const STORAGE_BUCKET = "user-files";

// -------------------------------------------------------
// Supabase JS v2 loaded via CDN in each HTML file.
// We import createClient from the global window object.
// -------------------------------------------------------

let _supabase = null;

/**
 * Returns (and lazily creates) the singleton Supabase client.
 * Safe to call many times.
 */
export function getSupabase() {
  if (_supabase) return _supabase;

  // The CDN bundle exposes supabase globally as window.supabase
  if (typeof window !== "undefined" && window.supabase) {
    _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,        // keeps user logged in across page reloads
        autoRefreshToken: true,      // silently refreshes JWT before expiry
        detectSessionInUrl: true,    // handles OAuth redirect tokens in URL
      },
    });
  } else {
    console.error("Supabase SDK not loaded. Make sure the CDN script is in the HTML <head>.");
  }

  return _supabase;
}

// -------------------------------------------------------
// Auth helpers
// -------------------------------------------------------

/** Sign up a new user with email + password */
export async function signUp(email, password, displayName) {
  const sb = getSupabase();
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: displayName },  // stored in user_metadata
    },
  });
  if (error) throw error;
  return data;
}

/** Sign in an existing user */
export async function signIn(email, password) {
  const sb = getSupabase();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/** Sign out the current user */
export async function signOut() {
  const sb = getSupabase();
  const { error } = await sb.auth.signOut();
  if (error) throw error;
}

/** Get the currently signed-in user (or null) */
export async function getCurrentUser() {
  const sb = getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

/** Listen for auth state changes */
export function onAuthChange(callback) {
  const sb = getSupabase();
  return sb.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
}
