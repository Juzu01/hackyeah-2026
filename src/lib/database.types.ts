// Generated from the Supabase schema (supabase/migrations). Regenerate after schema changes; don't edit by hand.

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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      body_parts: {
        Row: {
          id: string
          info_key: string
          latin: string
          name_pl: string
          side: string
          sort_order: number
          system: string
        }
        Insert: {
          id: string
          info_key: string
          latin: string
          name_pl: string
          side: string
          sort_order?: number
          system: string
        }
        Update: {
          id?: string
          info_key?: string
          latin?: string
          name_pl?: string
          side?: string
          sort_order?: number
          system?: string
        }
        Relationships: []
      }
      pain_report_types: {
        Row: {
          pain_type_id: string
          report_id: string
        }
        Insert: {
          pain_type_id: string
          report_id: string
        }
        Update: {
          pain_type_id?: string
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pain_report_types_pain_type_id_fkey"
            columns: ["pain_type_id"]
            isOneToOne: false
            referencedRelation: "pain_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pain_report_types_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "pain_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      pain_reports: {
        Row: {
          body_part_id: string
          created_at: string
          id: string
          intensity: number
          is_demo: boolean
          note: string | null
          reported_at: string
          user_id: string
        }
        Insert: {
          body_part_id: string
          created_at?: string
          id?: string
          intensity: number
          is_demo?: boolean
          note?: string | null
          reported_at?: string
          user_id?: string
        }
        Update: {
          body_part_id?: string
          created_at?: string
          id?: string
          intensity?: number
          is_demo?: boolean
          note?: string | null
          reported_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pain_types: {
        Row: {
          id: string
          name_pl: string
          sort_order: number
        }
        Insert: {
          id: string
          name_pl: string
          sort_order?: number
        }
        Update: {
          id?: string
          name_pl?: string
          sort_order?: number
        }
        Relationships: []
      }
    }
    Views: {
      pain_daily: {
        Row: {
          avg_intensity: number | null
          body_part_id: string | null
          day: string | null
          max_intensity: number | null
          reports: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      clear_demo_history: { Args: never; Returns: number }
      create_pain_report: {
        Args: {
          p_body_part_id: string
          p_intensity: number
          p_note?: string
          p_pain_type_ids: string[]
          p_reported_at?: string
        }
        Returns: string
      }
      pain_trend: {
        Args: { p_days?: number }
        Returns: {
          body_part_id: string
          name_pl: string
          previous_avg: number
          previous_reports: number
          recent_avg: number
          recent_reports: number
          trend: string
        }[]
      }
      seed_demo_history: { Args: never; Returns: number }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
