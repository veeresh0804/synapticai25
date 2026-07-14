// Custom local mock proxy client for Java Spring Boot backend offboarding
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL || 'http://localhost:8081';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || 'mock-key';

// Initialize real Supabase client if not in mock environment
const isMockEnv = SUPABASE_URL === 'http://localhost:8081' || SUPABASE_ANON_KEY === 'mock-key';
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
    if (!res.ok) return { data: null, error: { message: data.error || 'Request failed' } };
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
      // Mock flow redirect to simulate callback URL landing
      const redirectToUrl = options?.options?.redirectTo;
      if (redirectToUrl) {
        window.location.href = redirectToUrl;
      }
      return { data: {}, error: null };
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
    const builder = {
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
        return executeDbCall(this._table, 'insert', { rows });
      },
      update(values: any) {
        return executeDbCall(this._table, 'update', { values, filters: this._filters });
      },
      delete() {
        return executeDbCall(this._table, 'delete', { filters: this._filters });
      }
    };

    const thenable = {
      ...builder,
      then: async (onfulfilled: any) => {
        const res = await executeDbCall(builder._table, 'select', {
          select: builder._select,
          filters: builder._filters,
          limit: builder._limit,
          order: builder._order,
          single: builder._single,
          maybeSingle: builder._maybeSingle
        });
        return onfulfilled(res);
      }
    };

    return thenable;
  }
}

export const supabase = new CustomSupabaseClient() as any;