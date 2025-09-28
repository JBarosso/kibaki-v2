import React, { useState } from 'react';
import TournamentBracket from './TournamentBracket';
import type { TMatch } from '@/lib/tournaments';
import { voteMatch } from '@/lib/tournaments';

export default function TournamentBracketClient({ matches, nameById }:{ matches: TMatch[]; nameById: (id:number|null)=>string; }) {
  const [items, setItems] = useState(matches);

  async function onVote(m: TMatch, choiceId: number) {
    const { error } = await voteMatch(m.id, choiceId);
    if (error) {
      // Replace alert with your toast system if available
      alert(error.message || 'Vote failed');
      return;
    }
    // Optional: optimistic mark or toast
    alert('Vote pris en compte');
  }

  return <TournamentBracket matches={items} onVote={onVote} characterNameById={nameById} />;
}
