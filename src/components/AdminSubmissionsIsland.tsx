import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type ProfileAdmin = { id: string; username: string | null; is_admin: boolean | null };

type PendingSub = {
  id: number;
  created_at: string;
  user_id: string | null;
  universe_id: number | null;
  proposed_universe: string | null;
  character_name: string | null;
  description: string | null;
  image_url: string | null;
  status: string;
  review_notes: string | null;
};

type WithUser = PendingSub & { username?: string | null };

export default function AdminSubmissionsIsland() {
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<WithUser[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [lastSuccessMsg, setLastSuccessMsg] = useState<string | null>(null);

  // Local notes, keyed by submission id
  const [notesById, setNotesById] = useState<Record<number, string>>({});

  const isSafeImageUrl = (u?: string | null) => {
    if (!u) return false;
    try {
      const x = new URL(u);
      return (x.protocol === 'https:' || x.protocol === 'http:');
    } catch { return false; }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setForbidden(null);
      setErrorMsg(null);
      setLastSuccessMsg(null);
      try {
        const { data: userRes, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userRes.user) {
          setForbidden('403');
          return;
        }

        const uid = userRes.user.id;
        const { data: profile, error: profErr } = await supabase
          .from('profiles')
          .select('id, username, is_admin')
          .eq('id', uid)
          .single();

        if (profErr || !profile || (profile as ProfileAdmin).is_admin !== true) {
          setForbidden('403');
          return;
        }

        // Load pending submissions (max 50)
        const { data, error } = await supabase
          .from('submissions')
          .select('id, created_at, user_id, universe_id, proposed_universe, character_name, description, image_url, status, review_notes')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(50);
        if (error) throw error;

        const pending = (data ?? []) as PendingSub[];

        // Build set of non-null user_ids
        const userIds = Array.from(
          new Set(
            pending
              .map((s) => s.user_id)
              .filter((id): id is string => typeof id === 'string' && !!id)
          )
        );

        // Fetch profiles in one query
        let idToUsername = new Map<string, string | null>();
        if (userIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, username')
            .in('id', userIds);
          if (profilesData) {
            idToUsername = new Map(profilesData.map((p: { id: string; username: string | null }) => [p.id, p.username]));
          }
        }

        const withUser: WithUser[] = pending.map((s) => ({
          ...s,
          username: s.user_id ? (idToUsername.get(s.user_id) ?? null) : null,
        }));

        setSubmissions(withUser);
      } catch (e: any) {
        setErrorMsg(e.message ?? String(e));
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const setNoteFor = (id: number, value: string) => {
    setNotesById((prev) => ({ ...prev, [id]: value }));
  };

  const onAccept = async (s: WithUser) => {
    setProcessingId(s.id);
    setErrorMsg(null);
    setLastSuccessMsg(null);
    try {
      const note = (notesById[s.id] ?? '').trim();
      const { data, error } = await supabase.rpc('admin_accept_submission', {
        p_submission_id: s.id,
        p_review_notes: note || null,
      });
      if (error) throw error;

      const characterId: number | undefined = (data as any)?.character_id ?? (Array.isArray(data) ? (data as any)[0]?.character_id : undefined);
      setLastSuccessMsg(
        typeof characterId === 'number'
          ? `Soumission #${s.id} acceptée. character_id=${characterId}.`
          : `Soumission #${s.id} acceptée.`
      );
      setSubmissions((prev) => prev.filter((row) => row.id !== s.id));
    } catch (e: any) {
      setErrorMsg(e.message ?? String(e));
    } finally {
      setProcessingId(null);
    }
  };

  const onReject = async (s: WithUser) => {
    setProcessingId(s.id);
    setErrorMsg(null);
    setLastSuccessMsg(null);
    try {
      const note = (notesById[s.id] ?? '').trim();
      const { error } = await supabase.rpc('admin_reject_submission', {
        p_submission_id: s.id,
        p_review_notes: note || null,
      });
      if (error) throw error;
      setLastSuccessMsg(`Soumission #${s.id} rejetée.`);
      setSubmissions((prev) => prev.filter((row) => row.id !== s.id));
    } catch (e: any) {
      setErrorMsg(e.message ?? String(e));
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Chargement…</div>;
  }

  if (forbidden) {
    return (
      <div className="mx-auto max-w-3xl p-6 mt-8 rounded-2xl border bg-white">
        <h2 className="text-xl font-semibold">403 — Accès refusé</h2>
        <p className="mt-2 text-sm text-gray-700">Cette page est réservée aux administrateurs.</p>
        <a className="mt-4 inline-flex items-center justify-center rounded border px-3 py-2" href="/">Retour à l'accueil</a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-4">
      <h2 className="mb-3 text-xl font-bold">Soumissions en attente</h2>
      {errorMsg ? (
        <div className="mb-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorMsg}</div>
      ) : null}
      {lastSuccessMsg ? (
        <div className="mb-3 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{lastSuccessMsg}</div>
      ) : null}

      {submissions.length === 0 ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-gray-600">Aucune soumission en attente.</div>
      ) : (
        <div className="space-y-4">
          {submissions.map((s) => {
            const label = s.username ? `@${s.username}` : (s.user_id ? `${s.user_id.slice(0, 8)}…` : '—');
            return (
              <div key={s.id} className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {isSafeImageUrl(s.image_url) && (
                      <img
                        src={s.image_url!}
                        alt={s.character_name ?? 'image'}
                        className="h-16 w-16 rounded-md object-cover border"
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <div>
                      <div className="text-sm text-gray-500">#{s.id} • {new Date(s.created_at).toLocaleString()}</div>
                      <div className="mt-1 text-base font-semibold">{s.character_name}</div>
                      <div className="mt-1 text-sm text-gray-700">{s.description}</div>
                      <div className="mt-1 text-xs text-gray-500">
                        Utilisateur: {s.username ? (
                          <a href={`/u/${encodeURIComponent(s.username)}`} className="text-gray-600 hover:underline">{label}</a>
                        ) : (
                          <span className="text-gray-500">{label}</span>
                        )}
                        {s.universe_id ? ` • Univers #${s.universe_id}` : ''}
                        {s.proposed_universe ? ` • Proposé: ${s.proposed_universe}` : ''}
                      </div>
                      {s.image_url ? (
                        <div className="mt-2">
                          <a className="text-xs underline" href={s.image_url} target="_blank" rel="noreferrer">Voir l'image</a>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="w-full sm:w-64">
                    <label className="block text-xs font-medium text-gray-600">Notes de revue (optionnel)</label>
                    <textarea
                      className="mt-1 w-full rounded border px-2 py-2 text-sm"
                      rows={3}
                      placeholder="Notes internes…"
                      value={notesById[s.id] ?? (s.review_notes ?? '')}
                      onChange={(e) => setNoteFor(s.id, e.target.value)}
                      disabled={processingId === s.id}
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        className="inline-flex items-center justify-center rounded bg-black px-3 py-2 text-white disabled:opacity-60"
                        onClick={() => onAccept(s)}
                        disabled={processingId === s.id}
                      >
                        {processingId === s.id ? 'Patientez…' : 'Accepter'}
                      </button>
                      <button
                        className="inline-flex items-center justify-center rounded border px-3 py-2 disabled:opacity-60"
                        onClick={() => onReject(s)}
                        disabled={processingId === s.id}
                      >
                        {processingId === s.id ? 'Patientez…' : 'Rejeter'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


