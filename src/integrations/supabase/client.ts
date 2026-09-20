// Custom local mock proxy client for Java Spring Boot backend offboarding
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL || 'http://localhost:8081';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY || 'mock-key';

// Initialize real Supabase client if not in mock environment
const isMockEnv = SUPABASE_URL === 'http://localhost:8081' || SUPABASE_ANON_KEY === 'mock-key';
export const isMockEnvClient = isMockEnv;
const realSupabase = !isMockEnv ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

function parseJsonFields(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(parseJsonFields);
  }
  if (typeof obj === 'object') {
    const newObj: any = {};
    for (const key of Object.keys(obj)) {
      let val = obj[key];
      if (typeof val === 'string' && ((val.startsWith('{') && val.endsWith('}')) || (val.startsWith('[') && val.endsWith(']')))) {
        try {
          val = JSON.parse(val);
        } catch (e) {
          // keep as string
        }
      }
      newObj[key] = parseJsonFields(val);
    }
    return newObj;
  }
  return obj;
}

async function executeDbCall(table: string, action: string, payload: any) {
  const token = localStorage.getItem('sb_token');
  const res = await fetch(`${SUPABASE_URL}/api/db/${table}/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  try {
    const data = JSON.parse(text);
    if (!res.ok) return { data: null, error: { message: data.error || 'Request failed', code: (data as any).code, status: res.status } };
    // Normalize single/maybeSingle empty results: backend returns null, PostgREST-like callers expect null data
    return { data: parseJsonFields(data), error: null };
  } catch {
    return { data: null, error: { message: text || 'Raw response error' } };
  }
}

class CustomSupabaseClient {
  auth = {
    signUp: async ({ email, password, options }: any) => {
      if (realSupabase) {
        return await realSupabase.auth.signUp({ email, password, options });
      }
      const res = await fetch(`${SUPABASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          role: window.location.pathname.includes('recruiter') ? 'recruiter' : 'student'
        }),
      });
      const data = await res.json();
      if (!res.ok) return { data: null, error: { message: data.error } };
      localStorage.setItem('sb_token', data.token);
      return { data: { user: { id: data.userId, email } }, error: null };
    },
    signInWithPassword: async ({ email, password }: any) => {
      if (realSupabase) {
        return await realSupabase.auth.signInWithPassword({ email, password });
      }
      const res = await fetch(`${SUPABASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) return { data: null, error: { message: data.error } };
      localStorage.setItem('sb_token', data.token);
      return { data: { user: { id: data.userId, email } }, error: null };
    },
    signInWithOAuth: async (options: any) => {
      if (realSupabase) {
        return await realSupabase.auth.signInWithOAuth(options);
      }
      // Local mock backend has no OAuth provider. Fail fast with a clear
      // message instead of redirecting to a callback that can never succeed
      // (previously caused login -> callback -> login loop).
      return { data: null, error: { message: 'Google sign-in requires Supabase Cloud. Use demo accounts in local mode (see demo_accounts.txt).' } };
    },
    signInWithGoogleIdToken: async (idToken: string, role?: string) => {
      if (realSupabase) {
        // Supabase Cloud mode uses OAuth redirect, not ID tokens.
        return { data: null, error: { message: 'ID-token sign-in is for local database mode only.' } };
      }
      const resolvedRole = role || (window.location.pathname.includes('recruiter') ? 'recruiter' : 'student');
      if (!idToken) return { data: null, error: { message: 'Missing Google credential.' } };
      try {
        const res = await fetch(`${SUPABASE_URL}/api/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken, role: resolvedRole }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { data: null, error: { message: (data as any).error || 'Google sign-in failed' } };
        localStorage.setItem('sb_token', (data as any).token);
        try { localStorage.removeItem('sb_recovery'); } catch { /* ignore */ }
        return { data: { user: { id: (data as any).userId, email: '' } }, error: null };
      } catch (e: any) {
        return { data: null, error: { message: e?.message || 'Google sign-in failed' } };
      }
    },
    resetPasswordForEmail: async (email: string, _options?: any) => {
      if (realSupabase) {
        return await (realSupabase.auth as any).resetPasswordForEmail(email, _options);
      }
      if (!email || !String(email).includes('@')) {
        return { data: null, error: { message: 'Enter a valid email address.' } };
      }
      // Local DB has no SMTP; notify backend (no-op) and record intent so the
      // Reset page can proceed. Real email sending needs Supabase Cloud.
      try {
        await fetch(`${SUPABASE_URL}/api/auth/forgot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
      } catch { /* ignore network failure, still allow demo flow */ }
      try { localStorage.setItem('sb_recovery', JSON.stringify({ email, at: Date.now() })); } catch { /* ignore */ }
      return { data: {}, error: null };
    },
    updateUser: async (attrs: any) => {
      if (realSupabase) {
        return await (realSupabase.auth as any).updateUser(attrs);
      }
      const token = localStorage.getItem('sb_token');
      const recovery = localStorage.getItem('sb_recovery');
      if (!token && !recovery) {
        return { data: null, error: { message: 'No active session. Request a reset link first (demo mode).' } };
      }
      const pw = attrs?.password;
      if (!pw || String(pw).length < 8) {
        return { data: null, error: { message: 'Password must be at least 8 characters.' } };
      }
      // Persist the new password when signed in (local DB endpoint).
      if (token) {
        try {
          const res = await fetch(`${SUPABASE_URL}/api/auth/password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ newPassword: pw }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) return { data: null, error: { message: (data as any).error || 'Password update failed' } };
          try { localStorage.removeItem('sb_recovery'); } catch { /* ignore */ }
          return { data: { user: null }, error: null };
        } catch (e: any) {
          return { data: null, error: { message: e?.message || 'Password update failed' } };
        }
      }
      try { localStorage.removeItem('sb_recovery'); } catch { /* ignore */ }
      return { data: { user: null }, error: null };
    },
    getUser: async () => {
      if (realSupabase) {
        return await realSupabase.auth.getUser();
      }
      const token = localStorage.getItem('sb_token');
      if (!token) return { data: { user: null }, error: null };
      try {
        const res = await fetch(`${SUPABASE_URL}/api/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          return { data: { user: { id: data.id, email: data.email } }, error: null };
        }
      } catch (e) {}
      localStorage.removeItem('sb_token');
      return { data: { user: null }, error: null };
    },
    signOut: async () => {
      if (realSupabase) {
        await realSupabase.auth.signOut();
      }
      localStorage.removeItem('sb_token');
      return { error: null };
    },
    onAuthStateChange: (callback: any) => {
      if (realSupabase) {
        return realSupabase.auth.onAuthStateChange(callback);
      }
      return { data: { subscription: { unsubscribe: () => {} } } };
    },
    getSession: async () => {
      if (realSupabase) {
        return await realSupabase.auth.getSession();
      }
      const token = localStorage.getItem('sb_token');
      if (!token) return { data: { session: null }, error: null };
      try {
        const res = await fetch(`${SUPABASE_URL}/api/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          return { data: { session: { user: { id: data.id, email: data.email }, access_token: token } }, error: null };
        }
      } catch (e) {}
      localStorage.removeItem('sb_token');
      return { data: { session: null }, error: null };
    }
  };

  storage = {
    from: (bucket: string) => {
      if (realSupabase) {
        return realSupabase.storage.from(bucket);
      }
      return {
        upload: async (path: string, file: File, options?: any) => {
          const formData = new FormData();
          formData.append('file', file);
          
          const token = localStorage.getItem('sb_token');
          try {
            const res = await fetch(`${SUPABASE_URL}/api/storage/upload`, {
              method: 'POST',
              headers: {
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
              },
              body: formData
            });
            const data = await res.json();
            if (!res.ok) return { data: null, error: { message: data.error || 'Upload failed' } };
            return { data: { path: data.path }, error: null };
          } catch (err: any) {
            return { data: null, error: { message: err.message } };
          }
        }
      };
    }
  };

  functions = {
    invoke: async (name: string, options?: any) => {
      if (realSupabase) {
        return await realSupabase.functions.invoke(name, options);
      }
      const token = localStorage.getItem('sb_token');
      const body = options?.body || {};
      try {
        const res = await fetch(`${SUPABASE_URL}/api/${name}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify(body)
        });
        const text = await res.text();
        let data: any;
        try {
          data = JSON.parse(text);
        } catch {
          return { data: null, error: { message: text || `AI function '${name}' returned non-JSON response (HTTP ${res.status})` } };
        }
        if (!res.ok) return { data: null, error: { message: data.error || data.message || `Invocation failed (HTTP ${res.status})` } };
        if (data && data.error && typeof data.error === 'string') {
          return { data: null, error: { message: data.error } };
        }
        return { data, error: null };
      } catch (err: any) {
        return { data: null, error: { message: err.message || `Failed to invoke '${name}'` } };
      }
    }
  };

  channel(name: string) {
    if (realSupabase) {
      return realSupabase.channel(name);
    }
    const mockChannel = {
      on(event: string, filter: any, callback: any) {
        return this;
      },
      subscribe() {
        return {
          unsubscribe() {
            return {};
          }
        };
      }
    };
    return mockChannel;
  }

  removeChannel(channel: any) {
    if (realSupabase) {
      return realSupabase.removeChannel(channel);
    }
  }

  from(table: string) {
    if (realSupabase) {
      return realSupabase.from(table);
    }
    // Single stateful builder: `then` reads from `this` so chained
    // select/eq/limit/order/single/maybeSingle are all honored.
    // Previously `{...builder, then: ...builder._x}` copied primitives by
    // value and silently dropped everything except filters.
    const builder: any = {
      _table: table,
      _select: '*',
      _filters: [] as any[],
      _limit: null as number | null,
      _order: null as string | null,
      _single: false,
      _maybeSingle: false,

      select(columns = '*') {
        this._select = columns;
        return this;
      },
      eq(column: string, value: any) {
        this._filters.push({ type: 'eq', column, value });
        return this;
      },
      neq(column: string, value: any) {
        this._filters.push({ type: 'neq', column, value });
        return this;
      },
      in(column: string, values: any[]) {
        this._filters.push({ type: 'in', column, values });
        return this;
      },
      gte(column: string, value: any) {
        this._filters.push({ type: 'gte', column, value });
        return this;
      },
      lte(column: string, value: any) {
        this._filters.push({ type: 'lte', column, value });
        return this;
      },
      gt(column: string, value: any) {
        this._filters.push({ type: 'gt', column, value });
        return this;
      },
      lt(column: string, value: any) {
        this._filters.push({ type: 'lt', column, value });
        return this;
      },
      like(column: string, value: any) {
        this._filters.push({ type: 'like', column, value });
        return this;
      },
      ilike(column: string, value: any) {
        this._filters.push({ type: 'ilike', column, value });
        return this;
      },
      is(column: string, value: any) {
        this._filters.push({ type: 'is', column, value });
        return this;
      },
      or(filters: string) {
        this._filters.push({ type: 'or', filters });
        return this;
      },
      limit(n: number) {
        this._limit = n;
        return this;
      },
      order(column: string, { ascending = true } = {}) {
        this._order = `${column} ${ascending ? 'ASC' : 'DESC'}`;
        return this;
      },
      single() {
        this._single = true;
        return this;
      },
      maybeSingle() {
        this._maybeSingle = true;
        return this;
      },
      insert(rows: any) {
        // Chainable to match Supabase JS: .insert().select().single()
        // Backend returns the created object; select/single are no-ops in mock.
        const self = this;
        const promise = executeDbCall(self._table, 'insert', { rows });
        const chain: any = {
          select(_cols = '*') { return chain; },
          single() { return chain; },
          maybeSingle() { return chain; },
          then(onfulfilled: any, onrejected?: any) { return promise.then(onfulfilled, onrejected); },
          catch(onrejected: any) { return promise.catch(onrejected); },
        };
        return chain;
      },
      update(values: any) {
        return executeDbCall(this._table, 'update', { values, filters: this._filters });
      },
      delete() {
        return executeDbCall(this._table, 'delete', { filters: this._filters });
      },
      then(onfulfilled: any, onrejected?: any) {
        const res = executeDbCall(this._table, 'select', {
          select: this._select,
          filters: this._filters,
          limit: this._limit,
          order: this._order,
          single: this._single,
          maybeSingle: this._maybeSingle
        });
        return res.then(onfulfilled, onrejected);
      }
    };

    return builder;
  }
}

export const supabase = new CustomSupabaseClient() as any;