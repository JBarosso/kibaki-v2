export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      characters: {
        Row: {
          created_at: string
          description: string | null
          elo: number
          id: number
          image_url: string | null
          losses: number
          name: string
          slug: string
          universe_id: number
          updated_at: string
          wins: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          elo?: number
          id?: number
          image_url?: string | null
          losses?: number
          name: string
          slug: string
          universe_id: number
          updated_at?: string
          wins?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          elo?: number
          id?: number
          image_url?: string | null
          losses?: number
          name?: string
          slug?: string
          universe_id?: number
          updated_at?: string
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "characters_universe_id_fkey"
            columns: ["universe_id"]
            isOneToOne: false
            referencedRelation: "univers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          is_admin: boolean
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          id: string
          is_admin?: boolean
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          is_admin?: boolean
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      submissions: {
        Row: {
          character_name: string
          created_at: string
          description: string | null
          id: number
          image_url: string | null
          proposed_universe: string | null
          review_notes: string | null
          reviewed_by: string | null
          status: string
          universe_id: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          character_name: string
          created_at?: string
          description?: string | null
          id?: number
          image_url?: string | null
          proposed_universe?: string | null
          review_notes?: string | null
          reviewed_by?: string | null
          status?: string
          universe_id?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          character_name?: string
          created_at?: string
          description?: string | null
          id?: number
          image_url?: string | null
          proposed_universe?: string | null
          review_notes?: string | null
          reviewed_by?: string | null
          status?: string
          universe_id?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_universe_id_fkey"
            columns: ["universe_id"]
            isOneToOne: false
            referencedRelation: "univers"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_matches: {
        Row: {
          char1_id: number | null
          char1_votes: number
          char2_id: number | null
          char2_votes: number
          closes_at: string
          id: string
          match_number: number
          opens_at: string
          round: number
          status: string
          tournament_id: string
          winner_id: number | null
        }
        Insert: {
          char1_id?: number | null
          char1_votes?: number
          char2_id?: number | null
          char2_votes?: number
          closes_at: string
          id?: string
          match_number: number
          opens_at: string
          round: number
          status?: string
          tournament_id: string
          winner_id?: number | null
        }
        Update: {
          char1_id?: number | null
          char1_votes?: number
          char2_id?: number | null
          char2_votes?: number
          closes_at?: string
          id?: string
          match_number?: number
          opens_at?: string
          round?: number
          status?: string
          tournament_id?: string
          winner_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_matches_char1_id_fkey"
            columns: ["char1_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_char2_id_fkey"
            columns: ["char2_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_participants: {
        Row: {
          character_id: number
          seed: number
          tournament_id: string
        }
        Insert: {
          character_id: number
          seed: number
          tournament_id: string
        }
        Update: {
          character_id?: number
          seed?: number
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_participants_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_participants_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_votes: {
        Row: {
          choice_id: number
          client_ip: unknown
          created_at: string
          id: number
          match_id: string
          user_agent: string | null
          voter_user_id: string | null
        }
        Insert: {
          choice_id: number
          client_ip?: unknown
          created_at?: string
          id?: never
          match_id: string
          user_agent?: string | null
          voter_user_id?: string | null
        }
        Update: {
          choice_id?: number
          client_ip?: unknown
          created_at?: string
          id?: never
          match_id?: string
          user_agent?: string | null
          voter_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_votes_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "tournament_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_votes_voter_user_id_fkey"
            columns: ["voter_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          completed_at: string | null
          created_by: string
          id: string
          name: string
          round_duration_minutes: number
          started_at: string
          status: string
          universe_id: number | null
        }
        Insert: {
          completed_at?: string | null
          created_by: string
          id?: string
          name: string
          round_duration_minutes: number
          started_at?: string
          status?: string
          universe_id?: number | null
        }
        Update: {
          completed_at?: string | null
          created_by?: string
          id?: string
          name?: string
          round_duration_minutes?: number
          started_at?: string
          status?: string
          universe_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_universe_id_fkey"
            columns: ["universe_id"]
            isOneToOne: false
            referencedRelation: "univers"
            referencedColumns: ["id"]
          },
        ]
      }
      univers: {
        Row: {
          created_at: string
          description: string | null
          id: number
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: number
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: number
          name?: string
          slug?: string
        }
        Relationships: []
      }
      user_seen_pairs: {
        Row: {
          pair_key: string
          seen_at: string
          user_id: string
        }
        Insert: {
          pair_key: string
          seen_at?: string
          user_id: string
        }
        Update: {
          pair_key?: string
          seen_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_seen_pairs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      votes: {
        Row: {
          client_ip: unknown
          created_at: string
          id: number
          loser_id: number
          nonce: string | null
          pair_key: string | null
          user_agent: string | null
          voter_user_id: string | null
          winner_id: number
        }
        Insert: {
          client_ip?: unknown
          created_at?: string
          id?: number
          loser_id: number
          nonce?: string | null
          pair_key?: string | null
          user_agent?: string | null
          voter_user_id?: string | null
          winner_id: number
        }
        Update: {
          client_ip?: unknown
          created_at?: string
          id?: number
          loser_id?: number
          nonce?: string | null
          pair_key?: string | null
          user_agent?: string | null
          voter_user_id?: string | null
          winner_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "votes_loser_id_fkey"
            columns: ["loser_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_accept_submission: {
        Args: { p_review_notes?: string; p_submission_id: number }
        Returns: {
          character_id: number
          created: boolean
          universe_id: number
        }[]
      }
      admin_reject_submission: {
        Args: { p_review_notes?: string; p_submission_id: number }
        Returns: undefined
      }
      advance_tournament_if_ready: {
        Args: { p_tournament_id: string }
        Returns: undefined
      }
      advance_tournament_round: {
        Args: { p_tournament_id: string }
        Returns: undefined
      }
      cron_tick_all: { Args: never; Returns: number }
      is_admin:
        | { Args: { p_uid: string }; Returns: boolean }
        | { Args: never; Returns: boolean }
      next_pow2: { Args: { p_n: number }; Returns: number }
      slugify: { Args: { t: string }; Returns: string }
      start_tournament: {
        Args: { p_tournament_id: string }
        Returns: undefined
      }
      tournament_cancel: {
        Args: { p_tournament_id: string }
        Returns: undefined
      }
      tournament_create: {
        Args: {
          p_name?: string
          p_participants?: number[]
          p_round_minutes?: number
          p_start?: string
          p_universe_id?: number
        }
        Returns: string
      }
      tournament_delete: {
        Args: { p_tournament_id: string }
        Returns: undefined
      }
      tournament_finish_now: {
        Args: { p_tournament_id: string }
        Returns: undefined
      }
      tournament_purge_older_than: {
        Args: { p_days?: number }
        Returns: number
      }
      tournament_rounds_count: { Args: { p_n: number }; Returns: number }
      tournament_tick: { Args: { p_tournament_id: string }; Returns: undefined }
      tournament_tick_internal: {
        Args: { p_tournament_id: string }
        Returns: undefined
      }
      vote_apply: {
        Args: {
          p_client_ip?: unknown
          p_ip_max?: number
          p_ip_window_seconds?: number
          p_k_factor?: number
          p_loser_id: number
          p_nonce?: string
          p_user_agent?: string
          p_user_id?: string
          p_user_max?: number
          p_user_window_seconds?: number
          p_winner_id: number
        }
        Returns: {
          already_processed: boolean
          loser_elo: number
          loser_id: number
          loser_losses: number
          rate_limited: boolean
          vote_id: number
          winner_elo: number
          winner_id: number
          winner_wins: number
        }[]
      }
      vote_tournament_match: {
        Args: { p_match_id: string; p_winner_id: number }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

