import React from 'react';
import type { UserVote } from '@/lib/userVotes';
import UserVoteItem from '@/components/UserVoteItem';

export default function UserVotesList({ votes, username }: { votes: UserVote[]; username: string }) {
  if (!votes || votes.length === 0) {
    return (
      <div className="rounded-2xl border bg-white p-6 text-center text-sm text-gray-600">
        No votes yet.
      </div>
    );
  }

  const normalized = [...votes]
    .filter((v) => v && v.created_at)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 20);

  return (
    <div className="space-y-4">
      {normalized.map((v) => (
        <UserVoteItem key={v.id} vote={v} />
      ))}
    </div>
  );
}


