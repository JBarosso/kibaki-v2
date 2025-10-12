import React from 'react';
import type { UserVote } from '@/lib/userVotes';
import UserVoteItem from '@/components/UserVoteItem';

export default function UserVotesList({ votes, username }: { votes: UserVote[]; username: string }) {
  if (!votes || votes.length === 0) {
    return (
      <div className="user-votes-list user-votes-list--empty">
        No votes yet.
      </div>
    );
  }

  const normalized = [...votes]
    .filter((v) => v && v.created_at)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 20);

  return (
    <div className="user-votes-list">
      {normalized.map((v) => (
        <UserVoteItem key={v.id} vote={v} />
      ))}
    </div>
  );
}


