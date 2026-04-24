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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      adaptive_adjustments: {
        Row: {
          adjustment_type: string
          applied: boolean
          created_at: string
          details: Json
          generation_id: string | null
          id: string
        }
        Insert: {
          adjustment_type: string
          applied?: boolean
          created_at?: string
          details?: Json
          generation_id?: string | null
          id?: string
        }
        Update: {
          adjustment_type?: string
          applied?: boolean
          created_at?: string
          details?: Json
          generation_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "adaptive_adjustments_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
        ]
      }
      adaptive_pressure_signals: {
        Row: {
          created_at: string
          details: Json
          generation_id: string | null
          id: string
          signal_type: string
          threshold: number | null
          triggered: boolean
          value: number
        }
        Insert: {
          created_at?: string
          details?: Json
          generation_id?: string | null
          id?: string
          signal_type: string
          threshold?: number | null
          triggered?: boolean
          value?: number
        }
        Update: {
          created_at?: string
          details?: Json
          generation_id?: string | null
          id?: string
          signal_type?: string
          threshold?: number | null
          triggered?: boolean
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "adaptive_pressure_signals_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
        ]
      }
      arbiter_decisions: {
        Row: {
          balance_a: number | null
          batch_name: string | null
          chosen_brain: string | null
          chosen_lineage: string | null
          chosen_score: number | null
          cluster: number | null
          coverage: number | null
          created_at: string
          decision: string
          id: string
          marginal_diversity: number | null
          memory_bias: number | null
          metadata: Json | null
          mutation_rate: number | null
          outcome_good: boolean | null
          outcome_hits: number | null
          outcome_quality: string | null
          rejected_brain: string | null
          rejected_lineage: string | null
          rejected_score: number | null
          scenario: string | null
          scores: Json | null
          slot: number | null
          source: string | null
        }
        Insert: {
          balance_a?: number | null
          batch_name?: string | null
          chosen_brain?: string | null
          chosen_lineage?: string | null
          chosen_score?: number | null
          cluster?: number | null
          coverage?: number | null
          created_at?: string
          decision: string
          id: string
          marginal_diversity?: number | null
          memory_bias?: number | null
          metadata?: Json | null
          mutation_rate?: number | null
          outcome_good?: boolean | null
          outcome_hits?: number | null
          outcome_quality?: string | null
          rejected_brain?: string | null
          rejected_lineage?: string | null
          rejected_score?: number | null
          scenario?: string | null
          scores?: Json | null
          slot?: number | null
          source?: string | null
        }
        Update: {
          balance_a?: number | null
          batch_name?: string | null
          chosen_brain?: string | null
          chosen_lineage?: string | null
          chosen_score?: number | null
          cluster?: number | null
          coverage?: number | null
          created_at?: string
          decision?: string
          id?: string
          marginal_diversity?: number | null
          memory_bias?: number | null
          metadata?: Json | null
          mutation_rate?: number | null
          outcome_good?: boolean | null
          outcome_hits?: number | null
          outcome_quality?: string | null
          rejected_brain?: string | null
          rejected_lineage?: string | null
          rejected_score?: number | null
          scenario?: string | null
          scores?: Json | null
          slot?: number | null
          source?: string | null
        }
        Relationships: []
      }
      generation_batches: {
        Row: {
          created_at: string
          dominant_lineage: string
          generation_id: string
          id: string
          metrics: Json
          name: string
          purpose: string
          score: number
        }
        Insert: {
          created_at?: string
          dominant_lineage: string
          generation_id: string
          id?: string
          metrics?: Json
          name: string
          purpose: string
          score?: number
        }
        Update: {
          created_at?: string
          dominant_lineage?: string
          generation_id?: string
          id?: string
          metrics?: Json
          name?: string
          purpose?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "generation_batches_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_games: {
        Row: {
          batch_id: string
          created_at: string
          id: string
          lineage: string
          metrics: Json
          numbers: number[]
          position: number
          score: number
        }
        Insert: {
          batch_id: string
          created_at?: string
          id?: string
          lineage: string
          metrics?: Json
          numbers: number[]
          position?: number
          score?: number
        }
        Update: {
          batch_id?: string
          created_at?: string
          id?: string
          lineage?: string
          metrics?: Json
          numbers?: number[]
          position?: number
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "generation_games_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "generation_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      generations: {
        Row: {
          created_at: string
          id: string
          label: string
          metrics: Json
          params: Json
          requested_count: number
          scenario: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          metrics?: Json
          params?: Json
          requested_count: number
          scenario: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          metrics?: Json
          params?: Json
          requested_count?: number
          scenario?: string
        }
        Relationships: []
      }
      lineage_history: {
        Row: {
          created_at: string
          dominance_score: number
          drift_magnitude: number | null
          drift_status: string | null
          exploration_rate: number | null
          generation_id: string | null
          id: string
          lineage: string
          stability_score: number | null
        }
        Insert: {
          created_at?: string
          dominance_score?: number
          drift_magnitude?: number | null
          drift_status?: string | null
          exploration_rate?: number | null
          generation_id?: string | null
          id?: string
          lineage: string
          stability_score?: number | null
        }
        Update: {
          created_at?: string
          dominance_score?: number
          drift_magnitude?: number | null
          drift_status?: string | null
          exploration_rate?: number | null
          generation_id?: string | null
          id?: string
          lineage?: string
          stability_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lineage_history_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
        ]
      }
      lotomania_draws: {
        Row: {
          contest_number: number
          created_at: string
          draw_date: string | null
          id: string
          numbers: number[]
        }
        Insert: {
          contest_number: number
          created_at?: string
          draw_date?: string | null
          id?: string
          numbers: number[]
        }
        Update: {
          contest_number?: number
          created_at?: string
          draw_date?: string | null
          id?: string
          numbers?: number[]
        }
        Relationships: []
      }
      scenario_transitions: {
        Row: {
          created_at: string
          from_scenario: string | null
          id: string
          reason: string
          to_scenario: string
          triggered_by: Json
        }
        Insert: {
          created_at?: string
          from_scenario?: string | null
          id?: string
          reason: string
          to_scenario: string
          triggered_by?: Json
        }
        Update: {
          created_at?: string
          from_scenario?: string | null
          id?: string
          reason?: string
          to_scenario?: string
          triggered_by?: Json
        }
        Relationships: []
      }
      territory_snapshots: {
        Row: {
          blind_zones: Json | null
          created_at: string
          drift_direction: string | null
          drift_magnitude: number | null
          generation_id: string | null
          id: string
          pressure_zones: Json | null
          saturation_level: number | null
          snapshot: Json
        }
        Insert: {
          blind_zones?: Json | null
          created_at?: string
          drift_direction?: string | null
          drift_magnitude?: number | null
          generation_id?: string | null
          id?: string
          pressure_zones?: Json | null
          saturation_level?: number | null
          snapshot?: Json
        }
        Update: {
          blind_zones?: Json | null
          created_at?: string
          drift_direction?: string | null
          drift_magnitude?: number | null
          generation_id?: string | null
          id?: string
          pressure_zones?: Json | null
          saturation_level?: number | null
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "territory_snapshots_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
