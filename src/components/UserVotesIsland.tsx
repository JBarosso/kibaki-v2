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
      <div className="space-y-4">
        <div className="h-10 w-44 animate-pulse rounded bg-gray-200" />
        <div className="space-y-3">
          <div className="h-20 animate-pulse rounded-2xl bg-gray-200" />
          <div className="h-20 animate-pulse rounded-2xl bg-gray-200" />
          <div className="h-20 animate-pulse rounded-2xl bg-gray-200" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border bg-white p-4 text-sm text-red-600">{error}</div>
    );
  }

  return <UserVotesList votes={votes ?? []} username={username} />;
}


