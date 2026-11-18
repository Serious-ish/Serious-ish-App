export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      app_config: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value_json: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value_json: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "app_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["auth_user_id"]
          },
        ]
      }
      appeals: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          hold_id: string | null
          id: string
          member_id: string
          message: string
          report_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          hold_id?: string | null
          id?: string
          member_id: string
          message: string
          report_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          hold_id?: string | null
          id?: string
          member_id?: string
          message?: string
          report_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "appeals_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["auth_user_id"]
          },
          {
            foreignKeyName: "appeals_hold_id_fkey"
            columns: ["hold_id"]
            isOneToOne: false
            referencedRelation: "member_holds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appeals_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appeals_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_staff_id: string
          created_at: string
          id: string
          metadata: Json
          report_id: string | null
          subject_id: string
          subject_type: string
        }
        Insert: {
          action: string
          actor_staff_id: string
          created_at?: string
          id?: string
          metadata?: Json
          report_id?: string | null
          subject_id: string
          subject_type: string
        }
        Update: {
          action?: string
          actor_staff_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          report_id?: string | null
          subject_id?: string
          subject_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_staff_id_fkey"
            columns: ["actor_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["auth_user_id"]
          },
          {
            foreignKeyName: "audit_log_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      consents: {
        Row: {
          accepted_at: string
          created_at: string
          document_version: string
          id: string
          kind: Database["public"]["Enums"]["consent_kind"]
          member_id: string
          withdrawn_at: string | null
        }
        Insert: {
          accepted_at?: string
          created_at?: string
          document_version: string
          id?: string
          kind: Database["public"]["Enums"]["consent_kind"]
          member_id: string
          withdrawn_at?: string | null
        }
        Update: {
          accepted_at?: string
          created_at?: string
          document_version?: string
          id?: string
          kind?: Database["public"]["Enums"]["consent_kind"]
          member_id?: string
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consents_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      data_exports: {
        Row: {
          expires_at: string | null
          id: string
          member_id: string
          ready_at: string | null
          requested_at: string
          resolved_at: string | null
          status: string
          storage_path: string | null
        }
        Insert: {
          expires_at?: string | null
          id?: string
          member_id: string
          ready_at?: string | null
          requested_at?: string
          resolved_at?: string | null
          status?: string
          storage_path?: string | null
        }
        Update: {
          expires_at?: string | null
          id?: string
          member_id?: string
          ready_at?: string | null
          requested_at?: string
          resolved_at?: string | null
          status?: string
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_exports_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      deletion_requests: {
        Row: {
          created_at: string
          exception_reason: string | null
          id: string
          member_id: string
          purge_after: string
          purged_at: string | null
          requested_at: string
          status: string
        }
        Insert: {
          created_at?: string
          exception_reason?: string | null
          id?: string
          member_id: string
          purge_after: string
          purged_at?: string | null
          requested_at?: string
          status?: string
        }
        Update: {
          created_at?: string
          exception_reason?: string | null
          id?: string
          member_id?: string
          purge_after?: string
          purged_at?: string | null
          requested_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "deletion_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_preferences: {
        Row: {
          active_this_week: boolean
          advanced_filters: Json
          age_max: number
          age_min: number
          complete_profiles_only: boolean
          created_at: string
          go_further: boolean
          max_distance_km: number
          member_id: string
          seeking_genders: string[]
          updated_at: string
        }
        Insert: {
          active_this_week?: boolean
          advanced_filters?: Json
          age_max: number
          age_min?: number
          complete_profiles_only?: boolean
          created_at?: string
          go_further?: boolean
          max_distance_km?: number
          member_id: string
          seeking_genders: string[]
          updated_at?: string
        }
        Update: {
          active_this_week?: boolean
          advanced_filters?: Json
          age_max?: number
          age_min?: number
          complete_profiles_only?: boolean
          created_at?: string
          go_further?: boolean
          max_distance_km?: number
          member_id?: string
          seeking_genders?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovery_preferences_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      entitlements: {
        Row: {
          last_synced_at: string
          member_id: string
          source_subscription_id: string | null
          status: string
          tier: Database["public"]["Enums"]["plan_tier"]
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          last_synced_at?: string
          member_id: string
          source_subscription_id?: string | null
          status?: string
          tier?: Database["public"]["Enums"]["plan_tier"]
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          last_synced_at?: string
          member_id?: string
          source_subscription_id?: string | null
          status?: string
          tier?: Database["public"]["Enums"]["plan_tier"]
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entitlements_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entitlements_source_subscription_id_fkey"
            columns: ["source_subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          approved_by: string | null
          area_label: string
          category: string
          cover_storage_path: string | null
          created_at: string
          description: string
          ends_at: string
          host_id: string
          id: string
          organizer_url: string
          starts_at: string
          status: Database["public"]["Enums"]["event_status"]
          title: string
          updated_at: string
          venue_address: string | null
          venue_name: string
        }
        Insert: {
          approved_by?: string | null
          area_label: string
          category: string
          cover_storage_path?: string | null
          created_at?: string
          description: string
          ends_at: string
          host_id: string
          id?: string
          organizer_url: string
          starts_at: string
          status?: Database["public"]["Enums"]["event_status"]
          title: string
          updated_at?: string
          venue_address?: string | null
          venue_name: string
        }
        Update: {
          approved_by?: string | null
          area_label?: string
          category?: string
          cover_storage_path?: string | null
          created_at?: string
          description?: string
          ends_at?: string
          host_id?: string
          id?: string
          organizer_url?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["event_status"]
          title?: string
          updated_at?: string
          venue_address?: string | null
          venue_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["auth_user_id"]
          },
          {
            foreignKeyName: "events_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
        ]
      }
      hosts: {
        Row: {
          agreement_document_path: string | null
          agreement_signed_at: string | null
          agreement_version: string | null
          approved_by: string | null
          created_at: string
          id: string
          insurance_expires_at: string | null
          public_name: string
          public_website: string | null
          status: string
          updated_at: string
          vetting_note: string | null
        }
        Insert: {
          agreement_document_path?: string | null
          agreement_signed_at?: string | null
          agreement_version?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          insurance_expires_at?: string | null
          public_name: string
          public_website?: string | null
          status?: string
          updated_at?: string
          vetting_note?: string | null
        }
        Update: {
          agreement_document_path?: string | null
          agreement_signed_at?: string | null
          agreement_version?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          insurance_expires_at?: string | null
          public_name?: string
          public_website?: string | null
          status?: string
          updated_at?: string
          vetting_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hosts_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["auth_user_id"]
          },
        ]
      }
      interests: {
        Row: {
          category: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          chat_opened_at: string | null
          created_at: string
          expires_at: string
          high_first_message_at: string | null
          id: string
          low_first_message_at: string | null
          member_high_id: string
          member_low_id: string
          status: Database["public"]["Enums"]["match_status"]
          superlike_by: string | null
          updated_at: string
          window_hours: number
        }
        Insert: {
          chat_opened_at?: string | null
          created_at?: string
          expires_at: string
          high_first_message_at?: string | null
          id?: string
          low_first_message_at?: string | null
          member_high_id: string
          member_low_id: string
          status?: Database["public"]["Enums"]["match_status"]
          superlike_by?: string | null
          updated_at?: string
          window_hours: number
        }
        Update: {
          chat_opened_at?: string | null
          created_at?: string
          expires_at?: string
          high_first_message_at?: string | null
          id?: string
          low_first_message_at?: string | null
          member_high_id?: string
          member_low_id?: string
          status?: Database["public"]["Enums"]["match_status"]
          superlike_by?: string | null
          updated_at?: string
          window_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "matches_member_high_id_fkey"
            columns: ["member_high_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_member_low_id_fkey"
            columns: ["member_low_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_superlike_by_fkey"
            columns: ["superlike_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_holds: {
        Row: {
          created_at: string
          ended_at: string | null
          ended_by: string | null
          id: string
          member_id: string
          reason: string
          report_id: string
          started_at: string
          status: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          ended_by?: string | null
          id?: string
          member_id: string
          reason: string
          report_id: string
          started_at?: string
          status?: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          ended_by?: string | null
          id?: string
          member_id?: string
          reason?: string
          report_id?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_holds_ended_by_fkey"
            columns: ["ended_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["auth_user_id"]
          },
          {
            foreignKeyName: "member_holds_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_holds_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      member_identity: {
        Row: {
          created_at: string
          date_of_birth: string
          dob_locked_at: string
          first_name: string
          last_name: string
          member_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_of_birth: string
          dob_locked_at?: string
          first_name: string
          last_name: string
          member_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_of_birth?: string
          dob_locked_at?: string
          first_name?: string
          last_name?: string
          member_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_identity_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_interests: {
        Row: {
          interest_id: string
          member_id: string
          selected_at: string
        }
        Insert: {
          interest_id: string
          member_id: string
          selected_at?: string
        }
        Update: {
          interest_id?: string
          member_id?: string
          selected_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_interests_interest_id_fkey"
            columns: ["interest_id"]
            isOneToOne: false
            referencedRelation: "interests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_interests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_locations: {
        Row: {
          accuracy_km: number | null
          approx_point: unknown
          created_at: string
          member_id: string
          source: Database["public"]["Enums"]["location_source"]
          updated_at: string
        }
        Insert: {
          accuracy_km?: number | null
          approx_point: unknown
          created_at?: string
          member_id: string
          source: Database["public"]["Enums"]["location_source"]
          updated_at?: string
        }
        Update: {
          accuracy_km?: number | null
          approx_point?: unknown
          created_at?: string
          member_id?: string
          source?: Database["public"]["Enums"]["location_source"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_locations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          age_check_status: Database["public"]["Enums"]["age_status"]
          created_at: string
          deleted_at: string | null
          id: string
          last_active_at: string | null
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string
          went_live_at: string | null
        }
        Insert: {
          age_check_status?: Database["public"]["Enums"]["age_status"]
          created_at?: string
          deleted_at?: string | null
          id: string
          last_active_at?: string | null
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          went_live_at?: string | null
        }
        Update: {
          age_check_status?: Database["public"]["Enums"]["age_status"]
          created_at?: string
          deleted_at?: string | null
          id?: string
          last_active_at?: string | null
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          went_live_at?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          client_request_id: string
          created_at: string
          deleted_at: string | null
          id: string
          match_id: string
          sender_id: string
        }
        Insert: {
          body: string
          client_request_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          match_id: string
          sender_id: string
        }
        Update: {
          body?: string
          client_request_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          match_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      moderator_actions: {
        Row: {
          action: Database["public"]["Enums"]["moderation_action"]
          created_at: string
          id: string
          notified_reporter_at: string | null
          notified_subject_at: string | null
          reason_note: string
          report_id: string
          staff_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["moderation_action"]
          created_at?: string
          id?: string
          notified_reporter_at?: string | null
          notified_subject_at?: string | null
          reason_note: string
          report_id: string
          staff_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["moderation_action"]
          created_at?: string
          id?: string
          notified_reporter_at?: string | null
          notified_subject_at?: string | null
          reason_note?: string
          report_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderator_actions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderator_actions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["auth_user_id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          events: boolean
          expiring_match: boolean
          member_id: string
          new_match: boolean
          new_message: boolean
          updated_at: string
        }
        Insert: {
          events?: boolean
          expiring_match?: boolean
          member_id: string
          new_match?: boolean
          new_message?: boolean
          updated_at?: string
        }
        Update: {
          events?: boolean
          expiring_match?: boolean
          member_id?: string
          new_match?: boolean
          new_message?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          created_at: string
          height_px: number | null
          id: string
          member_id: string
          moderation_status: Database["public"]["Enums"]["photo_status"]
          position: number
          rejection_reason: string | null
          screening_labels: Json | null
          screening_provider: string | null
          storage_path: string
          updated_at: string
          width_px: number | null
        }
        Insert: {
          created_at?: string
          height_px?: number | null
          id?: string
          member_id: string
          moderation_status?: Database["public"]["Enums"]["photo_status"]
          position: number
          rejection_reason?: string | null
          screening_labels?: Json | null
          screening_provider?: string | null
          storage_path: string
          updated_at?: string
          width_px?: number | null
        }
        Update: {
          created_at?: string
          height_px?: number | null
          id?: string
          member_id?: string
          moderation_status?: Database["public"]["Enums"]["photo_status"]
          position?: number
          rejection_reason?: string | null
          screening_labels?: Json | null
          screening_provider?: string | null
          storage_path?: string
          updated_at?: string
          width_px?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "photos_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_limits: {
        Row: {
          advanced_filters: boolean
          likes_per_day: number | null
          match_window_hours: number
          rewinds_per_day: number | null
          see_likes: boolean
          superlikes_per_week: number
          tier: Database["public"]["Enums"]["plan_tier"]
          updated_at: string
        }
        Insert: {
          advanced_filters?: boolean
          likes_per_day?: number | null
          match_window_hours: number
          rewinds_per_day?: number | null
          see_likes?: boolean
          superlikes_per_week: number
          tier: Database["public"]["Enums"]["plan_tier"]
          updated_at?: string
        }
        Update: {
          advanced_filters?: boolean
          likes_per_day?: number | null
          match_window_hours?: number
          rewinds_per_day?: number | null
          see_likes?: boolean
          superlikes_per_week?: number
          tier?: Database["public"]["Enums"]["plan_tier"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          area_label: string
          bio: string | null
          created_at: string
          currently_studying: boolean | null
          display_name: string
          drinking: string | null
          education_level: string | null
          employer: string | null
          ethnicity: string | null
          gender: string
          has_children: string | null
          height_cm: number | null
          hidden_fields: string[]
          job_title: string | null
          member_id: string
          onboarding_step: number
          other_habits: Json | null
          politics: string | null
          pronouns: string | null
          relationship_intent: string
          religion: string | null
          school: string | null
          sexual_orientation: string | null
          smoking: string | null
          updated_at: string
          wants_children: string | null
        }
        Insert: {
          area_label: string
          bio?: string | null
          created_at?: string
          currently_studying?: boolean | null
          display_name: string
          drinking?: string | null
          education_level?: string | null
          employer?: string | null
          ethnicity?: string | null
          gender: string
          has_children?: string | null
          height_cm?: number | null
          hidden_fields?: string[]
          job_title?: string | null
          member_id: string
          onboarding_step?: number
          other_habits?: Json | null
          politics?: string | null
          pronouns?: string | null
          relationship_intent?: string
          religion?: string | null
          school?: string | null
          sexual_orientation?: string | null
          smoking?: string | null
          updated_at?: string
          wants_children?: string | null
        }
        Update: {
          area_label?: string
          bio?: string | null
          created_at?: string
          currently_studying?: boolean | null
          display_name?: string
          drinking?: string | null
          education_level?: string | null
          employer?: string | null
          ethnicity?: string | null
          gender?: string
          has_children?: string | null
          height_cm?: number | null
          hidden_fields?: string[]
          job_title?: string | null
          member_id?: string
          onboarding_step?: number
          other_habits?: Json | null
          politics?: string | null
          pronouns?: string | null
          relationship_intent?: string
          religion?: string | null
          school?: string | null
          sexual_orientation?: string | null
          smoking?: string | null
          updated_at?: string
          wants_children?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_answers: {
        Row: {
          answer: string
          created_at: string
          id: string
          member_id: string
          moderation_status: string
          position: number
          prompt_id: string
          updated_at: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          member_id: string
          moderation_status?: string
          position: number
          prompt_id: string
          updated_at?: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          member_id?: string
          moderation_status?: string
          position?: number
          prompt_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompt_answers_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_answers_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      prompts: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          question: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          question: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          question?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          created_at: string
          id: string
          invalidated_at: string | null
          last_seen_at: string
          member_id: string
          platform: string
          token: string
        }
        Insert: {
          created_at?: string
          id?: string
          invalidated_at?: string | null
          last_seen_at?: string
          member_id: string
          platform: string
          token: string
        }
        Update: {
          created_at?: string
          id?: string
          invalidated_at?: string | null
          last_seen_at?: string
          member_id?: string
          platform?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      report_evidence: {
        Row: {
          context_count: number
          created_at: string
          evidence_kind: string
          expires_at: string
          id: string
          key_version: string
          payload: string
          report_id: string
        }
        Insert: {
          context_count?: number
          created_at?: string
          evidence_kind: string
          expires_at: string
          id?: string
          key_version: string
          payload: string
          report_id: string
        }
        Update: {
          context_count?: number
          created_at?: string
          evidence_kind?: string
          expires_at?: string
          id?: string
          key_version?: string
          payload?: string
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_evidence_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          assigned_to: string | null
          created_at: string
          id: string
          reason: Database["public"]["Enums"]["report_reason"]
          reported_event_id: string | null
          reported_member_id: string | null
          reported_message_id: string | null
          reporter_id: string
          resolved_at: string | null
          sla_due_at: string
          status: Database["public"]["Enums"]["report_status"]
          updated_at: string
          urgency: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          reason: Database["public"]["Enums"]["report_reason"]
          reported_event_id?: string | null
          reported_member_id?: string | null
          reported_message_id?: string | null
          reporter_id: string
          resolved_at?: string | null
          sla_due_at: string
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
          urgency?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          reason?: Database["public"]["Enums"]["report_reason"]
          reported_event_id?: string | null
          reported_member_id?: string | null
          reported_message_id?: string | null
          reporter_id?: string
          resolved_at?: string | null
          sla_due_at?: string
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
          urgency?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["auth_user_id"]
          },
          {
            foreignKeyName: "reports_reported_event_id_fkey"
            columns: ["reported_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_member_id_fkey"
            columns: ["reported_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_message_id_fkey"
            columns: ["reported_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          active: boolean
          auth_user_id: string
          backup_for: string | null
          created_at: string
          mfa_enrolled_at: string | null
          role: Database["public"]["Enums"]["staff_role"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          auth_user_id: string
          backup_for?: string | null
          created_at?: string
          mfa_enrolled_at?: string | null
          role: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          auth_user_id?: string
          backup_for?: string | null
          created_at?: string
          mfa_enrolled_at?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_backup_for_fkey"
            columns: ["backup_for"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["auth_user_id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string
          id: string
          last_webhook_event_id: string | null
          member_id: string
          original_transaction_id: string
          period_start: string
          product_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          store: Database["public"]["Enums"]["store_kind"]
          term: string
          tier: Database["public"]["Enums"]["plan_tier"]
          updated_at: string
          will_renew: boolean
        }
        Insert: {
          created_at?: string
          current_period_end: string
          id?: string
          last_webhook_event_id?: string | null
          member_id: string
          original_transaction_id: string
          period_start: string
          product_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          store: Database["public"]["Enums"]["store_kind"]
          term: string
          tier: Database["public"]["Enums"]["plan_tier"]
          updated_at?: string
          will_renew: boolean
        }
        Update: {
          created_at?: string
          current_period_end?: string
          id?: string
          last_webhook_event_id?: string | null
          member_id?: string
          original_transaction_id?: string
          period_start?: string
          product_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          store?: Database["public"]["Enums"]["store_kind"]
          term?: string
          tier?: Database["public"]["Enums"]["plan_tier"]
          updated_at?: string
          will_renew?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_last_webhook_event_id_fkey"
            columns: ["last_webhook_event_id"]
            isOneToOne: false
            referencedRelation: "webhook_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      support_requests: {
        Row: {
          assigned_to: string | null
          created_at: string
          details: string | null
          id: string
          member_id: string
          request_type: string
          resolved_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          details?: string | null
          id?: string
          member_id: string
          request_type: string
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          details?: string | null
          id?: string
          member_id?: string
          request_type?: string
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_requests_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["auth_user_id"]
          },
          {
            foreignKeyName: "support_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      swipes: {
        Row: {
          action: Database["public"]["Enums"]["swipe_action"]
          client_request_id: string
          created_at: string
          id: string
          rewound_at: string | null
          swiper_id: string
          target_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["swipe_action"]
          client_request_id: string
          created_at?: string
          id?: string
          rewound_at?: string | null
          swiper_id: string
          target_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["swipe_action"]
          client_request_id?: string
          created_at?: string
          id?: string
          rewound_at?: string | null
          swiper_id?: string
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "swipes_swiper_id_fkey"
            columns: ["swiper_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swipes_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_counters: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["usage_kind"]
          member_id: string
          period_start: string
          updated_at: string
          used: number
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["usage_kind"]
          member_id: string
          period_start: string
          updated_at?: string
          used?: number
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["usage_kind"]
          member_id?: string
          period_start?: string
          updated_at?: string
          used?: number
        }
        Relationships: [
          {
            foreignKeyName: "usage_counters_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      verifications: {
        Row: {
          assigned_staff_id: string | null
          created_at: string
          decided_at: string | null
          decision_note: string | null
          estimated_age: number | null
          expires_at: string | null
          id: string
          kind: Database["public"]["Enums"]["verification_kind"]
          member_id: string
          status: Database["public"]["Enums"]["verification_status"]
          updated_at: string
          vendor: string | null
          vendor_reference: string | null
        }
        Insert: {
          assigned_staff_id?: string | null
          created_at?: string
          decided_at?: string | null
          decision_note?: string | null
          estimated_age?: number | null
          expires_at?: string | null
          id?: string
          kind: Database["public"]["Enums"]["verification_kind"]
          member_id: string
          status?: Database["public"]["Enums"]["verification_status"]
          updated_at?: string
          vendor?: string | null
          vendor_reference?: string | null
        }
        Update: {
          assigned_staff_id?: string | null
          created_at?: string
          decided_at?: string | null
          decision_note?: string | null
          estimated_age?: number | null
          expires_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["verification_kind"]
          member_id?: string
          status?: Database["public"]["Enums"]["verification_status"]
          updated_at?: string
          vendor?: string | null
          vendor_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verifications_assigned_staff_id_fkey"
            columns: ["assigned_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["auth_user_id"]
          },
          {
            foreignKeyName: "verifications_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_entries: {
        Row: {
          cohort: string
          contact: string
          created_at: string
          dating_group: string | null
          gender_group: string | null
          id: string
          invited_at: string | null
          member_id: string | null
          status: string
        }
        Insert: {
          cohort: string
          contact: string
          created_at?: string
          dating_group?: string | null
          gender_group?: string | null
          id?: string
          invited_at?: string | null
          member_id?: string | null
          status?: string
        }
        Update: {
          cohort?: string
          contact?: string
          created_at?: string
          dating_group?: string | null
          gender_group?: string | null
          id?: string
          invited_at?: string | null
          member_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_entries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          error_code: string | null
          id: string
          payload_hash: string
          processed_at: string | null
          provider: string
          provider_event_id: string
          received_at: string
          status: string
        }
        Insert: {
          error_code?: string | null
          id?: string
          payload_hash: string
          processed_at?: string | null
          provider: string
          provider_event_id: string
          received_at?: string
          status?: string
        }
        Update: {
          error_code?: string | null
          id?: string
          payload_hash?: string
          processed_at?: string | null
          provider?: string
          provider_event_id?: string
          received_at?: string
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      age_status: "not_started" | "pending" | "review" | "passed" | "blocked"
      consent_kind:
        | "terms"
        | "privacy"
        | "biometric_check"
        | "location"
        | "notifications"
        | "marketing"
      event_status: "draft" | "approved" | "canceled" | "removed"
      location_source: "device" | "selected_area"
      match_status: "active" | "chat_open" | "expired" | "unmatched" | "blocked"
      member_status:
        | "pending"
        | "active"
        | "paused"
        | "held"
        | "suspended"
        | "deleted"
      moderation_action:
        | "dismiss"
        | "warn"
        | "remove_content"
        | "suspend"
        | "ban"
        | "reinstate"
        | "escalate"
      photo_status:
        | "uploaded"
        | "scanning"
        | "approved"
        | "rejected"
        | "removed"
      plan_tier: "free" | "spark" | "elite"
      report_reason:
        | "underage"
        | "threat"
        | "unsafe_event"
        | "harassment"
        | "fake"
        | "scam"
        | "spam"
        | "other"
      report_status: "new" | "in_review" | "resolved" | "appealed"
      staff_role: "moderator" | "age_reviewer" | "support" | "admin"
      store_kind: "apple" | "google"
      subscription_status:
        | "active"
        | "grace"
        | "canceled_but_active"
        | "expired"
        | "refunded"
      swipe_action: "pass" | "like" | "superlike"
      usage_kind: "like" | "rewind" | "superlike"
      verification_kind: "selfie_age" | "id_fallback" | "store_age_signal"
      verification_status:
        | "started"
        | "passed"
        | "failed"
        | "needs_review"
        | "expired"
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
    Enums: {
      age_status: ["not_started", "pending", "review", "passed", "blocked"],
      consent_kind: [
        "terms",
        "privacy",
        "biometric_check",
        "location",
        "notifications",
        "marketing",
      ],
      event_status: ["draft", "approved", "canceled", "removed"],
      location_source: ["device", "selected_area"],
      match_status: ["active", "chat_open", "expired", "unmatched", "blocked"],
      member_status: [
        "pending",
        "active",
        "paused",
        "held",
        "suspended",
        "deleted",
      ],
      moderation_action: [
        "dismiss",
        "warn",
        "remove_content",
        "suspend",
        "ban",
        "reinstate",
        "escalate",
      ],
      photo_status: ["uploaded", "scanning", "approved", "rejected", "removed"],
      plan_tier: ["free", "spark", "elite"],
      report_reason: [
        "underage",
        "threat",
        "unsafe_event",
        "harassment",
        "fake",
        "scam",
        "spam",
        "other",
      ],
      report_status: ["new", "in_review", "resolved", "appealed"],
      staff_role: ["moderator", "age_reviewer", "support", "admin"],
      store_kind: ["apple", "google"],
      subscription_status: [
        "active",
        "grace",
        "canceled_but_active",
        "expired",
        "refunded",
      ],
      swipe_action: ["pass", "like", "superlike"],
      usage_kind: ["like", "rewind", "superlike"],
      verification_kind: ["selfie_age", "id_fallback", "store_age_signal"],
      verification_status: [
        "started",
        "passed",
        "failed",
        "needs_review",
        "expired",
      ],
    },
  },
} as const

