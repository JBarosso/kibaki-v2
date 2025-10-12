import React, { useEffect, useState } from 'react';
import { fetchLastVotesByUsername, type UserVote } from '@/lib/userVotes';
import UserVotesList from '@/components/UserVotesList';

export default function UserVotesIsland({ username }: { username: string }) {
  const [votes, setVotes] = useState<UserVote[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchLastVotesByUsername(username);
        if (cancelled) return;
        setVotes(data);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (username) run();
    return () => {
      cancelled = true;
    };
  }, [username]);

  if (loading) {
    return (
      <div className="user-votes-island">
        <div className="user-votes-island__loading">
          <div className="user-votes-island__skeleton">
            <div className="user-votes-island__skeleton-item" />
          </div>
          <div className="user-votes-island__skeleton">
            <div className="user-votes-island__skeleton-item" />
            <div className="user-votes-island__skeleton-item" />
            <div className="user-votes-island__skeleton-item" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="user-votes-island">
        <div className="user-votes-island__error">{error}</div>
      </div>
    );
  }

  return (
    <div className="user-votes-island">
      <UserVotesList votes={votes ?? []} username={username} />
    </div>
  );
}


