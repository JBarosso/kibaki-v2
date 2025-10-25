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
    return (
      <div className="admin-submissions">
        <div className="admin-submissions__loading">Chargement…</div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="admin-submissions">
        <div className="admin-submissions__forbidden">
          <h2 className="admin-submissions__forbidden-title">403 — Accès refusé</h2>
          <p className="admin-submissions__forbidden-message">Cette page est réservée aux administrateurs.</p>
          <a href="/" className="form-button form-button--primary">Retour à l'accueil</a>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-submissions">
      <div className="admin-submissions__wrapper">
        <h2 className="admin-submissions__title">Soumissions en attente</h2>
        {errorMsg ? (
          <div className="admin-submissions__error">{errorMsg}</div>
        ) : null}
        {lastSuccessMsg ? (
          <div className="admin-submissions__success">{lastSuccessMsg}</div>
        ) : null}

        {submissions.length === 0 ? (
          <div className="admin-submissions__empty">Aucune soumission en attente.</div>
        ) : (
          <div className="admin-submissions__list">
            {submissions.map((s) => {
              const label = s.username ? `@${s.username}` : (s.user_id ? `${s.user_id.slice(0, 8)}…` : '—');
              return (
                <div key={s.id} className="admin-submissions__item">
                  <div className="admin-submissions__item-content">
                    <div className="admin-submissions__item-left">
                      {isSafeImageUrl(s.image_url) && (
                        <img
                          src={s.image_url!}
                          alt={s.character_name ?? 'image'}
                          className="admin-submissions__item-image"
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        />
                      )}
                      <div className="admin-submissions__item-info">
                        <div className="admin-submissions__item-id">#{s.id} • {new Date(s.created_at).toLocaleString()}</div>
                        <div className="admin-submissions__item-name">{s.character_name}</div>
                        <div className="admin-submissions__item-description">{s.description}</div>
                        <div className="admin-submissions__item-meta">
                          Utilisateur:{' '}
                          {s.username ? (
                            <a
                              href={`/u/${encodeURIComponent(s.username)}`}
                              className="admin-submissions__item-username-link"
                            >
                              {label}
                            </a>
                          ) : (
                            <span className="admin-submissions__item-username">{label}</span>
                          )}
                          {s.universe_id ? ` • Univers #${s.universe_id}` : ''}
                          {s.proposed_universe ? ` • Proposé: ${s.proposed_universe}` : ''}
                        </div>
                        {s.image_url ? (
                          <div className="admin-submissions__item-image-link">
                            <a
                              className="admin-submissions__item-username-link"
                              href={s.image_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Voir l'image
                            </a>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="admin-submissions__item-right">
                      <label className="admin-submissions__notes-label">Notes de revue (optionnel)</label>
                      <textarea
                        className="form-textarea"
                        rows={3}
                        placeholder="Notes internes…"
                        value={notesById[s.id] ?? (s.review_notes ?? '')}
                        onChange={(e) => setNoteFor(s.id, e.target.value)}
                        disabled={processingId === s.id}
                      />
                      <div className="admin-submissions__item-actions">
                        <button
                          className="form-button form-button--success"
                          onClick={() => onAccept(s)}
                          disabled={processingId === s.id}
                        >
                          {processingId === s.id ? 'Patientez…' : 'Accepter'}
                        </button>
                        <button
                          className="form-button form-button--danger"
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
    </div>
  );
}


