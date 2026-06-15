export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      documents: {
        Row: {
          content_json: Json | null
          content_text: string | null
          content_tsv: unknown
          created_at: string
          folder_id: string | null
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content_json?: Json | null
          content_text?: string | null
          content_tsv?: unknown
          created_at?: string
          folder_id?: string | null
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content_json?: Json | null
          content_text?: string | null
          content_tsv?: unknown
          created_at?: string
          folder_id?: string | null
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          created_at: string
          folder_id: string | null
          id: string
          kind: Database["public"]["Enums"]["file_kind"]
          mime_type: string
          name: string
          size_bytes: number
          storage_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          folder_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["file_kind"]
          mime_type: string
          name: string
          size_bytes: number
          storage_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          folder_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["file_kind"]
          mime_type?: string
          name?: string
          size_bytes?: number
          storage_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action: string
          count: number
          user_id: string
          window_start: string
        }
        Insert: {
          action: string
          count?: number
          user_id: string
          window_start: string
        }
        Update: {
          action?: string
          count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      recordings: {
        Row: {
          created_at: string
          duration_sec: number | null
          error: string | null
          file_id: string
          id: string
          status: Database["public"]["Enums"]["recording_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_sec?: number | null
          error?: string | null
          file_id: string
          id?: string
          status?: Database["public"]["Enums"]["recording_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          duration_sec?: number | null
          error?: string | null
          file_id?: string
          id?: string
          status?: Database["public"]["Enums"]["recording_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recordings_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      semantic_search_chunks: {
        Row: {
          chunk_index: number
          content: string
          content_tsv: unknown
          created_at: string
          document_anchor_block_end: number | null
          document_anchor_block_start: number | null
          document_id: string | null
          embedding: string
          end_ms: number | null
          id: string
          recording_id: string | null
          source_type: Database["public"]["Enums"]["semantic_search_source_type"]
          start_ms: number | null
          transcript_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          chunk_index: number
          content: string
          content_tsv?: unknown
          created_at?: string
          document_anchor_block_end?: number | null
          document_anchor_block_start?: number | null
          document_id?: string | null
          embedding: string
          end_ms?: number | null
          id?: string
          recording_id?: string | null
          source_type: Database["public"]["Enums"]["semantic_search_source_type"]
          start_ms?: number | null
          transcript_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          chunk_index?: number
          content?: string
          content_tsv?: unknown
          created_at?: string
          document_anchor_block_end?: number | null
          document_anchor_block_start?: number | null
          document_id?: string | null
          embedding?: string
          end_ms?: number | null
          id?: string
          recording_id?: string | null
          source_type?: Database["public"]["Enums"]["semantic_search_source_type"]
          start_ms?: number | null
          transcript_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "semantic_search_chunks_document_id_user_id_fkey"
            columns: ["document_id", "user_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "semantic_search_chunks_recording_id_user_id_fkey"
            columns: ["recording_id", "user_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "semantic_search_chunks_transcript_id_recording_id_user_id_fkey"
            columns: ["transcript_id", "recording_id", "user_id"]
            isOneToOne: false
            referencedRelation: "transcripts"
            referencedColumns: ["id", "recording_id", "user_id"]
          },
          {
            foreignKeyName: "semantic_search_chunks_transcript_id_user_id_fkey"
            columns: ["transcript_id", "user_id"]
            isOneToOne: false
            referencedRelation: "transcripts"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      tag_links: {
        Row: {
          id: string
          tag_id: string
          target_id: string
          target_type: Database["public"]["Enums"]["tag_target_type"]
        }
        Insert: {
          id?: string
          tag_id: string
          target_id: string
          target_type: Database["public"]["Enums"]["tag_target_type"]
        }
        Update: {
          id?: string
          tag_id?: string
          target_id?: string
          target_type?: Database["public"]["Enums"]["tag_target_type"]
        }
        Relationships: [
          {
            foreignKeyName: "tag_links_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      transcript_segments: {
        Row: {
          created_at: string
          end_ms: number
          id: string
          speaker: string | null
          start_ms: number
          text: string
          transcript_id: string
        }
        Insert: {
          created_at?: string
          end_ms: number
          id?: string
          speaker?: string | null
          start_ms: number
          text: string
          transcript_id: string
        }
        Update: {
          created_at?: string
          end_ms?: number
          id?: string
          speaker?: string | null
          start_ms?: number
          text?: string
          transcript_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcript_segments_transcript_id_fkey"
            columns: ["transcript_id"]
            isOneToOne: false
            referencedRelation: "transcripts"
            referencedColumns: ["id"]
          },
        ]
      }
      transcripts: {
        Row: {
          created_at: string
          full_text: string
          full_text_tsv: unknown
          id: string
          language: string | null
          recording_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_text?: string
          full_text_tsv?: unknown
          id?: string
          language?: string | null
          recording_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_text?: string
          full_text_tsv?: unknown
          id?: string
          language?: string | null
          recording_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcripts_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
        ]
      }
      user_ai_credentials: {
        Row: {
          created_at: string
          updated_at: string
          user_id: string
          vault_secret_id: string
        }
        Insert: {
          created_at?: string
          updated_at?: string
          user_id: string
          vault_secret_id: string
        }
        Update: {
          created_at?: string
          updated_at?: string
          user_id?: string
          vault_secret_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bump_rate_limit: {
        Args: { p_action: string; p_window_start: string }
        Returns: {
          new_count: number
        }[]
      }
      delete_ai_api_key: { Args: never; Returns: undefined }
      get_ai_api_key: {
        Args: never
        Returns: {
          api_key: string
        }[]
      }
      match_semantic_search_chunks: {
        Args: {
          match_count?: number
          match_user_id: string
          query_embedding: string
          query_text: string
        }
        Returns: {
          chunk_index: number
          content: string
          id: string
          similarity: number
          source: Json
          source_type: Database["public"]["Enums"]["semantic_search_source_type"]
          text_rank: number
          user_id: string
        }[]
      }
      set_ai_api_key: { Args: { p_key: string }; Returns: undefined }
    }
    Enums: {
      file_kind: "audio" | "other"
      recording_status: "pending" | "processing" | "done" | "failed" | "live"
      semantic_search_source_type: "document" | "transcript"
      tag_target_type: "document" | "file" | "recording"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      file_kind: ["audio", "other"],
      recording_status: ["pending", "processing", "done", "failed", "live"],
      semantic_search_source_type: ["document", "transcript"],
      tag_target_type: ["document", "file", "recording"],
    },
  },
} as const

