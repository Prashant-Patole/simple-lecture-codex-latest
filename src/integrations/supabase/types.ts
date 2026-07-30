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
      ai_assistant_documents: {
        Row: {
          chapter_id: string | null
          content_preview: string | null
          created_at: string
          created_by: string | null
          display_name: string | null
          file_name: string | null
          full_content: Json | null
          id: string
          parent_document_id: string | null
          source_type: string
          source_url: string | null
          split_status: string | null
          status: string | null
          subject_id: string
          topic_id: string | null
          updated_at: string
        }
        Insert: {
          chapter_id?: string | null
          content_preview?: string | null
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          file_name?: string | null
          full_content?: Json | null
          id?: string
          parent_document_id?: string | null
          source_type?: string
          source_url?: string | null
          split_status?: string | null
          status?: string | null
          subject_id: string
          topic_id?: string | null
          updated_at?: string
        }
        Update: {
          chapter_id?: string | null
          content_preview?: string | null
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          file_name?: string | null
          full_content?: Json | null
          id?: string
          parent_document_id?: string | null
          source_type?: string
          source_url?: string | null
          split_status?: string | null
          status?: string | null
          subject_id?: string
          topic_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_assistant_documents_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "subject_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_assistant_documents_parent_document_id_fkey"
            columns: ["parent_document_id"]
            isOneToOne: false
            referencedRelation: "ai_assistant_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_assistant_documents_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "popular_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_assistant_documents_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "subject_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_settings: {
        Row: {
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          setting_key: string
          setting_value: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      ai_video_watch_logs: {
        Row: {
          chapter_id: string | null
          completion_percentage: number
          created_at: string | null
          duration_seconds: number
          id: string
          student_id: string
          subject_id: string | null
          topic_id: string | null
          updated_at: string | null
          video_title: string
          watched_seconds: number
        }
        Insert: {
          chapter_id?: string | null
          completion_percentage?: number
          created_at?: string | null
          duration_seconds?: number
          id?: string
          student_id: string
          subject_id?: string | null
          topic_id?: string | null
          updated_at?: string | null
          video_title: string
          watched_seconds?: number
        }
        Update: {
          chapter_id?: string | null
          completion_percentage?: number
          created_at?: string | null
          duration_seconds?: number
          id?: string
          student_id?: string
          subject_id?: string | null
          topic_id?: string | null
          updated_at?: string | null
          video_title?: string
          watched_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_video_watch_logs_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "subject_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_video_watch_logs_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "popular_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_video_watch_logs_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "subject_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      approvals: {
        Row: {
          approved_at: string | null
          changes_requested: Json | null
          comments: string | null
          created_at: string
          id: string
          job_id: string
          reviewed_by: string | null
          stage: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          changes_requested?: Json | null
          comments?: string | null
          created_at?: string
          id: string
          job_id: string
          reviewed_by?: string | null
          stage: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          changes_requested?: Json | null
          comments?: string | null
          created_at?: string
          id?: string
          job_id?: string
          reviewed_by?: string | null
          stage?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_submissions: {
        Row: {
          answers: Json
          assignment_id: string | null
          feedback: string | null
          graded_at: string | null
          id: string
          percentage: number | null
          score: number | null
          student_id: string | null
          submitted_at: string | null
          time_taken_seconds: number | null
        }
        Insert: {
          answers: Json
          assignment_id?: string | null
          feedback?: string | null
          graded_at?: string | null
          id?: string
          percentage?: number | null
          score?: number | null
          student_id?: string | null
          submitted_at?: string | null
          time_taken_seconds?: number | null
        }
        Update: {
          answers?: Json
          assignment_id?: string | null
          feedback?: string | null
          graded_at?: string | null
          id?: string
          percentage?: number | null
          score?: number | null
          student_id?: string | null
          submitted_at?: string | null
          time_taken_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assignment_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          ai_generation_config: Json | null
          chapter_id: string | null
          course_id: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          duration_minutes: number | null
          homework_date: string | null
          id: string
          instructions: string | null
          is_active: boolean | null
          passing_marks: number | null
          questions: Json
          source_type: string | null
          subject_id: string | null
          submission_date: string | null
          title: string
          topic_id: string | null
          total_marks: number | null
          valid_until: string | null
        }
        Insert: {
          ai_generation_config?: Json | null
          chapter_id?: string | null
          course_id?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          duration_minutes?: number | null
          homework_date?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          passing_marks?: number | null
          questions: Json
          source_type?: string | null
          subject_id?: string | null
          submission_date?: string | null
          title: string
          topic_id?: string | null
          total_marks?: number | null
          valid_until?: string | null
        }
        Update: {
          ai_generation_config?: Json | null
          chapter_id?: string | null
          course_id?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          duration_minutes?: number | null
          homework_date?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          passing_marks?: number | null
          questions?: Json
          source_type?: string | null
          subject_id?: string | null
          submission_date?: string | null
          title?: string
          topic_id?: string | null
          total_marks?: number | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignments_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "subject_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "popular_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "subject_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_chapter_tests: {
        Row: {
          chapter_id: string
          chapter_title: string | null
          course_id: string
          created_at: string
          id: string
          self_test_id: string
          status: string
          student_id: string
          subject_id: string
          submitted_at: string | null
          triggered_at: string
        }
        Insert: {
          chapter_id: string
          chapter_title?: string | null
          course_id: string
          created_at?: string
          id?: string
          self_test_id: string
          status?: string
          student_id: string
          subject_id: string
          submitted_at?: string | null
          triggered_at?: string
        }
        Update: {
          chapter_id?: string
          chapter_title?: string | null
          course_id?: string
          created_at?: string
          id?: string
          self_test_id?: string
          status?: string
          student_id?: string
          subject_id?: string
          submitted_at?: string | null
          triggered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_chapter_tests_self_test_id_fkey"
            columns: ["self_test_id"]
            isOneToOne: false
            referencedRelation: "self_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_pipeline_reports: {
        Row: {
          category: string
          chapter_id: string | null
          chapter_name: string | null
          chapter_number: number | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          document_id: string | null
          duration_seconds: number | null
          error_message: string | null
          external_job_id: string | null
          failed_phases: string[] | null
          id: string
          problem_description: string | null
          retry_count: number
          retry_details: Json | null
          sanity_summary: Json | null
          server_ip: string | null
          started_at: string | null
          status: string
          subject_id: string | null
          subject_name: string
          submitted_at: string | null
          topic_id: string | null
          topic_name: string | null
          topic_number: number | null
        }
        Insert: {
          category?: string
          chapter_id?: string | null
          chapter_name?: string | null
          chapter_number?: number | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          external_job_id?: string | null
          failed_phases?: string[] | null
          id?: string
          problem_description?: string | null
          retry_count?: number
          retry_details?: Json | null
          sanity_summary?: Json | null
          server_ip?: string | null
          started_at?: string | null
          status?: string
          subject_id?: string | null
          subject_name: string
          submitted_at?: string | null
          topic_id?: string | null
          topic_name?: string | null
          topic_number?: number | null
        }
        Update: {
          category?: string
          chapter_id?: string | null
          chapter_name?: string | null
          chapter_number?: number | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          external_job_id?: string | null
          failed_phases?: string[] | null
          id?: string
          problem_description?: string | null
          retry_count?: number
          retry_details?: Json | null
          sanity_summary?: Json | null
          server_ip?: string | null
          started_at?: string | null
          status?: string
          subject_id?: string | null
          subject_name?: string
          submitted_at?: string | null
          topic_id?: string | null
          topic_name?: string | null
          topic_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_pipeline_reports_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "subject_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_pipeline_reports_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "popular_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_pipeline_reports_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "subject_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_pipeline_runs: {
        Row: {
          bad_jobs: number
          chapters_data: Json | null
          completed_jobs: number
          created_by: string | null
          current_chapter_index: number
          good_jobs: number
          id: string
          job_queue: Json | null
          pipeline_config: Json | null
          scan_results: Json | null
          selected_ips: Json | null
          started_at: string
          status: string
          subject_id: string
          subject_name: string
          total_jobs: number
          updated_at: string
        }
        Insert: {
          bad_jobs?: number
          chapters_data?: Json | null
          completed_jobs?: number
          created_by?: string | null
          current_chapter_index?: number
          good_jobs?: number
          id?: string
          job_queue?: Json | null
          pipeline_config?: Json | null
          scan_results?: Json | null
          selected_ips?: Json | null
          started_at?: string
          status?: string
          subject_id: string
          subject_name: string
          total_jobs?: number
          updated_at?: string
        }
        Update: {
          bad_jobs?: number
          chapters_data?: Json | null
          completed_jobs?: number
          created_by?: string | null
          current_chapter_index?: number
          good_jobs?: number
          id?: string
          job_queue?: Json | null
          pipeline_config?: Json | null
          scan_results?: Json | null
          selected_ips?: Json | null
          started_at?: string
          status?: string
          subject_id?: string
          subject_name?: string
          total_jobs?: number
          updated_at?: string
        }
        Relationships: []
      }
      auto_submission_runs: {
        Row: {
          created_at: string
          created_by: string | null
          current_index: number
          id: string
          items: Json
          kind: string
          last_tick_at: string | null
          pipeline_config: Json | null
          server_ip: string
          status: string
          subject_id: string
          subject_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_index?: number
          id?: string
          items?: Json
          kind?: string
          last_tick_at?: string | null
          pipeline_config?: Json | null
          server_ip: string
          status?: string
          subject_id: string
          subject_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_index?: number
          id?: string
          items?: Json
          kind?: string
          last_tick_at?: string | null
          pipeline_config?: Json | null
          server_ip?: string
          status?: string
          subject_id?: string
          subject_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      batches: {
        Row: {
          course_id: string
          created_at: string | null
          current_students: number | null
          end_date: string | null
          id: string
          is_active: boolean | null
          max_students: number | null
          name: string
          start_date: string
          updated_at: string | null
        }
        Insert: {
          course_id: string
          created_at?: string | null
          current_students?: number | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          max_students?: number | null
          name: string
          start_date: string
          updated_at?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string | null
          current_students?: number | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          max_students?: number | null
          name?: string
          start_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batches_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          course_id: string | null
          created_at: string
          featured_image_url: string | null
          id: string
          keywords: string[] | null
          meta_description: string | null
          notification_time: string | null
          published_at: string | null
          sections: Json
          slug: string
          status: string
          title: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          featured_image_url?: string | null
          id?: string
          keywords?: string[] | null
          meta_description?: string | null
          notification_time?: string | null
          published_at?: string | null
          sections?: Json
          slug: string
          status?: string
          title: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          featured_image_url?: string | null
          id?: string
          keywords?: string[] | null
          meta_description?: string | null
          notification_time?: string | null
          published_at?: string | null
          sections?: Json
          slug?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          added_at: string | null
          course_id: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          added_at?: string | null
          course_id?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          added_at?: string | null
          course_id?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          display_order: number | null
          icon: string | null
          id: string
          is_active: boolean | null
          is_popular: boolean | null
          level: number
          meta_description: string | null
          meta_keywords: string | null
          meta_title: string | null
          name: string
          parent_id: string | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_popular?: boolean | null
          level: number
          meta_description?: string | null
          meta_keywords?: string | null
          meta_title?: string | null
          name: string
          parent_id?: string | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_popular?: boolean | null
          level?: number
          meta_description?: string | null
          meta_keywords?: string | null
          meta_title?: string | null
          name?: string
          parent_id?: string | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      category_goals: {
        Row: {
          category_id: string | null
          created_at: string | null
          goal_id: string | null
          id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          goal_id?: string | null
          id?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          goal_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_goals_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_goals_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "explore_by_goal"
            referencedColumns: ["id"]
          },
        ]
      }
      cdn_presentation_refresh_runs: {
        Row: {
          completed_jobs: number
          created_at: string
          created_by: string | null
          current_job_index: number
          failed_jobs: number
          id: string
          job_queue: Json
          label: string | null
          skipped_jobs: number
          status: string
          total_jobs: number
          updated_at: string
        }
        Insert: {
          completed_jobs?: number
          created_at?: string
          created_by?: string | null
          current_job_index?: number
          failed_jobs?: number
          id?: string
          job_queue?: Json
          label?: string | null
          skipped_jobs?: number
          status?: string
          total_jobs?: number
          updated_at?: string
        }
        Update: {
          completed_jobs?: number
          created_at?: string
          created_by?: string | null
          current_job_index?: number
          failed_jobs?: number
          id?: string
          job_queue?: Json
          label?: string | null
          skipped_jobs?: number
          status?: string
          total_jobs?: number
          updated_at?: string
        }
        Relationships: []
      }
      chapters: {
        Row: {
          chapter_number: number
          course_id: string
          created_at: string | null
          description: string | null
          id: string
          pdf_url: string | null
          sequence_order: number | null
          subject: string
          title: string
          unlock_threshold: number | null
        }
        Insert: {
          chapter_number: number
          course_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          pdf_url?: string | null
          sequence_order?: number | null
          subject: string
          title: string
          unlock_threshold?: number | null
        }
        Update: {
          chapter_number?: number
          course_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          pdf_url?: string | null
          sequence_order?: number | null
          subject?: string
          title?: string
          unlock_threshold?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chapters_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      checker_reviews: {
        Row: {
          approved_at: string | null
          chapter_id: string | null
          comment: string | null
          created_at: string | null
          entity_id: string
          entity_type: string
          id: string
          is_approved: boolean | null
          reviewer_id: string
          topic_id: string | null
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          chapter_id?: string | null
          comment?: string | null
          created_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          is_approved?: boolean | null
          reviewer_id: string
          topic_id?: string | null
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          chapter_id?: string | null
          comment?: string | null
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          is_approved?: boolean | null
          reviewer_id?: string
          topic_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      class_attendance: {
        Row: {
          duration_seconds: number | null
          id: string
          joined_at: string | null
          left_at: string | null
          marked_at: string | null
          notes: string | null
          scheduled_class_id: string
          status: string | null
          student_id: string
        }
        Insert: {
          duration_seconds?: number | null
          id?: string
          joined_at?: string | null
          left_at?: string | null
          marked_at?: string | null
          notes?: string | null
          scheduled_class_id: string
          status?: string | null
          student_id: string
        }
        Update: {
          duration_seconds?: number | null
          id?: string
          joined_at?: string | null
          left_at?: string | null
          marked_at?: string | null
          notes?: string | null
          scheduled_class_id?: string
          status?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_attendance_scheduled_class_id_fkey"
            columns: ["scheduled_class_id"]
            isOneToOne: false
            referencedRelation: "scheduled_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_recordings: {
        Row: {
          available_qualities: Json | null
          b2_encrypted_path: string | null
          b2_hls_1080p_path: string | null
          b2_hls_360p_path: string | null
          b2_hls_480p_path: string | null
          b2_hls_720p_path: string | null
          b2_original_path: string | null
          bbb_recording_id: string | null
          bunny_status: string | null
          bunny_video_guid: string | null
          cdn_base_url: string | null
          chapter_id: string | null
          cloudflare_zone_id: string | null
          course_id: string | null
          created_at: string | null
          default_quality: string | null
          duration_seconds: number | null
          file_size_bytes: number | null
          id: string
          original_filename: string | null
          processed_at: string | null
          processing_error: string | null
          processing_status: string | null
          recording_title: string | null
          recording_type: string | null
          scheduled_class_id: string | null
          subject_id: string | null
          topic_id: string | null
          updated_at: string | null
        }
        Insert: {
          available_qualities?: Json | null
          b2_encrypted_path?: string | null
          b2_hls_1080p_path?: string | null
          b2_hls_360p_path?: string | null
          b2_hls_480p_path?: string | null
          b2_hls_720p_path?: string | null
          b2_original_path?: string | null
          bbb_recording_id?: string | null
          bunny_status?: string | null
          bunny_video_guid?: string | null
          cdn_base_url?: string | null
          chapter_id?: string | null
          cloudflare_zone_id?: string | null
          course_id?: string | null
          created_at?: string | null
          default_quality?: string | null
          duration_seconds?: number | null
          file_size_bytes?: number | null
          id?: string
          original_filename?: string | null
          processed_at?: string | null
          processing_error?: string | null
          processing_status?: string | null
          recording_title?: string | null
          recording_type?: string | null
          scheduled_class_id?: string | null
          subject_id?: string | null
          topic_id?: string | null
          updated_at?: string | null
        }
        Update: {
          available_qualities?: Json | null
          b2_encrypted_path?: string | null
          b2_hls_1080p_path?: string | null
          b2_hls_360p_path?: string | null
          b2_hls_480p_path?: string | null
          b2_hls_720p_path?: string | null
          b2_original_path?: string | null
          bbb_recording_id?: string | null
          bunny_status?: string | null
          bunny_video_guid?: string | null
          cdn_base_url?: string | null
          chapter_id?: string | null
          cloudflare_zone_id?: string | null
          course_id?: string | null
          created_at?: string | null
          default_quality?: string | null
          duration_seconds?: number | null
          file_size_bytes?: number | null
          id?: string
          original_filename?: string | null
          processed_at?: string | null
          processing_error?: string | null
          processing_status?: string | null
          recording_title?: string | null
          recording_type?: string | null
          scheduled_class_id?: string | null
          subject_id?: string | null
          topic_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_recordings_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "subject_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_recordings_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_recordings_scheduled_class_id_fkey"
            columns: ["scheduled_class_id"]
            isOneToOne: false
            referencedRelation: "scheduled_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_recordings_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "popular_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_recordings_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "subject_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      counselor_avatars: {
        Row: {
          created_at: string | null
          display_order: number | null
          gender: string
          id: string
          image_url: string
          is_active: boolean | null
          language: string
          name: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          gender: string
          id?: string
          image_url: string
          is_active?: boolean | null
          language: string
          name: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          gender?: string
          id?: string
          image_url?: string
          is_active?: boolean | null
          language?: string
          name?: string
        }
        Relationships: []
      }
      course_categories: {
        Row: {
          category_id: string
          course_id: string
          created_at: string | null
          id: string
        }
        Insert: {
          category_id: string
          course_id: string
          created_at?: string | null
          id?: string
        }
        Update: {
          category_id?: string
          course_id?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_categories_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_demo_videos: {
        Row: {
          course_id: string
          created_at: string
          created_by: string | null
          document_name: string | null
          external_job_id: string
          id: string
          server_ip: string | null
          updated_at: string
          video_job_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by?: string | null
          document_name?: string | null
          external_job_id: string
          id?: string
          server_ip?: string | null
          updated_at?: string
          video_job_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string | null
          document_name?: string | null
          external_job_id?: string
          id?: string
          server_ip?: string | null
          updated_at?: string
          video_job_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_demo_videos_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: true
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_demo_videos_video_job_id_fkey"
            columns: ["video_job_id"]
            isOneToOne: false
            referencedRelation: "video_generation_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      course_faqs: {
        Row: {
          answer: string
          course_id: string
          created_at: string | null
          display_order: number | null
          id: string
          question: string
          updated_at: string | null
        }
        Insert: {
          answer: string
          course_id: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          question: string
          updated_at?: string | null
        }
        Update: {
          answer?: string
          course_id?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          question?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_faqs_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_free_access_chapters: {
        Row: {
          chapter_id: string
          course_id: string
          created_at: string
          created_by: string | null
          id: string
          subject_id: string
        }
        Insert: {
          chapter_id: string
          course_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          subject_id: string
        }
        Update: {
          chapter_id?: string
          course_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_free_access_chapters_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "subject_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_free_access_chapters_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_free_access_chapters_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "popular_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      course_goals: {
        Row: {
          course_id: string
          created_at: string | null
          goal_id: string
          id: string
        }
        Insert: {
          course_id: string
          created_at?: string | null
          goal_id: string
          id?: string
        }
        Update: {
          course_id?: string
          created_at?: string | null
          goal_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_goals_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_goals_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "explore_by_goal"
            referencedColumns: ["id"]
          },
        ]
      }
      course_subjects: {
        Row: {
          course_id: string
          created_at: string | null
          display_order: number | null
          id: string
          subject_id: string
        }
        Insert: {
          course_id: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          subject_id: string
        }
        Update: {
          course_id?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_subjects_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "popular_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      course_teachers: {
        Row: {
          assigned_at: string | null
          course_id: string
          id: string
          is_primary: boolean | null
          subject: string | null
          teacher_id: string
        }
        Insert: {
          assigned_at?: string | null
          course_id: string
          id?: string
          is_primary?: boolean | null
          subject?: string | null
          teacher_id: string
        }
        Update: {
          assigned_at?: string | null
          course_id?: string
          id?: string
          is_primary?: boolean | null
          subject?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_teachers_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_thumbnails: {
        Row: {
          course_id: string
          created_at: string | null
          id: string
          storage_url: string
          updated_at: string | null
        }
        Insert: {
          course_id: string
          created_at?: string | null
          id?: string
          storage_url: string
          updated_at?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string | null
          id?: string
          storage_url?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_thumbnails_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: true
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_timetables: {
        Row: {
          academic_year: string
          batch_id: string | null
          course_id: string
          created_at: string | null
          day_of_week: number
          end_time: string
          id: string
          instructor_id: string | null
          is_active: boolean | null
          meeting_link: string | null
          room_number: string | null
          start_time: string
          subject_id: string | null
          updated_at: string | null
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          academic_year: string
          batch_id?: string | null
          course_id: string
          created_at?: string | null
          day_of_week: number
          end_time: string
          id?: string
          instructor_id?: string | null
          is_active?: boolean | null
          meeting_link?: string | null
          room_number?: string | null
          start_time: string
          subject_id?: string | null
          updated_at?: string | null
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          academic_year?: string
          batch_id?: string | null
          course_id?: string
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          instructor_id?: string | null
          is_active?: boolean | null
          meeting_link?: string | null
          room_number?: string | null
          start_time?: string
          subject_id?: string | null
          updated_at?: string | null
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_timetables_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_timetables_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_timetables_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_timetables_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "popular_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          ai_tutoring_enabled: boolean | null
          ai_tutoring_price: number | null
          available_languages: Json | null
          category: string | null
          course_includes: Json | null
          created_at: string | null
          description: string | null
          detailed_description: string | null
          duration_months: number | null
          free_preview_ai_limit: number
          free_preview_doubts_limit: number
          id: string
          instructor_avatar_url: string | null
          instructor_bio: string | null
          instructor_name: string | null
          is_active: boolean | null
          is_coming_soon: boolean | null
          language_topup_original_price: number | null
          language_topup_price: number | null
          live_classes_enabled: boolean | null
          live_classes_price: number | null
          name: string
          og_description: string | null
          og_image_url: string | null
          og_title: string | null
          original_price_inr: number | null
          price_inr: number | null
          promotional_video_url: string | null
          rating: number | null
          review_count: number | null
          seo_canonical_url: string | null
          seo_description: string | null
          seo_keywords: string | null
          seo_title: string | null
          sequence_order: number | null
          short_description: string | null
          slug: string
          student_count: number | null
          subjects: Json | null
          thumbnail_url: string | null
          what_you_learn: Json | null
        }
        Insert: {
          ai_tutoring_enabled?: boolean | null
          ai_tutoring_price?: number | null
          available_languages?: Json | null
          category?: string | null
          course_includes?: Json | null
          created_at?: string | null
          description?: string | null
          detailed_description?: string | null
          duration_months?: number | null
          free_preview_ai_limit?: number
          free_preview_doubts_limit?: number
          id?: string
          instructor_avatar_url?: string | null
          instructor_bio?: string | null
          instructor_name?: string | null
          is_active?: boolean | null
          is_coming_soon?: boolean | null
          language_topup_original_price?: number | null
          language_topup_price?: number | null
          live_classes_enabled?: boolean | null
          live_classes_price?: number | null
          name: string
          og_description?: string | null
          og_image_url?: string | null
          og_title?: string | null
          original_price_inr?: number | null
          price_inr?: number | null
          promotional_video_url?: string | null
          rating?: number | null
          review_count?: number | null
          seo_canonical_url?: string | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          sequence_order?: number | null
          short_description?: string | null
          slug: string
          student_count?: number | null
          subjects?: Json | null
          thumbnail_url?: string | null
          what_you_learn?: Json | null
        }
        Update: {
          ai_tutoring_enabled?: boolean | null
          ai_tutoring_price?: number | null
          available_languages?: Json | null
          category?: string | null
          course_includes?: Json | null
          created_at?: string | null
          description?: string | null
          detailed_description?: string | null
          duration_months?: number | null
          free_preview_ai_limit?: number
          free_preview_doubts_limit?: number
          id?: string
          instructor_avatar_url?: string | null
          instructor_bio?: string | null
          instructor_name?: string | null
          is_active?: boolean | null
          is_coming_soon?: boolean | null
          language_topup_original_price?: number | null
          language_topup_price?: number | null
          live_classes_enabled?: boolean | null
          live_classes_price?: number | null
          name?: string
          og_description?: string | null
          og_image_url?: string | null
          og_title?: string | null
          original_price_inr?: number | null
          price_inr?: number | null
          promotional_video_url?: string | null
          rating?: number | null
          review_count?: number | null
          seo_canonical_url?: string | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          sequence_order?: number | null
          short_description?: string | null
          slug?: string
          student_count?: number | null
          subjects?: Json | null
          thumbnail_url?: string | null
          what_you_learn?: Json | null
        }
        Relationships: []
      }
      coverage_analyzer_reports: {
        Row: {
          coverage_percent: number | null
          created_at: string
          created_by: string | null
          finished_at: string | null
          id: string
          job_id: string | null
          log: Json | null
          publish_action: string | null
          report: Json | null
          run_id: string
          started_at: string | null
          status: string | null
          subject_prefix: string | null
          topics_missing: Json | null
          updated_at: string
        }
        Insert: {
          coverage_percent?: number | null
          created_at?: string
          created_by?: string | null
          finished_at?: string | null
          id?: string
          job_id?: string | null
          log?: Json | null
          publish_action?: string | null
          report?: Json | null
          run_id: string
          started_at?: string | null
          status?: string | null
          subject_prefix?: string | null
          topics_missing?: Json | null
          updated_at?: string
        }
        Update: {
          coverage_percent?: number | null
          created_at?: string
          created_by?: string | null
          finished_at?: string | null
          id?: string
          job_id?: string | null
          log?: Json | null
          publish_action?: string | null
          report?: Json | null
          run_id?: string
          started_at?: string | null
          status?: string | null
          subject_prefix?: string | null
          topics_missing?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      daily_activity_logs: {
        Row: {
          activity_date: string
          activity_score: number
          created_at: string | null
          doubts_asked: number | null
          id: string
          live_class_minutes: number | null
          mcq_attempts: number | null
          podcast_listen_minutes: number | null
          student_id: string
          video_watch_minutes: number | null
        }
        Insert: {
          activity_date?: string
          activity_score?: number
          created_at?: string | null
          doubts_asked?: number | null
          id?: string
          live_class_minutes?: number | null
          mcq_attempts?: number | null
          podcast_listen_minutes?: number | null
          student_id: string
          video_watch_minutes?: number | null
        }
        Update: {
          activity_date?: string
          activity_score?: number
          created_at?: string | null
          doubts_asked?: number | null
          id?: string
          live_class_minutes?: number | null
          mcq_attempts?: number | null
          podcast_listen_minutes?: number | null
          student_id?: string
          video_watch_minutes?: number | null
        }
        Relationships: []
      }
      daily_login_attendance: {
        Row: {
          attendance_date: string
          created_at: string | null
          device_type: string | null
          first_login_at: string
          id: string
          last_active_at: string
          login_count: number | null
          student_id: string
        }
        Insert: {
          attendance_date?: string
          created_at?: string | null
          device_type?: string | null
          first_login_at?: string
          id?: string
          last_active_at?: string
          login_count?: number | null
          student_id: string
        }
        Update: {
          attendance_date?: string
          created_at?: string | null
          device_type?: string | null
          first_login_at?: string
          id?: string
          last_active_at?: string
          login_count?: number | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_login_attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_login_attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_analytics_cache"
            referencedColumns: ["student_id"]
          },
        ]
      }
      daily_motivation_email_logs: {
        Row: {
          ai_message: string
          created_at: string
          email: string
          error_message: string | null
          id: string
          sent_date: string
          status: string
          user_id: string
        }
        Insert: {
          ai_message: string
          created_at?: string
          email: string
          error_message?: string | null
          id?: string
          sent_date: string
          status?: string
          user_id: string
        }
        Update: {
          ai_message?: string
          created_at?: string
          email?: string
          error_message?: string | null
          id?: string
          sent_date?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_motivation_email_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_motivation_email_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "student_analytics_cache"
            referencedColumns: ["student_id"]
          },
        ]
      }
      daily_motivation_messages: {
        Row: {
          created_at: string
          id: string
          message_body: string
          message_date: string
          subject_line: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_body: string
          message_date: string
          subject_line: string
        }
        Update: {
          created_at?: string
          id?: string
          message_body?: string
          message_date?: string
          subject_line?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          created_at: string | null
          description: string | null
          head_of_department: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          head_of_department?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          head_of_department?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_head_of_department_fkey"
            columns: ["head_of_department"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_codes: {
        Row: {
          code: string
          course_id: string | null
          created_at: string | null
          description: string | null
          discount_amount: number | null
          discount_percent: number | null
          id: string
          is_active: boolean | null
          max_uses: number | null
          times_used: number | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          code: string
          course_id?: string | null
          created_at?: string | null
          description?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          times_used?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          code?: string
          course_id?: string | null
          created_at?: string | null
          description?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          times_used?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discount_codes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      document_images: {
        Row: {
          created_at: string | null
          document_id: string
          id: string
          image_type: string
          original_filename: string
          question_number: number | null
          storage_url: string
        }
        Insert: {
          created_at?: string | null
          document_id: string
          id?: string
          image_type: string
          original_filename: string
          question_number?: number | null
          storage_url: string
        }
        Update: {
          created_at?: string | null
          document_id?: string
          id?: string
          image_type?: string
          original_filename?: string
          question_number?: number | null
          storage_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_images_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "uploaded_question_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_processing_jobs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          current_step: string | null
          document_id: string
          error_details: Json | null
          error_message: string | null
          estimated_completion_at: string | null
          id: string
          job_type: string
          mathpix_pdf_id: string | null
          max_retries: number | null
          progress_percentage: number | null
          questions_extracted: number | null
          result_data: Json | null
          retry_count: number | null
          started_at: string | null
          status: string
          total_steps: number | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          current_step?: string | null
          document_id: string
          error_details?: Json | null
          error_message?: string | null
          estimated_completion_at?: string | null
          id?: string
          job_type: string
          mathpix_pdf_id?: string | null
          max_retries?: number | null
          progress_percentage?: number | null
          questions_extracted?: number | null
          result_data?: Json | null
          retry_count?: number | null
          started_at?: string | null
          status?: string
          total_steps?: number | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          current_step?: string | null
          document_id?: string
          error_details?: Json | null
          error_message?: string | null
          estimated_completion_at?: string | null
          id?: string
          job_type?: string
          mathpix_pdf_id?: string | null
          max_retries?: number | null
          progress_percentage?: number | null
          questions_extracted?: number | null
          result_data?: Json | null
          retry_count?: number | null
          started_at?: string | null
          status?: string
          total_steps?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_processing_jobs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "uploaded_question_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documentation_pages: {
        Row: {
          category: string
          content: string
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          page_key: string
          subcategory: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category: string
          content: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          page_key: string
          subcategory?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          page_key?: string
          subcategory?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      doubt_logs: {
        Row: {
          answer: string | null
          context_used: string | null
          conversation_duration_seconds: number | null
          created_at: string | null
          id: string
          model_used: string | null
          question: string
          response_time_ms: number | null
          satisfaction_rating: number | null
          student_id: string
          tokens_used: number | null
          topic_id: string | null
        }
        Insert: {
          answer?: string | null
          context_used?: string | null
          conversation_duration_seconds?: number | null
          created_at?: string | null
          id?: string
          model_used?: string | null
          question: string
          response_time_ms?: number | null
          satisfaction_rating?: number | null
          student_id: string
          tokens_used?: number | null
          topic_id?: string | null
        }
        Update: {
          answer?: string | null
          context_used?: string | null
          conversation_duration_seconds?: number | null
          created_at?: string | null
          id?: string
          model_used?: string | null
          question?: string
          response_time_ms?: number | null
          satisfaction_rating?: number | null
          student_id?: string
          tokens_used?: number | null
          topic_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doubt_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doubt_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_analytics_cache"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "doubt_logs_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      dpp_attempted_questions: {
        Row: {
          attempted_at: string | null
          id: string
          question_id: string
          student_id: string
          topic_id: string | null
          was_correct: boolean | null
        }
        Insert: {
          attempted_at?: string | null
          id?: string
          question_id: string
          student_id: string
          topic_id?: string | null
          was_correct?: boolean | null
        }
        Update: {
          attempted_at?: string | null
          id?: string
          question_id?: string
          student_id?: string
          topic_id?: string | null
          was_correct?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "dpp_attempted_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "dpp_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dpp_attempted_questions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "subject_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      dpp_documents: {
        Row: {
          chapter_id: string | null
          created_at: string | null
          created_by: string | null
          current_page: number | null
          display_name: string | null
          error_message: string | null
          id: string
          questions_count: number | null
          questions_file_url: string | null
          questions_mmd: string | null
          solutions_file_url: string | null
          solutions_mmd: string | null
          status: string | null
          subject_id: string
          topic_id: string | null
          total_pages: number | null
          updated_at: string | null
        }
        Insert: {
          chapter_id?: string | null
          created_at?: string | null
          created_by?: string | null
          current_page?: number | null
          display_name?: string | null
          error_message?: string | null
          id?: string
          questions_count?: number | null
          questions_file_url?: string | null
          questions_mmd?: string | null
          solutions_file_url?: string | null
          solutions_mmd?: string | null
          status?: string | null
          subject_id: string
          topic_id?: string | null
          total_pages?: number | null
          updated_at?: string | null
        }
        Update: {
          chapter_id?: string | null
          created_at?: string | null
          created_by?: string | null
          current_page?: number | null
          display_name?: string | null
          error_message?: string | null
          id?: string
          questions_count?: number | null
          questions_file_url?: string | null
          questions_mmd?: string | null
          solutions_file_url?: string | null
          solutions_mmd?: string | null
          status?: string | null
          subject_id?: string
          topic_id?: string | null
          total_pages?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dpp_documents_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "subject_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dpp_documents_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "popular_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dpp_documents_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "subject_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      dpp_questions: {
        Row: {
          chapter_id: string | null
          correct_answer: string
          created_at: string | null
          difficulty: string | null
          document_id: string | null
          dpp_number: number | null
          explanation: string | null
          id: string
          is_active: boolean | null
          options: Json
          question_number: number
          question_text: string
          subject_id: string
          topic_id: string | null
          updated_at: string | null
        }
        Insert: {
          chapter_id?: string | null
          correct_answer: string
          created_at?: string | null
          difficulty?: string | null
          document_id?: string | null
          dpp_number?: number | null
          explanation?: string | null
          id?: string
          is_active?: boolean | null
          options: Json
          question_number: number
          question_text: string
          subject_id: string
          topic_id?: string | null
          updated_at?: string | null
        }
        Update: {
          chapter_id?: string | null
          correct_answer?: string
          created_at?: string | null
          difficulty?: string | null
          document_id?: string | null
          dpp_number?: number | null
          explanation?: string | null
          id?: string
          is_active?: boolean | null
          options?: Json
          question_number?: number
          question_text?: string
          subject_id?: string
          topic_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dpp_questions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "subject_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dpp_questions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "dpp_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dpp_questions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "popular_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dpp_questions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "subject_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      dpp_topic_submissions: {
        Row: {
          answers: Json
          created_at: string | null
          dpp_type: string
          id: string
          questions: Json
          score: number | null
          student_id: string
          submitted_at: string | null
          test_date: string
          time_taken_seconds: number | null
          topic_id: string
          total_questions: number | null
        }
        Insert: {
          answers: Json
          created_at?: string | null
          dpp_type: string
          id?: string
          questions: Json
          score?: number | null
          student_id: string
          submitted_at?: string | null
          test_date?: string
          time_taken_seconds?: number | null
          topic_id: string
          total_questions?: number | null
        }
        Update: {
          answers?: Json
          created_at?: string | null
          dpp_type?: string
          id?: string
          questions?: Json
          score?: number | null
          student_id?: string
          submitted_at?: string | null
          test_date?: string
          time_taken_seconds?: number | null
          topic_id?: string
          total_questions?: number | null
        }
        Relationships: []
      }
      dpt_submissions: {
        Row: {
          answers: Json
          id: string
          questions: Json
          score: number | null
          student_id: string | null
          submitted_at: string | null
          test_date: string | null
          time_taken_seconds: number | null
          total_questions: number | null
        }
        Insert: {
          answers: Json
          id?: string
          questions: Json
          score?: number | null
          student_id?: string | null
          submitted_at?: string | null
          test_date?: string | null
          time_taken_seconds?: number | null
          total_questions?: number | null
        }
        Update: {
          answers?: Json
          id?: string
          questions?: Json
          score?: number | null
          student_id?: string | null
          submitted_at?: string | null
          test_date?: string | null
          time_taken_seconds?: number | null
          total_questions?: number | null
        }
        Relationships: []
      }
      email_otp_verifications: {
        Row: {
          attempts: number
          created_at: string
          email: string
          expires_at: string
          id: string
          otp_hash: string
          purpose: string
          verified: boolean
        }
        Insert: {
          attempts?: number
          created_at?: string
          email: string
          expires_at: string
          id?: string
          otp_hash: string
          purpose: string
          verified?: boolean
        }
        Update: {
          attempts?: number
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          otp_hash?: string
          purpose?: string
          verified?: boolean
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          batch_id: string | null
          course_id: string
          enrolled_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          student_id: string
        }
        Insert: {
          batch_id?: string | null
          course_id: string
          enrolled_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          student_id: string
        }
        Update: {
          batch_id?: string | null
          course_id?: string
          enrolled_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_analytics_cache"
            referencedColumns: ["student_id"]
          },
        ]
      }
      explore_by_goal: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          icon: string | null
          id: string
          is_active: boolean | null
          link_type: string | null
          link_url: string | null
          name: string
          open_in_new_tab: boolean | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          link_type?: string | null
          link_url?: string | null
          name: string
          open_in_new_tab?: boolean | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          link_type?: string | null
          link_url?: string | null
          name?: string
          open_in_new_tab?: boolean | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      featured_courses: {
        Row: {
          course_id: string
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          section_type: string
          updated_at: string | null
        }
        Insert: {
          course_id: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          section_type: string
          updated_at?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          section_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "featured_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_categories: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          is_general: boolean | null
          name: string
          slug: string
          subject_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          is_general?: boolean | null
          name: string
          slug: string
          subject_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          is_general?: boolean | null
          name?: string
          slug?: string
          subject_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "forum_categories_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "popular_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_flags: {
        Row: {
          created_at: string | null
          flagged_by: string
          id: string
          post_id: string | null
          reason: string
          reply_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          flagged_by: string
          id?: string
          post_id?: string | null
          reason: string
          reply_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          flagged_by?: string
          id?: string
          post_id?: string | null
          reason?: string
          reply_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "forum_flags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_flags_reply_id_fkey"
            columns: ["reply_id"]
            isOneToOne: false
            referencedRelation: "forum_replies"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string | null
          role: string | null
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string | null
          role?: string | null
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string | null
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "forum_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_group_message_reads: {
        Row: {
          id: string
          message_id: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          message_id: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          message_id?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_group_message_reads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "forum_group_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_group_messages: {
        Row: {
          content: string
          created_at: string | null
          file_url: string | null
          group_id: string
          id: string
          is_deleted: boolean | null
          message_type: string | null
          reply_to_id: string | null
          sender_id: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          file_url?: string | null
          group_id: string
          id?: string
          is_deleted?: boolean | null
          message_type?: string | null
          reply_to_id?: string | null
          sender_id: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          file_url?: string | null
          group_id?: string
          id?: string
          is_deleted?: boolean | null
          message_type?: string | null
          reply_to_id?: string | null
          sender_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "forum_group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "forum_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_group_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "forum_group_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_groups: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          is_active: boolean | null
          is_private: boolean | null
          max_members: number | null
          member_count: number | null
          name: string
          subject_id: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_private?: boolean | null
          max_members?: number | null
          member_count?: number | null
          name: string
          subject_id?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_private?: boolean | null
          max_members?: number | null
          member_count?: number | null
          name?: string
          subject_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "forum_groups_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "popular_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_posts: {
        Row: {
          author_id: string
          category_id: string
          content: string
          created_at: string | null
          id: string
          is_answered: boolean | null
          is_pinned: boolean | null
          last_activity_at: string | null
          reply_count: number | null
          status: string | null
          title: string
          updated_at: string | null
          view_count: number | null
        }
        Insert: {
          author_id: string
          category_id: string
          content: string
          created_at?: string | null
          id?: string
          is_answered?: boolean | null
          is_pinned?: boolean | null
          last_activity_at?: string | null
          reply_count?: number | null
          status?: string | null
          title: string
          updated_at?: string | null
          view_count?: number | null
        }
        Update: {
          author_id?: string
          category_id?: string
          content?: string
          created_at?: string | null
          id?: string
          is_answered?: boolean | null
          is_pinned?: boolean | null
          last_activity_at?: string | null
          reply_count?: number | null
          status?: string | null
          title?: string
          updated_at?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "forum_posts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "forum_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_replies: {
        Row: {
          author_id: string | null
          content: string
          created_at: string | null
          id: string
          is_accepted_answer: boolean | null
          is_ai_generated: boolean | null
          post_id: string
          status: string | null
          updated_at: string | null
          upvotes: number | null
        }
        Insert: {
          author_id?: string | null
          content: string
          created_at?: string | null
          id?: string
          is_accepted_answer?: boolean | null
          is_ai_generated?: boolean | null
          post_id: string
          status?: string | null
          updated_at?: string | null
          upvotes?: number | null
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          is_accepted_answer?: boolean | null
          is_ai_generated?: boolean | null
          post_id?: string
          status?: string | null
          updated_at?: string | null
          upvotes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "forum_replies_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_upvotes: {
        Row: {
          created_at: string | null
          id: string
          reply_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          reply_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          reply_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_upvotes_reply_id_fkey"
            columns: ["reply_id"]
            isOneToOne: false
            referencedRelation: "forum_replies"
            referencedColumns: ["id"]
          },
        ]
      }
      gap_patcher_queue: {
        Row: {
          coverage_percent: number | null
          created_at: string
          created_by: string | null
          error: string | null
          external_job_id: string
          finished_at: string | null
          id: string
          last_log_tail: string | null
          patch_run_id: string | null
          source: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          coverage_percent?: number | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          external_job_id: string
          finished_at?: string | null
          id?: string
          last_log_tail?: string | null
          patch_run_id?: string | null
          source?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          coverage_percent?: number | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          external_job_id?: string
          finished_at?: string | null
          id?: string
          last_log_tail?: string | null
          patch_run_id?: string | null
          source?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      gap_patcher_settings: {
        Row: {
          enabled: boolean
          id: number
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          id?: number
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      holidays: {
        Row: {
          created_at: string | null
          date: string
          description: string | null
          id: string
          is_recurring: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          description?: string | null
          id?: string
          is_recurring?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          description?: string | null
          id?: string
          is_recurring?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      image_enhancements: {
        Row: {
          created_at: string | null
          description: string | null
          enhanced_image_path: string | null
          id: string
          job_id: string | null
          mmd_position: number | null
          original_image_path: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          enhanced_image_path?: string | null
          id: string
          job_id?: string | null
          mmd_position?: number | null
          original_image_path?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          enhanced_image_path?: string | null
          id?: string
          job_id?: string | null
          mmd_position?: number | null
          original_image_path?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "image_enhancements_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_activity_log: {
        Row: {
          action: string
          action_type: string
          created_at: string | null
          id: string
          instructor_id: string
          ip_address: string | null
          metadata: Json | null
          user_agent: string | null
        }
        Insert: {
          action: string
          action_type: string
          created_at?: string | null
          id?: string
          instructor_id: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          action_type?: string
          created_at?: string | null
          id?: string
          instructor_id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instructor_activity_log_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_subjects: {
        Row: {
          course_id: string | null
          created_at: string | null
          id: string
          instructor_id: string | null
          subject_id: string | null
        }
        Insert: {
          course_id?: string | null
          created_at?: string | null
          id?: string
          instructor_id?: string | null
          subject_id?: string | null
        }
        Update: {
          course_id?: string | null
          created_at?: string | null
          id?: string
          instructor_id?: string | null
          subject_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instructor_subjects_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_subjects_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "popular_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_timetables: {
        Row: {
          academic_year: string
          batch_id: string | null
          chapter_id: string | null
          created_at: string | null
          day_of_week: number
          duration_minutes: number | null
          end_time: string
          id: string
          instructor_id: string | null
          is_active: boolean | null
          start_time: string
          subject_id: string | null
          updated_at: string | null
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          academic_year: string
          batch_id?: string | null
          chapter_id?: string | null
          created_at?: string | null
          day_of_week: number
          duration_minutes?: number | null
          end_time: string
          id?: string
          instructor_id?: string | null
          is_active?: boolean | null
          start_time: string
          subject_id?: string | null
          updated_at?: string | null
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          academic_year?: string
          batch_id?: string | null
          chapter_id?: string | null
          created_at?: string | null
          day_of_week?: number
          duration_minutes?: number | null
          end_time?: string
          id?: string
          instructor_id?: string | null
          is_active?: boolean | null
          start_time?: string
          subject_id?: string | null
          updated_at?: string | null
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instructor_timetables_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_timetables_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "subject_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_timetables_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_timetables_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "popular_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      job_logs: {
        Row: {
          created_at: string | null
          details: Json | null
          id: string
          job_id: string
          log_level: string
          message: string
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          id?: string
          job_id: string
          log_level: string
          message: string
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          id?: string
          job_id?: string
          log_level?: string
          message?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "document_processing_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          callback_url: string | null
          chapter: string | null
          created_at: string
          current_stage: string | null
          error_message: string | null
          id: string
          status: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          callback_url?: string | null
          chapter?: string | null
          created_at?: string
          current_stage?: string | null
          error_message?: string | null
          id: string
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          callback_url?: string | null
          chapter?: string | null
          created_at?: string
          current_stage?: string | null
          error_message?: string | null
          id?: string
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      kannada_queue_items: {
        Row: {
          attempts: number
          chapter_number: number | null
          document_name: string | null
          enqueued_at: string
          enqueued_by: string | null
          external_job_id: string
          finished_at: string | null
          id: string
          last_error: string | null
          missing_sections: number | null
          run_id: string | null
          server_ip: string
          started_at: string | null
          status: string
          subject_name: string | null
          topic_title: string | null
          total_sections: number | null
          updated_at: string
          video_job_id: string
        }
        Insert: {
          attempts?: number
          chapter_number?: number | null
          document_name?: string | null
          enqueued_at?: string
          enqueued_by?: string | null
          external_job_id: string
          finished_at?: string | null
          id?: string
          last_error?: string | null
          missing_sections?: number | null
          run_id?: string | null
          server_ip: string
          started_at?: string | null
          status?: string
          subject_name?: string | null
          topic_title?: string | null
          total_sections?: number | null
          updated_at?: string
          video_job_id: string
        }
        Update: {
          attempts?: number
          chapter_number?: number | null
          document_name?: string | null
          enqueued_at?: string
          enqueued_by?: string | null
          external_job_id?: string
          finished_at?: string | null
          id?: string
          last_error?: string | null
          missing_sections?: number | null
          run_id?: string | null
          server_ip?: string
          started_at?: string | null
          status?: string
          subject_name?: string | null
          topic_title?: string | null
          total_sections?: number | null
          updated_at?: string
          video_job_id?: string
        }
        Relationships: []
      }
      kannada_queue_runs: {
        Row: {
          completed: number
          created_at: string
          created_by: string | null
          failed: number
          id: string
          mode: string
          server_ip: string
          status: string
          total: number
          updated_at: string
        }
        Insert: {
          completed?: number
          created_at?: string
          created_by?: string | null
          failed?: number
          id?: string
          mode: string
          server_ip: string
          status?: string
          total?: number
          updated_at?: string
        }
        Update: {
          completed?: number
          created_at?: string
          created_by?: string | null
          failed?: number
          id?: string
          mode?: string
          server_ip?: string
          status?: string
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      language_avatar_jobs: {
        Row: {
          avatar_url: string | null
          cdn_path: string | null
          created_at: string | null
          error_message: string | null
          external_job_id: string | null
          id: string
          language: string
          progress: number | null
          section_id: number
          section_title: string | null
          server_ip: string | null
          speaker: string | null
          status: string | null
          task_id: string | null
          updated_at: string | null
          video_job_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          cdn_path?: string | null
          created_at?: string | null
          error_message?: string | null
          external_job_id?: string | null
          id?: string
          language: string
          progress?: number | null
          section_id: number
          section_title?: string | null
          server_ip?: string | null
          speaker?: string | null
          status?: string | null
          task_id?: string | null
          updated_at?: string | null
          video_job_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          cdn_path?: string | null
          created_at?: string | null
          error_message?: string | null
          external_job_id?: string | null
          id?: string
          language?: string
          progress?: number | null
          section_id?: number
          section_title?: string | null
          server_ip?: string | null
          speaker?: string | null
          status?: string | null
          task_id?: string | null
          updated_at?: string | null
          video_job_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "language_avatar_jobs_video_job_id_fkey"
            columns: ["video_job_id"]
            isOneToOne: false
            referencedRelation: "video_generation_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      language_generation_runs: {
        Row: {
          completed_jobs: number
          created_at: string
          created_by: string | null
          current_job_index: number
          failed_jobs: number
          id: string
          job_queue: Json
          languages: string[]
          server_ip: string
          skipped_jobs: number
          speaker: string
          status: string
          subject_id: string
          subject_name: string
          total_jobs: number
          updated_at: string
        }
        Insert: {
          completed_jobs?: number
          created_at?: string
          created_by?: string | null
          current_job_index?: number
          failed_jobs?: number
          id?: string
          job_queue?: Json
          languages?: string[]
          server_ip: string
          skipped_jobs?: number
          speaker: string
          status?: string
          subject_id: string
          subject_name: string
          total_jobs?: number
          updated_at?: string
        }
        Update: {
          completed_jobs?: number
          created_at?: string
          created_by?: string | null
          current_job_index?: number
          failed_jobs?: number
          id?: string
          job_queue?: Json
          languages?: string[]
          server_ip?: string
          skipped_jobs?: number
          speaker?: string
          status?: string
          subject_id?: string
          subject_name?: string
          total_jobs?: number
          updated_at?: string
        }
        Relationships: []
      }
      language_topup_purchases: {
        Row: {
          amount_paid: number
          completed_at: string | null
          course_id: string
          created_at: string | null
          id: string
          order_id: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          selected_languages: Json
          status: string
          user_id: string
        }
        Insert: {
          amount_paid?: number
          completed_at?: string | null
          course_id: string
          created_at?: string | null
          id?: string
          order_id: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          selected_languages?: Json
          status?: string
          user_id: string
        }
        Update: {
          amount_paid?: number
          completed_at?: string | null
          course_id?: string
          created_at?: string | null
          id?: string
          order_id?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          selected_languages?: Json
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "language_topup_purchases_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_summaries: {
        Row: {
          created_at: string
          generated_images: Json | null
          id: string
          job_id: string
          llm_model: string | null
          processing_completed_at: string | null
          processing_started_at: string | null
          status: string
          summary_content: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          generated_images?: Json | null
          id: string
          job_id: string
          llm_model?: string | null
          processing_completed_at?: string | null
          processing_started_at?: string | null
          status?: string
          summary_content: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          generated_images?: Json | null
          id?: string
          job_id?: string
          llm_model?: string | null
          processing_completed_at?: string | null
          processing_started_at?: string | null
          status?: string
          summary_content?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_summaries_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      network_quality_logs: {
        Row: {
          adapted_to_quality: string | null
          buffer_events: number | null
          connection_type: string | null
          created_at: string | null
          effective_bandwidth_mbps: number | null
          id: string
          initial_quality: string | null
          latency_ms: number | null
          recording_id: string | null
          user_id: string | null
        }
        Insert: {
          adapted_to_quality?: string | null
          buffer_events?: number | null
          connection_type?: string | null
          created_at?: string | null
          effective_bandwidth_mbps?: number | null
          id?: string
          initial_quality?: string | null
          latency_ms?: number | null
          recording_id?: string | null
          user_id?: string | null
        }
        Update: {
          adapted_to_quality?: string | null
          buffer_events?: number | null
          connection_type?: string | null
          created_at?: string | null
          effective_bandwidth_mbps?: number | null
          id?: string
          initial_quality?: string | null
          latency_ms?: number | null
          recording_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "network_quality_logs_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "class_recordings"
            referencedColumns: ["id"]
          },
        ]
      }
      notice_reads: {
        Row: {
          id: string
          notice_id: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          notice_id: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          notice_id?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notice_reads_notice_id_fkey"
            columns: ["notice_id"]
            isOneToOne: false
            referencedRelation: "notices"
            referencedColumns: ["id"]
          },
        ]
      }
      notices: {
        Row: {
          category: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          is_global: boolean | null
          priority: string | null
          title: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          is_global?: boolean | null
          priority?: string | null
          title: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          is_global?: boolean | null
          priority?: string | null
          title?: string
        }
        Relationships: []
      }
      ocr_results: {
        Row: {
          cloud_image_urls: Json | null
          created_at: string
          datalab_request_id: string | null
          id: string
          images: Json | null
          images_extracted: number | null
          job_id: string
          mathpix_pdf_id: string | null
          mmd_content: string | null
          mmd_url: string | null
          processing_completed_at: string | null
          processing_started_at: string | null
          provider: string | null
          status: string
          updated_at: string
          zip_path: string | null
        }
        Insert: {
          cloud_image_urls?: Json | null
          created_at?: string
          datalab_request_id?: string | null
          id: string
          images?: Json | null
          images_extracted?: number | null
          job_id: string
          mathpix_pdf_id?: string | null
          mmd_content?: string | null
          mmd_url?: string | null
          processing_completed_at?: string | null
          processing_started_at?: string | null
          provider?: string | null
          status?: string
          updated_at?: string
          zip_path?: string | null
        }
        Update: {
          cloud_image_urls?: Json | null
          created_at?: string
          datalab_request_id?: string | null
          id?: string
          images?: Json | null
          images_extracted?: number | null
          job_id?: string
          mathpix_pdf_id?: string | null
          mmd_content?: string | null
          mmd_url?: string | null
          processing_completed_at?: string | null
          processing_started_at?: string | null
          provider?: string | null
          status?: string
          updated_at?: string
          zip_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ocr_results_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      offline_downloads: {
        Row: {
          created_at: string | null
          device_id: string
          download_status: string | null
          download_url: string | null
          downloaded_at: string | null
          encryption_iv: string | null
          encryption_key_encrypted: string | null
          expires_at: string | null
          file_size_bytes: number | null
          id: string
          is_revoked: boolean | null
          quality: string | null
          recording_id: string | null
          revoked_at: string | null
          revoked_reason: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          device_id: string
          download_status?: string | null
          download_url?: string | null
          downloaded_at?: string | null
          encryption_iv?: string | null
          encryption_key_encrypted?: string | null
          expires_at?: string | null
          file_size_bytes?: number | null
          id?: string
          is_revoked?: boolean | null
          quality?: string | null
          recording_id?: string | null
          revoked_at?: string | null
          revoked_reason?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          device_id?: string
          download_status?: string | null
          download_url?: string | null
          downloaded_at?: string | null
          encryption_iv?: string | null
          encryption_key_encrypted?: string | null
          expires_at?: string | null
          file_size_bytes?: number | null
          id?: string
          is_revoked?: boolean | null
          quality?: string | null
          recording_id?: string | null
          revoked_at?: string | null
          revoked_reason?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offline_downloads_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "class_recordings"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          course_id: string | null
          created_at: string | null
          id: string
          payment_id: string | null
          price_inr: number
        }
        Insert: {
          course_id?: string | null
          created_at?: string | null
          id?: string
          payment_id?: string | null
          price_inr: number
        }
        Update: {
          course_id?: string | null
          created_at?: string | null
          id?: string
          payment_id?: string | null
          price_inr?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      page_visits: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          id: string
          page_path: string
          referrer: string | null
          user_agent: string | null
          user_id: string | null
          visitor_ip: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          page_path: string
          referrer?: string | null
          user_agent?: string | null
          user_id?: string | null
          visitor_ip?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          page_path?: string
          referrer?: string | null
          user_agent?: string | null
          user_id?: string | null
          visitor_ip?: string | null
        }
        Relationships: []
      }
      paper_test_results: {
        Row: {
          answers: Json | null
          created_at: string | null
          graded_at: string | null
          grading_status: string | null
          id: string
          paper_category: string
          paper_id: string
          percentage: number | null
          score: number | null
          student_id: string
          subject_id: string | null
          submitted_at: string | null
          time_taken_seconds: number | null
          total_questions: number
        }
        Insert: {
          answers?: Json | null
          created_at?: string | null
          graded_at?: string | null
          grading_status?: string | null
          id?: string
          paper_category: string
          paper_id: string
          percentage?: number | null
          score?: number | null
          student_id: string
          subject_id?: string | null
          submitted_at?: string | null
          time_taken_seconds?: number | null
          total_questions: number
        }
        Update: {
          answers?: Json | null
          created_at?: string | null
          graded_at?: string | null
          grading_status?: string | null
          id?: string
          paper_category?: string
          paper_id?: string
          percentage?: number | null
          score?: number | null
          student_id?: string
          subject_id?: string | null
          submitted_at?: string | null
          time_taken_seconds?: number | null
          total_questions?: number
        }
        Relationships: [
          {
            foreignKeyName: "paper_test_results_paper_id_fkey"
            columns: ["paper_id"]
            isOneToOne: false
            referencedRelation: "subject_previous_year_papers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paper_test_results_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "popular_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      parsed_questions_pending: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          approved_ip_address: unknown
          category_id: string
          chapter_id: string
          contains_formula: boolean | null
          correct_answer: string
          created_at: string | null
          difficulty: string | null
          document_id: string
          explanation: string | null
          explanation_images: string[] | null
          id: string
          instructor_comments: string | null
          is_approved: boolean | null
          llm_confidence_score: number | null
          llm_difficulty_reasoning: string | null
          llm_issues: Json | null
          llm_suggested_difficulty: string | null
          llm_verification_comments: string | null
          llm_verification_status: string | null
          llm_verified: boolean | null
          llm_verified_at: string | null
          marks: number | null
          option_images: Json | null
          options: Json | null
          question_bank_id: string | null
          question_format: string | null
          question_images: string[] | null
          question_text: string
          question_type: string
          subject_id: string
          subtopic_id: string | null
          topic_id: string | null
          transferred_at: string | null
          transferred_to_question_bank: boolean | null
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          approved_ip_address?: unknown
          category_id: string
          chapter_id: string
          contains_formula?: boolean | null
          correct_answer: string
          created_at?: string | null
          difficulty?: string | null
          document_id: string
          explanation?: string | null
          explanation_images?: string[] | null
          id?: string
          instructor_comments?: string | null
          is_approved?: boolean | null
          llm_confidence_score?: number | null
          llm_difficulty_reasoning?: string | null
          llm_issues?: Json | null
          llm_suggested_difficulty?: string | null
          llm_verification_comments?: string | null
          llm_verification_status?: string | null
          llm_verified?: boolean | null
          llm_verified_at?: string | null
          marks?: number | null
          option_images?: Json | null
          options?: Json | null
          question_bank_id?: string | null
          question_format?: string | null
          question_images?: string[] | null
          question_text: string
          question_type: string
          subject_id: string
          subtopic_id?: string | null
          topic_id?: string | null
          transferred_at?: string | null
          transferred_to_question_bank?: boolean | null
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          approved_ip_address?: unknown
          category_id?: string
          chapter_id?: string
          contains_formula?: boolean | null
          correct_answer?: string
          created_at?: string | null
          difficulty?: string | null
          document_id?: string
          explanation?: string | null
          explanation_images?: string[] | null
          id?: string
          instructor_comments?: string | null
          is_approved?: boolean | null
          llm_confidence_score?: number | null
          llm_difficulty_reasoning?: string | null
          llm_issues?: Json | null
          llm_suggested_difficulty?: string | null
          llm_verification_comments?: string | null
          llm_verification_status?: string | null
          llm_verified?: boolean | null
          llm_verified_at?: string | null
          marks?: number | null
          option_images?: Json | null
          options?: Json | null
          question_bank_id?: string | null
          question_format?: string | null
          question_images?: string[] | null
          question_text?: string
          question_type?: string
          subject_id?: string
          subtopic_id?: string | null
          topic_id?: string | null
          transferred_at?: string | null
          transferred_to_question_bank?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_parsed_questions_pending_approved_by"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parsed_questions_pending_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parsed_questions_pending_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "subject_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parsed_questions_pending_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "uploaded_question_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parsed_questions_pending_question_bank_id_fkey"
            columns: ["question_bank_id"]
            isOneToOne: true
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parsed_questions_pending_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "popular_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parsed_questions_pending_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "subtopics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parsed_questions_pending_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "subject_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      password_reset_otps: {
        Row: {
          attempts: number | null
          created_at: string | null
          email: string
          expires_at: string
          id: string
          otp_hash: string
          user_id: string
          verified: boolean | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          otp_hash: string
          user_id: string
          verified?: boolean | null
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          otp_hash?: string
          user_id?: string
          verified?: boolean | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_inr: number
          completed_at: string | null
          created_at: string | null
          currency: string | null
          discount_amount: number | null
          error_message: string | null
          final_amount: number
          gateway_order_id: string | null
          gateway_payment_id: string | null
          id: string
          metadata: Json | null
          order_id: string
          payment_gateway: string | null
          payment_method: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          amount_inr: number
          completed_at?: string | null
          created_at?: string | null
          currency?: string | null
          discount_amount?: number | null
          error_message?: string | null
          final_amount: number
          gateway_order_id?: string | null
          gateway_payment_id?: string | null
          id?: string
          metadata?: Json | null
          order_id: string
          payment_gateway?: string | null
          payment_method?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          amount_inr?: number
          completed_at?: string | null
          created_at?: string | null
          currency?: string | null
          discount_amount?: number | null
          error_message?: string | null
          final_amount?: number
          gateway_order_id?: string | null
          gateway_payment_id?: string | null
          id?: string
          metadata?: Json | null
          order_id?: string
          payment_gateway?: string | null
          payment_method?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      phone_otp_verifications: {
        Row: {
          attempts: number | null
          channel: string
          created_at: string | null
          expires_at: string
          id: string
          metadata: Json | null
          otp_hash: string
          phone_number: string
          purpose: string
          verified: boolean | null
        }
        Insert: {
          attempts?: number | null
          channel?: string
          created_at?: string | null
          expires_at: string
          id?: string
          metadata?: Json | null
          otp_hash: string
          phone_number: string
          purpose?: string
          verified?: boolean | null
        }
        Update: {
          attempts?: number | null
          channel?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          metadata?: Json | null
          otp_hash?: string
          phone_number?: string
          purpose?: string
          verified?: boolean | null
        }
        Relationships: []
      }
      podcast_listen_logs: {
        Row: {
          chapter_id: string | null
          created_at: string | null
          duration_seconds: number
          id: string
          listened_seconds: number
          podcast_title: string
          student_id: string
          subject_id: string | null
        }
        Insert: {
          chapter_id?: string | null
          created_at?: string | null
          duration_seconds?: number
          id?: string
          listened_seconds?: number
          podcast_title: string
          student_id: string
          subject_id?: string | null
        }
        Update: {
          chapter_id?: string | null
          created_at?: string | null
          duration_seconds?: number
          id?: string
          listened_seconds?: number
          podcast_title?: string
          student_id?: string
          subject_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "podcast_listen_logs_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "subject_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "podcast_listen_logs_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "popular_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      popular_subjects: {
        Row: {
          category_id: string
          content_json: Json | null
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          json_source_pdf_url: string | null
          name: string
          server_ip: string | null
          slug: string
          thumbnail_url: string | null
          updated_at: string | null
        }
        Insert: {
          category_id: string
          content_json?: Json | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          json_source_pdf_url?: string | null
          name: string
          server_ip?: string | null
          slug: string
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Update: {
          category_id?: string
          content_json?: Json | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          json_source_pdf_url?: string | null
          name?: string
          server_ip?: string | null
          slug?: string
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "popular_subjects_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      pregen_question_cache: {
        Row: {
          created_at: string
          question_id: string
          question_text: string | null
          response_json: Json | null
          subject_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          question_id: string
          question_text?: string | null
          response_json?: Json | null
          subject_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          question_id?: string
          question_text?: string | null
          response_json?: Json | null
          subject_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      presentation_update_runs: {
        Row: {
          completed_jobs: number
          created_at: string
          created_by: string | null
          current_job_index: number
          failed_jobs: number
          id: string
          job_queue: Json | null
          skipped_jobs: number
          status: string
          subject_id: string
          subject_name: string
          total_jobs: number
          updated_at: string
        }
        Insert: {
          completed_jobs?: number
          created_at?: string
          created_by?: string | null
          current_job_index?: number
          failed_jobs?: number
          id?: string
          job_queue?: Json | null
          skipped_jobs?: number
          status?: string
          subject_id: string
          subject_name: string
          total_jobs?: number
          updated_at?: string
        }
        Update: {
          completed_jobs?: number
          created_at?: string
          created_by?: string | null
          current_job_index?: number
          failed_jobs?: number
          id?: string
          job_queue?: Json | null
          skipped_jobs?: number
          status?: string
          subject_id?: string
          subject_name?: string
          total_jobs?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          date_of_birth: string | null
          email: string | null
          full_name: string | null
          id: string
          phone_number: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          phone_number?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone_number?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      published_reels: {
        Row: {
          chapter_id: string | null
          created_at: string
          document_id: string | null
          external_job_id: string
          id: string
          is_published: boolean
          published_by: string | null
          reel_index: number
          reel_job_id: string | null
          subject_id: string | null
          title: string | null
          topic_id: string | null
          updated_at: string
          variant: string
          variant_dir: string
          video_url: string
        }
        Insert: {
          chapter_id?: string | null
          created_at?: string
          document_id?: string | null
          external_job_id: string
          id?: string
          is_published?: boolean
          published_by?: string | null
          reel_index: number
          reel_job_id?: string | null
          subject_id?: string | null
          title?: string | null
          topic_id?: string | null
          updated_at?: string
          variant: string
          variant_dir: string
          video_url: string
        }
        Update: {
          chapter_id?: string | null
          created_at?: string
          document_id?: string | null
          external_job_id?: string
          id?: string
          is_published?: boolean
          published_by?: string | null
          reel_index?: number
          reel_job_id?: string | null
          subject_id?: string | null
          title?: string | null
          topic_id?: string | null
          updated_at?: string
          variant?: string
          variant_dir?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "published_reels_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "ai_assistant_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "published_reels_reel_job_id_fkey"
            columns: ["reel_job_id"]
            isOneToOne: false
            referencedRelation: "reel_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "published_reels_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "popular_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_reminder_email_logs: {
        Row: {
          created_at: string
          email: string
          error_message: string | null
          id: string
          sent_date: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          error_message?: string | null
          id?: string
          sent_date?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          error_message?: string | null
          id?: string
          sent_date?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_reminder_email_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_reminder_email_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "student_analytics_cache"
            referencedColumns: ["student_id"]
          },
        ]
      }
      purchase_reminder_messages: {
        Row: {
          created_at: string
          id: string
          message_body: string
          message_date: string
          subject_line: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_body: string
          message_date: string
          subject_line: string
        }
        Update: {
          created_at?: string
          id?: string
          message_body?: string
          message_date?: string
          subject_line?: string
        }
        Relationships: []
      }
      push_notification_tokens: {
        Row: {
          created_at: string | null
          device_info: Json | null
          id: string
          is_active: boolean | null
          platform: string
          token: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_info?: Json | null
          id?: string
          is_active?: boolean | null
          platform: string
          token: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_info?: Json | null
          id?: string
          is_active?: boolean | null
          platform?: string
          token?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pyq_questions: {
        Row: {
          chapter_id: string | null
          created_at: string
          difficulty: string
          id: string
          is_verified: boolean
          marks: number
          options: Json | null
          pyq_type: string
          question_format: string
          question_image_url: string | null
          question_text: string
          subject_id: string
          topic_id: string | null
        }
        Insert: {
          chapter_id?: string | null
          created_at?: string
          difficulty?: string
          id?: string
          is_verified?: boolean
          marks?: number
          options?: Json | null
          pyq_type: string
          question_format?: string
          question_image_url?: string | null
          question_text: string
          subject_id: string
          topic_id?: string | null
        }
        Update: {
          chapter_id?: string | null
          created_at?: string
          difficulty?: string
          id?: string
          is_verified?: boolean
          marks?: number
          options?: Json | null
          pyq_type?: string
          question_format?: string
          question_image_url?: string | null
          question_text?: string
          subject_id?: string
          topic_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pyq_questions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "subject_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pyq_questions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "popular_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pyq_questions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "subject_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      question_images: {
        Row: {
          bucket_name: string
          chapter_id: string | null
          created_at: string | null
          datalab_request_id: string | null
          document_id: string | null
          id: string
          ocr_result_id: string | null
          original_filename: string
          public_url: string
          storage_path: string
          subject_id: string | null
          topic_id: string | null
        }
        Insert: {
          bucket_name?: string
          chapter_id?: string | null
          created_at?: string | null
          datalab_request_id?: string | null
          document_id?: string | null
          id?: string
          ocr_result_id?: string | null
          original_filename: string
          public_url: string
          storage_path: string
          subject_id?: string | null
          topic_id?: string | null
        }
        Update: {
          bucket_name?: string
          chapter_id?: string | null
          created_at?: string | null
          datalab_request_id?: string | null
          document_id?: string | null
          id?: string
          ocr_result_id?: string | null
          original_filename?: string
          public_url?: string
          storage_path?: string
          subject_id?: string | null
          topic_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_images_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "subject_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_images_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "popular_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_images_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "subject_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      question_templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          options: Json
          question_format: string
          subject_id: string | null
          template_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          options: Json
          question_format: string
          subject_id?: string | null
          template_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          options?: Json
          question_format?: string
          subject_id?: string | null
          template_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_templates_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "popular_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          answer_source: string | null
          chapter_id: string | null
          contains_formula: boolean | null
          content_hash: string | null
          correct_answer: string
          created_at: string | null
          difficulty: string | null
          explanation: string | null
          formula_type: string | null
          id: string
          is_ai_generated: boolean | null
          is_important: boolean | null
          is_verified: boolean | null
          marks: number | null
          option_images: Json | null
          options: Json | null
          previous_year_paper_id: string | null
          question_format: string | null
          question_image_url: string | null
          question_text: string
          question_type: string
          source_document_id: string | null
          source_document_purpose: string | null
          subtopic_id: string | null
          topic_id: string | null
          verified_by: string | null
        }
        Insert: {
          answer_source?: string | null
          chapter_id?: string | null
          contains_formula?: boolean | null
          content_hash?: string | null
          correct_answer: string
          created_at?: string | null
          difficulty?: string | null
          explanation?: string | null
          formula_type?: string | null
          id?: string
          is_ai_generated?: boolean | null
          is_important?: boolean | null
          is_verified?: boolean | null
          marks?: number | null
          option_images?: Json | null
          options?: Json | null
          previous_year_paper_id?: string | null
          question_format?: string | null
          question_image_url?: string | null
          question_text: string
          question_type: string
          source_document_id?: string | null
          source_document_purpose?: string | null
          subtopic_id?: string | null
          topic_id?: string | null
          verified_by?: string | null
        }
        Update: {
          answer_source?: string | null
          chapter_id?: string | null
          contains_formula?: boolean | null
          content_hash?: string | null
          correct_answer?: string
          created_at?: string | null
          difficulty?: string | null
          explanation?: string | null
          formula_type?: string | null
          id?: string
          is_ai_generated?: boolean | null
          is_important?: boolean | null
          is_verified?: boolean | null
          marks?: number | null
          option_images?: Json | null
          options?: Json | null
          previous_year_paper_id?: string | null
          question_format?: string | null
          question_image_url?: string | null
          question_text?: string
          question_type?: string
          source_document_id?: string | null
          source_document_purpose?: string | null
          subtopic_id?: string | null
          topic_id?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "subject_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_previous_year_paper_id_fkey"
            columns: ["previous_year_paper_id"]
            isOneToOne: false
            referencedRelation: "subject_previous_year_papers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "uploaded_question_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "subtopics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "subject_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          answers: Json
          completed_at: string | null
          course_id: string | null
          id: string
          percentage: number | null
          questions: Json
          quiz_title: string
          score: number | null
          student_id: string | null
          time_taken_seconds: number | null
          total_questions: number | null
        }
        Insert: {
          answers: Json
          completed_at?: string | null
          course_id?: string | null
          id?: string
          percentage?: number | null
          questions: Json
          quiz_title: string
          score?: number | null
          student_id?: string | null
          time_taken_seconds?: number | null
          total_questions?: number | null
        }
        Update: {
          answers?: Json
          completed_at?: string | null
          course_id?: string | null
          id?: string
          percentage?: number | null
          questions?: Json
          quiz_title?: string
          score?: number | null
          student_id?: string | null
          time_taken_seconds?: number | null
          total_questions?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      reel_devserver_urls: {
        Row: {
          created_at: string
          external_job_id: string
          id: string
          reel_index: number
          reel_job_id: string | null
          server_ip: string | null
          target_port: number | null
          updated_at: string
          variant: string
          variant_dir: string | null
          video_url: string
        }
        Insert: {
          created_at?: string
          external_job_id: string
          id?: string
          reel_index?: number
          reel_job_id?: string | null
          server_ip?: string | null
          target_port?: number | null
          updated_at?: string
          variant: string
          variant_dir?: string | null
          video_url: string
        }
        Update: {
          created_at?: string
          external_job_id?: string
          id?: string
          reel_index?: number
          reel_job_id?: string | null
          server_ip?: string | null
          target_port?: number | null
          updated_at?: string
          variant?: string
          variant_dir?: string | null
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "reel_devserver_urls_reel_job_id_fkey"
            columns: ["reel_job_id"]
            isOneToOne: false
            referencedRelation: "reel_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      reel_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          document_id: string | null
          error: string | null
          file_name: string | null
          id: string
          job_id: string
          progress: number
          server_ip: string | null
          status: string
          status_message: string | null
          subject_id: string
          submitted_by: string | null
          target_port: number | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          document_id?: string | null
          error?: string | null
          file_name?: string | null
          id?: string
          job_id: string
          progress?: number
          server_ip?: string | null
          status?: string
          status_message?: string | null
          subject_id: string
          submitted_by?: string | null
          target_port?: number | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          document_id?: string | null
          error?: string | null
          file_name?: string | null
          id?: string
          job_id?: string
          progress?: number
          server_ip?: string | null
          status?: string
          status_message?: string | null
          subject_id?: string
          submitted_by?: string | null
          target_port?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      reel_vimeo_urls: {
        Row: {
          created_at: string
          external_job_id: string
          id: string
          reel_index: number
          reel_job_id: string | null
          updated_at: string
          variant: string
          vimeo_id: string | null
          vimeo_url: string
        }
        Insert: {
          created_at?: string
          external_job_id: string
          id?: string
          reel_index?: number
          reel_job_id?: string | null
          updated_at?: string
          variant: string
          vimeo_id?: string | null
          vimeo_url: string
        }
        Update: {
          created_at?: string
          external_job_id?: string
          id?: string
          reel_index?: number
          reel_job_id?: string | null
          updated_at?: string
          variant?: string
          vimeo_id?: string | null
          vimeo_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "reel_vimeo_urls_reel_job_id_fkey"
            columns: ["reel_job_id"]
            isOneToOne: false
            referencedRelation: "reel_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      regeneration_tasks: {
        Row: {
          completed_at: string | null
          created_by: string | null
          external_job_id: string
          id: string
          message: string | null
          phase: string
          progress: number
          section_ids: number[] | null
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_by?: string | null
          external_job_id: string
          id?: string
          message?: string | null
          phase: string
          progress?: number
          section_ids?: number[] | null
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_by?: string | null
          external_job_id?: string
          id?: string
          message?: string | null
          phase?: string
          progress?: number
          section_ids?: number[] | null
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      sales_faq_cache: {
        Row: {
          answer_text: string
          created_at: string | null
          id: string
          question_text: string
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          answer_text: string
          created_at?: string | null
          id?: string
          question_text: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          answer_text?: string
          created_at?: string | null
          id?: string
          question_text?: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: []
      }
      sales_leads: {
        Row: {
          conversation_history: Json | null
          created_at: string | null
          email: string | null
          id: string
          last_interaction_at: string | null
          lead_status: string | null
          mobile: string | null
          name: string
        }
        Insert: {
          conversation_history?: Json | null
          created_at?: string | null
          email?: string | null
          id?: string
          last_interaction_at?: string | null
          lead_status?: string | null
          mobile?: string | null
          name: string
        }
        Update: {
          conversation_history?: Json | null
          created_at?: string | null
          email?: string | null
          id?: string
          last_interaction_at?: string | null
          lead_status?: string | null
          mobile?: string | null
          name?: string
        }
        Relationships: []
      }
      scheduled_classes: {
        Row: {
          bbb_attendee_pw: string | null
          bbb_internal_meeting_id: string | null
          bbb_meeting_id: string | null
          bbb_moderator_pw: string | null
          chapter_id: string | null
          course_id: string
          created_at: string | null
          duration_minutes: number | null
          id: string
          is_cancelled: boolean | null
          is_live: boolean | null
          live_ended_at: string | null
          live_started_at: string | null
          meeting_link: string | null
          notes: string | null
          recording_added_at: string | null
          recording_url: string | null
          room_number: string | null
          scheduled_at: string
          subject: string
          subject_id: string | null
          teacher_id: string | null
          timetable_entry_id: string | null
          topic_id: string | null
        }
        Insert: {
          bbb_attendee_pw?: string | null
          bbb_internal_meeting_id?: string | null
          bbb_meeting_id?: string | null
          bbb_moderator_pw?: string | null
          chapter_id?: string | null
          course_id: string
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          is_cancelled?: boolean | null
          is_live?: boolean | null
          live_ended_at?: string | null
          live_started_at?: string | null
          meeting_link?: string | null
          notes?: string | null
          recording_added_at?: string | null
          recording_url?: string | null
          room_number?: string | null
          scheduled_at: string
          subject: string
          subject_id?: string | null
          teacher_id?: string | null
          timetable_entry_id?: string | null
          topic_id?: string | null
        }
        Update: {
          bbb_attendee_pw?: string | null
          bbb_internal_meeting_id?: string | null
          bbb_meeting_id?: string | null
          bbb_moderator_pw?: string | null
          chapter_id?: string | null
          course_id?: string
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          is_cancelled?: boolean | null
          is_live?: boolean | null
          live_ended_at?: string | null
          live_started_at?: string | null
          meeting_link?: string | null
          notes?: string | null
          recording_added_at?: string | null
          recording_url?: string | null
          room_number?: string | null
          scheduled_at?: string
          subject?: string
          subject_id?: string | null
          teacher_id?: string | null
          timetable_entry_id?: string | null
          topic_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_scheduled_classes_teacher"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_classes_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "subject_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_classes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_classes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "popular_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_classes_timetable_entry_id_fkey"
            columns: ["timetable_entry_id"]
            isOneToOne: false
            referencedRelation: "instructor_timetables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_classes_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "subject_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      self_test_answers: {
        Row: {
          ai_feedback: string | null
          answer_image_url: string | null
          answer_text: string | null
          chapter_id: string | null
          extracted_text: string | null
          id: string
          is_correct: boolean | null
          marks_awarded: number | null
          max_marks: number | null
          selected_option: string | null
          self_test_id: string
          self_test_question_id: string
          student_id: string
          submitted_at: string
          topic_id: string | null
        }
        Insert: {
          ai_feedback?: string | null
          answer_image_url?: string | null
          answer_text?: string | null
          chapter_id?: string | null
          extracted_text?: string | null
          id?: string
          is_correct?: boolean | null
          marks_awarded?: number | null
          max_marks?: number | null
          selected_option?: string | null
          self_test_id: string
          self_test_question_id: string
          student_id: string
          submitted_at?: string
          topic_id?: string | null
        }
        Update: {
          ai_feedback?: string | null
          answer_image_url?: string | null
          answer_text?: string | null
          chapter_id?: string | null
          extracted_text?: string | null
          id?: string
          is_correct?: boolean | null
          marks_awarded?: number | null
          max_marks?: number | null
          selected_option?: string | null
          self_test_id?: string
          self_test_question_id?: string
          student_id?: string
          submitted_at?: string
          topic_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "self_test_answers_self_test_id_fkey"
            columns: ["self_test_id"]
            isOneToOne: false
            referencedRelation: "self_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "self_test_answers_self_test_question_id_fkey"
            columns: ["self_test_question_id"]
            isOneToOne: false
            referencedRelation: "self_test_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      self_test_questions: {
        Row: {
          chapter_id: string | null
          correct_answer: string | null
          created_at: string
          id: string
          marks: number
          options: Json | null
          order_number: number
          question_id: string | null
          question_text: string
          section: string
          self_test_id: string
          topic_id: string | null
        }
        Insert: {
          chapter_id?: string | null
          correct_answer?: string | null
          created_at?: string
          id?: string
          marks?: number
          options?: Json | null
          order_number?: number
          question_id?: string | null
          question_text: string
          section: string
          self_test_id: string
          topic_id?: string | null
        }
        Update: {
          chapter_id?: string | null
          correct_answer?: string | null
          created_at?: string
          id?: string
          marks?: number
          options?: Json | null
          order_number?: number
          question_id?: string | null
          question_text?: string
          section?: string
          self_test_id?: string
          topic_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "self_test_questions_self_test_id_fkey"
            columns: ["self_test_id"]
            isOneToOne: false
            referencedRelation: "self_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      self_tests: {
        Row: {
          chapter_ids: string[]
          course_id: string
          created_at: string
          duration_minutes: number
          id: string
          mcq_count: number
          mcq_score: number | null
          percentage: number | null
          scheduled_at: string
          status: string
          student_id: string
          subject_id: string
          submitted_at: string | null
          test_type: string
          title: string
          topic_ids: string[]
          total_max_marks: number | null
          total_questions: number
          total_score: number | null
          written_count: number
          written_score: number | null
        }
        Insert: {
          chapter_ids?: string[]
          course_id: string
          created_at?: string
          duration_minutes?: number
          id?: string
          mcq_count?: number
          mcq_score?: number | null
          percentage?: number | null
          scheduled_at: string
          status?: string
          student_id: string
          subject_id: string
          submitted_at?: string | null
          test_type: string
          title: string
          topic_ids?: string[]
          total_max_marks?: number | null
          total_questions?: number
          total_score?: number | null
          written_count?: number
          written_score?: number | null
        }
        Update: {
          chapter_ids?: string[]
          course_id?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          mcq_count?: number
          mcq_score?: number | null
          percentage?: number | null
          scheduled_at?: string
          status?: string
          student_id?: string
          subject_id?: string
          submitted_at?: string | null
          test_type?: string
          title?: string
          topic_ids?: string[]
          total_max_marks?: number | null
          total_questions?: number
          total_score?: number | null
          written_count?: number
          written_score?: number | null
        }
        Relationships: []
      }
      slide_results: {
        Row: {
          created_at: string
          id: string
          job_id: string
          llm_model: string | null
          processing_completed_at: string | null
          processing_started_at: string | null
          raw_llm_response: string | null
          repaired_json: string | null
          slides: Json
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          job_id: string
          llm_model?: string | null
          processing_completed_at?: string | null
          processing_started_at?: string | null
          raw_llm_response?: string | null
          repaired_json?: string | null
          slides: Json
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          llm_model?: string | null
          processing_completed_at?: string | null
          processing_started_at?: string | null
          raw_llm_response?: string | null
          repaired_json?: string | null
          slides?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "slide_results_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      slides: {
        Row: {
          content: string | null
          created_at: string
          id: string
          job_id: string
          narration_language: string | null
          narration_script: string | null
          slide_index: string
          title: string | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          id: string
          job_id: string
          narration_language?: string | null
          narration_script?: string | null
          slide_index: string
          title?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          job_id?: string
          narration_language?: string | null
          narration_script?: string | null
          slide_index?: string
          title?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "slides_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_files: {
        Row: {
          b2_file_id: string | null
          category_id: string | null
          chapter_id: string | null
          created_at: string | null
          entity_type: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          subject_id: string | null
          subtopic_id: string | null
          topic_id: string | null
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          b2_file_id?: string | null
          category_id?: string | null
          chapter_id?: string | null
          created_at?: string | null
          entity_type: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          subject_id?: string | null
          subtopic_id?: string | null
          topic_id?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          b2_file_id?: string | null
          category_id?: string | null
          chapter_id?: string | null
          created_at?: string | null
          entity_type?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          subject_id?: string | null
          subtopic_id?: string | null
          topic_id?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "storage_files_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storage_files_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "subject_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storage_files_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "popular_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storage_files_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "subtopics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storage_files_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "subject_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      student_lecture_notes: {
        Row: {
          chapter_id: string | null
          content: string
          created_at: string
          id: string
          job_id: string
          student_id: string
          subject_id: string | null
          topic_id: string | null
          updated_at: string
        }
        Insert: {
          chapter_id?: string | null
          content?: string
          created_at?: string
          id?: string
          job_id: string
          student_id: string
          subject_id?: string | null
          topic_id?: string | null
          updated_at?: string
        }
        Update: {
          chapter_id?: string | null
          content?: string
          created_at?: string
          id?: string
          job_id?: string
          student_id?: string
          subject_id?: string | null
          topic_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_lecture_notes_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "subject_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_lecture_notes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "popular_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_lecture_notes_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "subject_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      student_activity_log: {
        Row: {
          activity_type: Database["public"]["Enums"]["activity_type"]
          created_at: string | null
          id: string
          metadata: Json | null
          student_id: string
        }
        Insert: {
          activity_type: Database["public"]["Enums"]["activity_type"]
          created_at?: string | null
          id?: string
          metadata?: Json | null
          student_id: string
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["activity_type"]
          created_at?: string | null
          id?: string
          metadata?: Json | null
          student_id?: string
        }
        Relationships: []
      }
      student_answers: {
        Row: {
          answer_image_url: string | null
          answer_text: string | null
          created_at: string | null
          extracted_answer_text: string | null
          extraction_confidence: string | null
          id: string
          paper_id: string
          question_id: string
          submitted_at: string | null
          user_id: string
        }
        Insert: {
          answer_image_url?: string | null
          answer_text?: string | null
          created_at?: string | null
          extracted_answer_text?: string | null
          extraction_confidence?: string | null
          id?: string
          paper_id: string
          question_id: string
          submitted_at?: string | null
          user_id: string
        }
        Update: {
          answer_image_url?: string | null
          answer_text?: string | null
          created_at?: string | null
          extracted_answer_text?: string | null
          extraction_confidence?: string | null
          id?: string
          paper_id?: string
          question_id?: string
          submitted_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_answers_paper_id_fkey"
            columns: ["paper_id"]
            isOneToOne: false
            referencedRelation: "subject_previous_year_papers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      student_badges: {
        Row: {
          badge_type: Database["public"]["Enums"]["badge_type"]
          chapter_id: string | null
          course_id: string | null
          description: string | null
          earned_at: string
          id: string
          student_id: string
          subject_id: string | null
          title: string
          topic_id: string | null
        }
        Insert: {
          badge_type: Database["public"]["Enums"]["badge_type"]
          chapter_id?: string | null
          course_id?: string | null
          description?: string | null
          earned_at?: string
          id?: string
          student_id: string
          subject_id?: string | null
          title: string
          topic_id?: string | null
        }
        Update: {
          badge_type?: Database["public"]["Enums"]["badge_type"]
          chapter_id?: string | null
          course_id?: string | null
          description?: string | null
          earned_at?: string
          id?: string
          student_id?: string
          subject_id?: string | null
          title?: string
          topic_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_badges_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "subject_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_badges_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_badges_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "popular_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_badges_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "subject_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      student_followups: {
        Row: {
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          followup_type: Database["public"]["Enums"]["followup_type"]
          id: string
          message: string
          priority: Database["public"]["Enums"]["followup_priority"] | null
          scheduled_for: string
          status: Database["public"]["Enums"]["followup_status"] | null
          student_id: string
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          followup_type: Database["public"]["Enums"]["followup_type"]
          id?: string
          message: string
          priority?: Database["public"]["Enums"]["followup_priority"] | null
          scheduled_for: string
          status?: Database["public"]["Enums"]["followup_status"] | null
          student_id: string
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          followup_type?: Database["public"]["Enums"]["followup_type"]
          id?: string
          message?: string
          priority?: Database["public"]["Enums"]["followup_priority"] | null
          scheduled_for?: string
          status?: Database["public"]["Enums"]["followup_status"] | null
          student_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      student_progress: {
        Row: {
          chapter_id: string | null
          completed_at: string | null
          created_at: string
          id: string
          is_completed: boolean | null
          is_unlocked: boolean | null
          score: number | null
          student_id: string
          time_spent_seconds: number | null
          topic_id: string | null
          updated_at: string | null
        }
        Insert: {
          chapter_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean | null
          is_unlocked?: boolean | null
          score?: number | null
          student_id: string
          time_spent_seconds?: number | null
          topic_id?: string | null
          updated_at?: string | null
        }
        Update: {
          chapter_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean | null
          is_unlocked?: boolean | null
          score?: number | null
          student_id?: string
          time_spent_seconds?: number | null
          topic_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_progress_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_analytics_cache"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_progress_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      student_progress_2025: {
        Row: {
          chapter_id: string | null
          completed_at: string | null
          created_at: string
          id: string
          is_completed: boolean | null
          is_unlocked: boolean | null
          score: number | null
          student_id: string
          time_spent_seconds: number | null
          topic_id: string | null
          updated_at: string | null
        }
        Insert: {
          chapter_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean | null
          is_unlocked?: boolean | null
          score?: number | null
          student_id: string
          time_spent_seconds?: number | null
          topic_id?: string | null
          updated_at?: string | null
        }
        Update: {
          chapter_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean | null
          is_unlocked?: boolean | null
          score?: number | null
          student_id?: string
          time_spent_seconds?: number | null
          topic_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      student_progress_2026: {
        Row: {
          chapter_id: string | null
          completed_at: string | null
          created_at: string
          id: string
          is_completed: boolean | null
          is_unlocked: boolean | null
          score: number | null
          student_id: string
          time_spent_seconds: number | null
          topic_id: string | null
          updated_at: string | null
        }
        Insert: {
          chapter_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean | null
          is_unlocked?: boolean | null
          score?: number | null
          student_id: string
          time_spent_seconds?: number | null
          topic_id?: string | null
          updated_at?: string | null
        }
        Update: {
          chapter_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean | null
          is_unlocked?: boolean | null
          score?: number | null
          student_id?: string
          time_spent_seconds?: number | null
          topic_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      study_timetable_sessions: {
        Row: {
          chapter_id: string | null
          course_id: string
          created_at: string
          duration_minutes: number
          id: string
          reminder_1h_sent_at: string | null
          reminder_24h_sent_at: string | null
          reminder_sent_at: string | null
          scheduled_at: string
          self_test_id: string | null
          session_type: string
          status: string
          student_id: string
          subject_id: string | null
          timetable_id: string
          title: string
          topic_id: string | null
          updated_at: string
        }
        Insert: {
          chapter_id?: string | null
          course_id: string
          created_at?: string
          duration_minutes?: number
          id?: string
          reminder_1h_sent_at?: string | null
          reminder_24h_sent_at?: string | null
          reminder_sent_at?: string | null
          scheduled_at: string
          self_test_id?: string | null
          session_type?: string
          status?: string
          student_id: string
          subject_id?: string | null
          timetable_id: string
          title: string
          topic_id?: string | null
          updated_at?: string
        }
        Update: {
          chapter_id?: string | null
          course_id?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          reminder_1h_sent_at?: string | null
          reminder_24h_sent_at?: string | null
          reminder_sent_at?: string | null
          scheduled_at?: string
          self_test_id?: string | null
          session_type?: string
          status?: string
          student_id?: string
          subject_id?: string | null
          timetable_id?: string
          title?: string
          topic_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_timetable_sessions_self_test_id_fkey"
            columns: ["self_test_id"]
            isOneToOne: false
            referencedRelation: "self_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_timetable_sessions_timetable_id_fkey"
            columns: ["timetable_id"]
            isOneToOne: false
            referencedRelation: "study_timetables"
            referencedColumns: ["id"]
          },
        ]
      }
      study_timetables: {
        Row: {
          course_id: string
          created_at: string
          id: string
          is_active: boolean
          mode: string
          plan_metadata: Json
          student_id: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          mode: string
          plan_metadata?: Json
          student_id: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          mode?: string
          plan_metadata?: Json
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_timetables_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_chapters: {
        Row: {
          ai_generated_podcast_url: string | null
          ai_generated_video_url: string | null
          ai_presentation_json: Json | null
          chapter_number: number
          content_json: Json | null
          created_at: string | null
          description: string | null
          id: string
          notes_markdown: string | null
          pdf_url: string | null
          sequence_order: number | null
          subject_id: string
          title: string
          updated_at: string | null
          video_id: string | null
          video_platform: string | null
        }
        Insert: {
          ai_generated_podcast_url?: string | null
          ai_generated_video_url?: string | null
          ai_presentation_json?: Json | null
          chapter_number: number
          content_json?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          notes_markdown?: string | null
          pdf_url?: string | null
          sequence_order?: number | null
          subject_id: string
          title: string
          updated_at?: string | null
          video_id?: string | null
          video_platform?: string | null
        }
        Update: {
          ai_generated_podcast_url?: string | null
          ai_generated_video_url?: string | null
          ai_presentation_json?: Json | null
          chapter_number?: number
          content_json?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          notes_markdown?: string | null
          pdf_url?: string | null
          sequence_order?: number | null
          subject_id?: string
          title?: string
          updated_at?: string | null
          video_id?: string | null
          video_platform?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subject_chapters_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "popular_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_previous_year_papers: {
        Row: {
          chapter_id: string | null
          created_at: string | null
          document_type: string | null
          exam_name: string
          id: string
          paper_category: string | null
          paper_type: string | null
          pdf_url: string | null
          subject_id: string
          topic_id: string | null
          total_questions: number | null
          year: number
        }
        Insert: {
          chapter_id?: string | null
          created_at?: string | null
          document_type?: string | null
          exam_name: string
          id?: string
          paper_category?: string | null
          paper_type?: string | null
          pdf_url?: string | null
          subject_id: string
          topic_id?: string | null
          total_questions?: number | null
          year: number
        }
        Update: {
          chapter_id?: string | null
          created_at?: string | null
          document_type?: string | null
          exam_name?: string
          id?: string
          paper_category?: string | null
          paper_type?: string | null
          pdf_url?: string | null
          subject_id?: string
          topic_id?: string | null
          total_questions?: number | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "subject_previous_year_papers_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "subject_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_previous_year_papers_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "popular_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_previous_year_papers_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "subject_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_thumbnails: {
        Row: {
          created_at: string | null
          id: string
          storage_url: string
          subject_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          storage_url: string
          subject_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          storage_url?: string
          subject_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subject_thumbnails_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: true
            referencedRelation: "popular_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_topics: {
        Row: {
          ai_generated_podcast_url: string | null
          ai_generated_video_url: string | null
          ai_presentation_json: Json | null
          chapter_id: string
          content_json: Json | null
          content_markdown: string | null
          created_at: string | null
          estimated_duration_minutes: number | null
          id: string
          notes_markdown: string | null
          pdf_url: string | null
          sequence_order: number | null
          title: string
          topic_number: string
          updated_at: string | null
          video_id: string | null
          video_platform: string | null
          video_url: string | null
        }
        Insert: {
          ai_generated_podcast_url?: string | null
          ai_generated_video_url?: string | null
          ai_presentation_json?: Json | null
          chapter_id: string
          content_json?: Json | null
          content_markdown?: string | null
          created_at?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          notes_markdown?: string | null
          pdf_url?: string | null
          sequence_order?: number | null
          title: string
          topic_number: string
          updated_at?: string | null
          video_id?: string | null
          video_platform?: string | null
          video_url?: string | null
        }
        Update: {
          ai_generated_podcast_url?: string | null
          ai_generated_video_url?: string | null
          ai_presentation_json?: Json | null
          chapter_id?: string
          content_json?: Json | null
          content_markdown?: string | null
          created_at?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          notes_markdown?: string | null
          pdf_url?: string | null
          sequence_order?: number | null
          title?: string
          topic_number?: string
          updated_at?: string | null
          video_id?: string | null
          video_platform?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subject_topics_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "subject_chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      subtopics: {
        Row: {
          ai_generated_podcast_url: string | null
          ai_generated_video_url: string | null
          content_json: Json | null
          content_markdown: string | null
          created_at: string | null
          description: string | null
          estimated_duration_minutes: number | null
          id: string
          notes_markdown: string | null
          pdf_url: string | null
          sequence_order: number | null
          title: string
          topic_id: string
          updated_at: string | null
          video_id: string | null
          video_platform: string | null
        }
        Insert: {
          ai_generated_podcast_url?: string | null
          ai_generated_video_url?: string | null
          content_json?: Json | null
          content_markdown?: string | null
          created_at?: string | null
          description?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          notes_markdown?: string | null
          pdf_url?: string | null
          sequence_order?: number | null
          title: string
          topic_id: string
          updated_at?: string | null
          video_id?: string | null
          video_platform?: string | null
        }
        Update: {
          ai_generated_podcast_url?: string | null
          ai_generated_video_url?: string | null
          content_json?: Json | null
          content_markdown?: string | null
          created_at?: string | null
          description?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          notes_markdown?: string | null
          pdf_url?: string | null
          sequence_order?: number | null
          title?: string
          topic_id?: string
          updated_at?: string | null
          video_id?: string | null
          video_platform?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subtopics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      support_article_feedback: {
        Row: {
          article_id: string
          created_at: string | null
          id: string
          is_helpful: boolean
          user_id: string
        }
        Insert: {
          article_id: string
          created_at?: string | null
          id?: string
          is_helpful: boolean
          user_id: string
        }
        Update: {
          article_id?: string
          created_at?: string | null
          id?: string
          is_helpful?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_article_feedback_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "support_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_articles: {
        Row: {
          content: string
          created_at: string | null
          description: string
          display_order: number | null
          helpful_count: number | null
          icon_name: string | null
          id: string
          is_active: boolean | null
          not_helpful_count: number | null
          slug: string
          title: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          description: string
          display_order?: number | null
          helpful_count?: number | null
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          not_helpful_count?: number | null
          slug: string
          title: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          description?: string
          display_order?: number | null
          helpful_count?: number | null
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          not_helpful_count?: number | null
          slug?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      support_faqs: {
        Row: {
          answer: string
          category: string
          created_at: string
          display_order: number | null
          helpful_count: number | null
          id: string
          is_active: boolean | null
          question: string
          updated_at: string
        }
        Insert: {
          answer: string
          category: string
          created_at?: string
          display_order?: number | null
          helpful_count?: number | null
          id?: string
          is_active?: boolean | null
          question: string
          updated_at?: string
        }
        Update: {
          answer?: string
          category?: string
          created_at?: string
          display_order?: number | null
          helpful_count?: number | null
          id?: string
          is_active?: boolean | null
          question?: string
          updated_at?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          sender_type: string
          ticket_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          sender_type: string
          ticket_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          sender_type?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_ticket_sla"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          ai_auto_escalated: boolean | null
          ai_classification: string | null
          ai_confidence: number | null
          assigned_admin_id: string | null
          category: string
          closed_at: string | null
          created_at: string
          escalated_at: string | null
          id: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_auto_escalated?: boolean | null
          ai_classification?: string | null
          ai_confidence?: number | null
          assigned_admin_id?: string | null
          category: string
          closed_at?: string | null
          created_at?: string
          escalated_at?: string | null
          id?: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_auto_escalated?: boolean | null
          ai_classification?: string | null
          ai_confidence?: number | null
          assigned_admin_id?: string | null
          category?: string
          closed_at?: string | null
          created_at?: string
          escalated_at?: string | null
          id?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      teacher_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          date_of_joining: string | null
          department_id: string | null
          email: string | null
          employee_id: string | null
          experience_years: number | null
          full_name: string
          id: string
          phone_number: string | null
          qualification: string | null
          specialization: string[] | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          date_of_joining?: string | null
          department_id?: string | null
          email?: string | null
          employee_id?: string | null
          experience_years?: number | null
          full_name: string
          id: string
          phone_number?: string | null
          qualification?: string | null
          specialization?: string[] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          date_of_joining?: string | null
          department_id?: string | null
          email?: string | null
          employee_id?: string | null
          experience_years?: number | null
          full_name?: string
          id?: string
          phone_number?: string | null
          qualification?: string | null
          specialization?: string[] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      teaching_qa_cache: {
        Row: {
          answer_html: string | null
          answer_text: string
          audio_narration_url: string | null
          avg_satisfaction: number | null
          chapter_id: string | null
          created_at: string | null
          diagrams_urls: Json | null
          id: string
          key_points: Json | null
          language: string | null
          latex_formulas: Json | null
          presentation_slides: Json | null
          question_hash: string
          question_text: string
          slide_audio_urls: Json | null
          subject_id: string | null
          topic_id: string | null
          total_duration_seconds: number | null
          updated_at: string | null
          usage_count: number | null
          variation_number: number
        }
        Insert: {
          answer_html?: string | null
          answer_text: string
          audio_narration_url?: string | null
          avg_satisfaction?: number | null
          chapter_id?: string | null
          created_at?: string | null
          diagrams_urls?: Json | null
          id?: string
          key_points?: Json | null
          language?: string | null
          latex_formulas?: Json | null
          presentation_slides?: Json | null
          question_hash: string
          question_text: string
          slide_audio_urls?: Json | null
          subject_id?: string | null
          topic_id?: string | null
          total_duration_seconds?: number | null
          updated_at?: string | null
          usage_count?: number | null
          variation_number?: number
        }
        Update: {
          answer_html?: string | null
          answer_text?: string
          audio_narration_url?: string | null
          avg_satisfaction?: number | null
          chapter_id?: string | null
          created_at?: string | null
          diagrams_urls?: Json | null
          id?: string
          key_points?: Json | null
          language?: string | null
          latex_formulas?: Json | null
          presentation_slides?: Json | null
          question_hash?: string
          question_text?: string
          slide_audio_urls?: Json | null
          subject_id?: string | null
          topic_id?: string | null
          total_duration_seconds?: number | null
          updated_at?: string | null
          usage_count?: number | null
          variation_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "teaching_qa_cache_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "subject_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_qa_cache_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "subject_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      test_questions: {
        Row: {
          created_at: string | null
          id: string
          marks: number | null
          order_number: number
          question_id: string
          test_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          marks?: number | null
          order_number?: number
          question_id: string
          test_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          marks?: number | null
          order_number?: number
          question_id?: string
          test_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_questions_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      test_results: {
        Row: {
          answers: Json | null
          chapter_id: string | null
          created_at: string | null
          graded_at: string | null
          grading_status: string | null
          id: string
          percentage: number | null
          score: number | null
          student_id: string
          subject_id: string | null
          submitted_at: string | null
          test_id: string | null
          test_type: string
          time_taken_seconds: number | null
          topic_id: string | null
          total_questions: number
        }
        Insert: {
          answers?: Json | null
          chapter_id?: string | null
          created_at?: string | null
          graded_at?: string | null
          grading_status?: string | null
          id?: string
          percentage?: number | null
          score?: number | null
          student_id: string
          subject_id?: string | null
          submitted_at?: string | null
          test_id?: string | null
          test_type?: string
          time_taken_seconds?: number | null
          topic_id?: string | null
          total_questions: number
        }
        Update: {
          answers?: Json | null
          chapter_id?: string | null
          created_at?: string | null
          graded_at?: string | null
          grading_status?: string | null
          id?: string
          percentage?: number | null
          score?: number | null
          student_id?: string
          subject_id?: string | null
          submitted_at?: string | null
          test_id?: string | null
          test_type?: string
          time_taken_seconds?: number | null
          topic_id?: string | null
          total_questions?: number
        }
        Relationships: [
          {
            foreignKeyName: "test_results_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "popular_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_results_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      test_submissions: {
        Row: {
          answers: Json
          chapter_id: string | null
          id: string
          score: number | null
          student_id: string
          submitted_at: string | null
          time_taken_seconds: number | null
          topic_id: string | null
          total_marks: number | null
        }
        Insert: {
          answers: Json
          chapter_id?: string | null
          id?: string
          score?: number | null
          student_id: string
          submitted_at?: string | null
          time_taken_seconds?: number | null
          topic_id?: string | null
          total_marks?: number | null
        }
        Update: {
          answers?: Json
          chapter_id?: string | null
          id?: string
          score?: number | null
          student_id?: string
          submitted_at?: string | null
          time_taken_seconds?: number | null
          topic_id?: string | null
          total_marks?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "test_submissions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_analytics_cache"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "test_submissions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      tests: {
        Row: {
          chapter_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          is_active: boolean | null
          subject_id: string | null
          test_type: string
          title: string
          topic_id: string | null
          total_marks: number | null
          updated_at: string | null
        }
        Insert: {
          chapter_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean | null
          subject_id?: string | null
          test_type: string
          title: string
          topic_id?: string | null
          total_marks?: number | null
          updated_at?: string | null
        }
        Update: {
          chapter_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean | null
          subject_id?: string | null
          test_type?: string
          title?: string
          topic_id?: string | null
          total_marks?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tests_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "subject_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tests_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "popular_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tests_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "subject_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      timetable_overrides: {
        Row: {
          course_timetable_id: string | null
          created_at: string | null
          end_time: string
          id: string
          instructor_id: string | null
          is_cancelled: boolean | null
          override_date: string
          reason: string | null
          room_number: string | null
          start_time: string
          subject_id: string | null
        }
        Insert: {
          course_timetable_id?: string | null
          created_at?: string | null
          end_time: string
          id?: string
          instructor_id?: string | null
          is_cancelled?: boolean | null
          override_date: string
          reason?: string | null
          room_number?: string | null
          start_time: string
          subject_id?: string | null
        }
        Update: {
          course_timetable_id?: string | null
          created_at?: string | null
          end_time?: string
          id?: string
          instructor_id?: string | null
          is_cancelled?: boolean | null
          override_date?: string
          reason?: string | null
          room_number?: string | null
          start_time?: string
          subject_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timetable_overrides_course_timetable_id_fkey"
            columns: ["course_timetable_id"]
            isOneToOne: false
            referencedRelation: "course_timetables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_overrides_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_overrides_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "popular_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_lecture_visibility: {
        Row: {
          created_at: string
          mode: string
          topic_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          mode?: string
          topic_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          mode?: string
          topic_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "topic_lecture_visibility_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: true
            referencedRelation: "subject_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_videos: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          language: string
          topic_id: string
          updated_at: string | null
          video_id: string
          video_name: string
          video_platform: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          language?: string
          topic_id: string
          updated_at?: string | null
          video_id: string
          video_name: string
          video_platform?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          language?: string
          topic_id?: string
          updated_at?: string | null
          video_id?: string
          video_name?: string
          video_platform?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "topic_videos_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "subject_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          ai_slides_url: string | null
          chapter_id: string
          content_markdown: string | null
          content_url: string | null
          created_at: string | null
          estimated_duration_minutes: number | null
          id: string
          sequence_order: number | null
          title: string
          topic_number: number
          video_url: string | null
        }
        Insert: {
          ai_slides_url?: string | null
          chapter_id: string
          content_markdown?: string | null
          content_url?: string | null
          created_at?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          sequence_order?: number | null
          title: string
          topic_number: number
          video_url?: string | null
        }
        Update: {
          ai_slides_url?: string | null
          chapter_id?: string
          content_markdown?: string | null
          content_url?: string | null
          created_at?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          sequence_order?: number | null
          title?: string
          topic_number?: number
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "topics_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      uploaded_question_documents: {
        Row: {
          ai_verified_at: string | null
          category_id: string
          chapter_id: string
          created_at: string | null
          current_job_id: string | null
          display_name: string | null
          document_purpose: string | null
          error_message: string | null
          extracted_images: Json | null
          file_name: string | null
          file_size_bytes: number | null
          file_type: string
          file_url: string | null
          human_verified_at: string | null
          id: string
          mathpix_html: string | null
          mathpix_json_output: Json | null
          mathpix_latex: string | null
          mathpix_markdown: string | null
          mathpix_mmd: string | null
          mathpix_pdf_id: string | null
          mathpix_questions_pdf_id: string | null
          mathpix_solutions_pdf_id: string | null
          processing_completed_at: string | null
          processing_started_at: string | null
          questions_count: number | null
          questions_file_name: string | null
          questions_file_url: string | null
          questions_images_folder: string | null
          questions_mmd_content: string | null
          questions_pdf_url: string | null
          solutions_file_name: string | null
          solutions_file_url: string | null
          solutions_images_folder: string | null
          solutions_mmd_content: string | null
          solutions_pdf_url: string | null
          status: string | null
          subject_id: string
          subtopic_id: string | null
          topic_id: string | null
          updated_at: string | null
          uploaded_by: string
          validation_notes: string | null
          validation_status: string | null
          verification_notes: string | null
          verification_quality_score: number | null
          verified_by_ai: boolean | null
          verified_by_human: boolean | null
          verified_by_user_id: string | null
          verified_questions_count: number | null
        }
        Insert: {
          ai_verified_at?: string | null
          category_id: string
          chapter_id: string
          created_at?: string | null
          current_job_id?: string | null
          display_name?: string | null
          document_purpose?: string | null
          error_message?: string | null
          extracted_images?: Json | null
          file_name?: string | null
          file_size_bytes?: number | null
          file_type: string
          file_url?: string | null
          human_verified_at?: string | null
          id?: string
          mathpix_html?: string | null
          mathpix_json_output?: Json | null
          mathpix_latex?: string | null
          mathpix_markdown?: string | null
          mathpix_mmd?: string | null
          mathpix_pdf_id?: string | null
          mathpix_questions_pdf_id?: string | null
          mathpix_solutions_pdf_id?: string | null
          processing_completed_at?: string | null
          processing_started_at?: string | null
          questions_count?: number | null
          questions_file_name?: string | null
          questions_file_url?: string | null
          questions_images_folder?: string | null
          questions_mmd_content?: string | null
          questions_pdf_url?: string | null
          solutions_file_name?: string | null
          solutions_file_url?: string | null
          solutions_images_folder?: string | null
          solutions_mmd_content?: string | null
          solutions_pdf_url?: string | null
          status?: string | null
          subject_id: string
          subtopic_id?: string | null
          topic_id?: string | null
          updated_at?: string | null
          uploaded_by: string
          validation_notes?: string | null
          validation_status?: string | null
          verification_notes?: string | null
          verification_quality_score?: number | null
          verified_by_ai?: boolean | null
          verified_by_human?: boolean | null
          verified_by_user_id?: string | null
          verified_questions_count?: number | null
        }
        Update: {
          ai_verified_at?: string | null
          category_id?: string
          chapter_id?: string
          created_at?: string | null
          current_job_id?: string | null
          display_name?: string | null
          document_purpose?: string | null
          error_message?: string | null
          extracted_images?: Json | null
          file_name?: string | null
          file_size_bytes?: number | null
          file_type?: string
          file_url?: string | null
          human_verified_at?: string | null
          id?: string
          mathpix_html?: string | null
          mathpix_json_output?: Json | null
          mathpix_latex?: string | null
          mathpix_markdown?: string | null
          mathpix_mmd?: string | null
          mathpix_pdf_id?: string | null
          mathpix_questions_pdf_id?: string | null
          mathpix_solutions_pdf_id?: string | null
          processing_completed_at?: string | null
          processing_started_at?: string | null
          questions_count?: number | null
          questions_file_name?: string | null
          questions_file_url?: string | null
          questions_images_folder?: string | null
          questions_mmd_content?: string | null
          questions_pdf_url?: string | null
          solutions_file_name?: string | null
          solutions_file_url?: string | null
          solutions_images_folder?: string | null
          solutions_mmd_content?: string | null
          solutions_pdf_url?: string | null
          status?: string | null
          subject_id?: string
          subtopic_id?: string | null
          topic_id?: string | null
          updated_at?: string | null
          uploaded_by?: string
          validation_notes?: string | null
          validation_status?: string | null
          verification_notes?: string | null
          verification_quality_score?: number | null
          verified_by_ai?: boolean | null
          verified_by_human?: boolean | null
          verified_by_user_id?: string | null
          verified_questions_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "uploaded_question_documents_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uploaded_question_documents_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "subject_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uploaded_question_documents_current_job_id_fkey"
            columns: ["current_job_id"]
            isOneToOne: false
            referencedRelation: "document_processing_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uploaded_question_documents_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "popular_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uploaded_question_documents_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "subtopics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uploaded_question_documents_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "subject_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uploaded_question_documents_verified_by_user_id_fkey"
            columns: ["verified_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uploaded_question_documents_verified_by_user_id_fkey"
            columns: ["verified_by_user_id"]
            isOneToOne: false
            referencedRelation: "student_analytics_cache"
            referencedColumns: ["student_id"]
          },
        ]
      }
      user_push_tokens: {
        Row: {
          fcm_token: string
          id: string
          platform: string
          updated_at: string
          user_id: string
        }
        Insert: {
          fcm_token: string
          id?: string
          platform?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          fcm_token?: string
          id?: string
          platform?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verification_notifications: {
        Row: {
          created_at: string | null
          document_id: string
          id: string
          is_read: boolean | null
          message: string
          notification_type: string
          read_at: string | null
          recipient_id: string
        }
        Insert: {
          created_at?: string | null
          document_id: string
          id?: string
          is_read?: boolean | null
          message: string
          notification_type: string
          read_at?: string | null
          recipient_id: string
        }
        Update: {
          created_at?: string | null
          document_id?: string
          id?: string
          is_read?: boolean | null
          message?: string
          notification_type?: string
          read_at?: string | null
          recipient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_notifications_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "uploaded_question_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "student_analytics_cache"
            referencedColumns: ["student_id"]
          },
        ]
      }
      video_generation_jobs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          current_phase: string | null
          current_step: string | null
          document_id: string | null
          document_name: string | null
          error_message: string | null
          external_job_id: string | null
          id: string
          is_marketing: boolean
          is_published: boolean | null
          parsed_content: Json | null
          presentation_json: Json | null
          progress: number | null
          reconcile_miss_count: number
          server_ip: string | null
          status: string | null
          steps_completed: number | null
          subject_id: string
          target_port: number | null
          total_steps: number | null
          updated_at: string | null
          video_url: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          current_phase?: string | null
          current_step?: string | null
          document_id?: string | null
          document_name?: string | null
          error_message?: string | null
          external_job_id?: string | null
          id: string
          is_marketing?: boolean
          is_published?: boolean | null
          parsed_content?: Json | null
          presentation_json?: Json | null
          progress?: number | null
          reconcile_miss_count?: number
          server_ip?: string | null
          status?: string | null
          steps_completed?: number | null
          subject_id: string
          target_port?: number | null
          total_steps?: number | null
          updated_at?: string | null
          video_url?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          current_phase?: string | null
          current_step?: string | null
          document_id?: string | null
          document_name?: string | null
          error_message?: string | null
          external_job_id?: string | null
          id?: string
          is_marketing?: boolean
          is_published?: boolean | null
          parsed_content?: Json | null
          presentation_json?: Json | null
          progress?: number | null
          reconcile_miss_count?: number
          server_ip?: string | null
          status?: string | null
          steps_completed?: number | null
          subject_id?: string
          target_port?: number | null
          total_steps?: number | null
          updated_at?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_generation_jobs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "ai_assistant_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      video_job_prefixes: {
        Row: {
          created_at: string
          full_prefix: string
          id: string
          random_code: string
          subject_name: string | null
        }
        Insert: {
          created_at?: string
          full_prefix: string
          id?: string
          random_code: string
          subject_name?: string | null
        }
        Update: {
          created_at?: string
          full_prefix?: string
          id?: string
          random_code?: string
          subject_name?: string | null
        }
        Relationships: []
      }
      video_storyboards: {
        Row: {
          audio_error_message: string | null
          audio_generation_completed_at: string | null
          audio_generation_started_at: string | null
          audio_generation_status: string | null
          audio_urls: Json | null
          chunk_plan: Json | null
          created_at: string
          id: string
          job_id: string
          llm_model: string | null
          processing_completed_at: string | null
          processing_started_at: string | null
          slides: Json
          status: string
          total_duration: number | null
          updated_at: string
        }
        Insert: {
          audio_error_message?: string | null
          audio_generation_completed_at?: string | null
          audio_generation_started_at?: string | null
          audio_generation_status?: string | null
          audio_urls?: Json | null
          chunk_plan?: Json | null
          created_at?: string
          id: string
          job_id: string
          llm_model?: string | null
          processing_completed_at?: string | null
          processing_started_at?: string | null
          slides: Json
          status?: string
          total_duration?: number | null
          updated_at?: string
        }
        Update: {
          audio_error_message?: string | null
          audio_generation_completed_at?: string | null
          audio_generation_started_at?: string | null
          audio_generation_status?: string | null
          audio_urls?: Json | null
          chunk_plan?: Json | null
          created_at?: string
          id?: string
          job_id?: string
          llm_model?: string | null
          processing_completed_at?: string | null
          processing_started_at?: string | null
          slides?: Json
          status?: string
          total_duration?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_video_storyboards_job"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      video_watch_progress: {
        Row: {
          completed: boolean | null
          id: string
          last_watched_at: string | null
          progress_percent: number | null
          progress_seconds: number | null
          recording_id: string | null
          user_id: string | null
        }
        Insert: {
          completed?: boolean | null
          id?: string
          last_watched_at?: string | null
          progress_percent?: number | null
          progress_seconds?: number | null
          recording_id?: string | null
          user_id?: string | null
        }
        Update: {
          completed?: boolean | null
          id?: string
          last_watched_at?: string | null
          progress_percent?: number | null
          progress_seconds?: number | null
          recording_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_watch_progress_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "class_recordings"
            referencedColumns: ["id"]
          },
        ]
      }
      welcome_email_logs: {
        Row: {
          created_at: string
          email: string
          error_message: string | null
          id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          error_message?: string | null
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          error_message?: string | null
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "welcome_email_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "welcome_email_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "student_analytics_cache"
            referencedColumns: ["student_id"]
          },
        ]
      }
      whatsapp_chat_logs: {
        Row: {
          ai_answer: string | null
          created_at: string
          direction: string
          id: string
          message_text: string | null
          phone_number: string
          student_id: string | null
        }
        Insert: {
          ai_answer?: string | null
          created_at?: string
          direction: string
          id?: string
          message_text?: string | null
          phone_number: string
          student_id?: string | null
        }
        Update: {
          ai_answer?: string | null
          created_at?: string
          direction?: string
          id?: string
          message_text?: string | null
          phone_number?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_chat_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_chat_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_analytics_cache"
            referencedColumns: ["student_id"]
          },
        ]
      }
    }
    Views: {
      student_analytics: {
        Row: {
          avg_score: number | null
          chapters_completed: number | null
          course_id: string | null
          last_activity: string | null
          student_id: string | null
          tests_taken: number | null
          topics_completed: number | null
          total_time_spent: number | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_analytics_cache"
            referencedColumns: ["student_id"]
          },
        ]
      }
      student_analytics_cache: {
        Row: {
          active_enrollments: number | null
          avatar_url: string | null
          avg_progress_percentage: number | null
          avg_test_score: number | null
          full_name: string | null
          last_active_at: string | null
          refresh_at: string | null
          student_id: string | null
          total_ai_interactions: number | null
          total_assignments_submitted: number | null
          total_courses: number | null
          total_tests_taken: number | null
        }
        Relationships: []
      }
      support_ticket_sla: {
        Row: {
          ai_auto_escalated: boolean | null
          ai_classification: string | null
          ai_confidence: number | null
          assigned_admin_id: string | null
          category: string | null
          closed_at: string | null
          created_at: string | null
          escalated_at: string | null
          hours_open: number | null
          id: string | null
          sla_status: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ai_auto_escalated?: boolean | null
          ai_classification?: string | null
          ai_confidence?: number | null
          assigned_admin_id?: string | null
          category?: string | null
          closed_at?: string | null
          created_at?: string | null
          escalated_at?: string | null
          hours_open?: never
          id?: string | null
          sla_status?: never
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ai_auto_escalated?: boolean | null
          ai_classification?: string | null
          ai_confidence?: number | null
          assigned_admin_id?: string | null
          category?: string | null
          closed_at?: string | null
          created_at?: string | null
          escalated_at?: string | null
          hours_open?: never
          id?: string | null
          sla_status?: never
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      audit_completed_job_integrity: {
        Args: { p_subject_names?: string[] }
        Returns: {
          chapter_number: number
          chapter_title: string
          completed_at: string
          created_at: string
          document_name: string
          english_sections_with_path: number
          external_job_id: string
          has_presentation: boolean
          integrity_status: string
          is_published: boolean
          job_id: string
          kannada_sections_with_path: number
          missing_english_sections: number[]
          missing_kannada_sections: number[]
          reason: string
          section_count: number
          server_ip: string
          subject_name: string
          topic_title: string
          video_url: string
        }[]
      }
      check_course_enrollment: {
        Args: { p_course_slug: string }
        Returns: boolean
      }
      claim_auto_submission_run: {
        Args: { _cooldown_seconds?: number; _run_id: string }
        Returns: boolean
      }
      create_ocr_result_rpc: {
        Args: {
          p_datalab_request_id?: string
          p_id: string
          p_job_id: string
          p_mathpix_pdf_id?: string
          p_mmd_content?: string
          p_mmd_url?: string
          p_provider?: string
          p_status?: string
        }
        Returns: {
          cloud_image_urls: Json | null
          created_at: string
          datalab_request_id: string | null
          id: string
          images: Json | null
          images_extracted: number | null
          job_id: string
          mathpix_pdf_id: string | null
          mmd_content: string | null
          mmd_url: string | null
          processing_completed_at: string | null
          processing_started_at: string | null
          provider: string | null
          status: string
          updated_at: string
          zip_path: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "ocr_results"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      decrement_batch_students: {
        Args: { batch_id: string }
        Returns: undefined
      }
      deduplicate_questions: { Args: never; Returns: number }
      delete_subject_cascade: {
        Args: { p_subject_id: string }
        Returns: undefined
      }
      find_similar_questions: {
        Args: {
          p_limit?: number
          p_subject_id?: string
          p_text: string
          p_topic_id?: string
        }
        Returns: {
          bucket: string
          id: string
          question_text: string
          score: number
        }[]
      }
      get_admin_analytics: { Args: { p_since: string }; Returns: Json }
      get_category_descendants: {
        Args: { parent_uuid: string }
        Returns: {
          category_id: string
        }[]
      }
      get_course_detail: { Args: { p_slug: string }; Returns: Json }
      get_enrolled_courses_with_progress: {
        Args: { p_student_id: string }
        Returns: {
          category_id: string
          category_name: string
          course_id: string
          course_name: string
          course_slug: string
          duration_months: number
          enrolled_at: string
          parent_category_icon: string
          parent_category_id: string
          parent_category_name: string
          progress: number
          short_description: string
          thumbnail_url: string
        }[]
      }
      get_kannada_coverage_scan: {
        Args: { p_subject_name: string }
        Returns: {
          chapter_number: number
          chapter_title: string
          coverage_status: string
          created_at: string
          document_name: string
          external_job_id: string
          job_id: string
          kannada_sections: number
          server_ip: string
          subject_name: string
          topic_title: string
          total_sections: number
        }[]
      }
      get_language_coverage_scan: {
        Args: { p_language: string; p_subject_name: string }
        Returns: {
          chapter_number: number
          chapter_title: string
          coverage_status: string
          created_at: string
          document_name: string
          external_job_id: string
          job_id: string
          language_sections: number
          server_ip: string
          subject_name: string
          topic_title: string
          total_sections: number
        }[]
      }
      get_learning_course_data: {
        Args: { p_course_id: string; p_student_id: string }
        Returns: {
          available_languages: Json
          course_id: string
          course_name: string
          course_slug: string
          is_enrolled: boolean
          language_topup_original_price: number
          language_topup_price: number
          subjects: Json
          thumbnail_url: string
        }[]
      }
      get_published_lecture_stats: {
        Args: { p_subject_id: string }
        Returns: {
          lecture_count: number
          topic_id: string
          total_duration_minutes: number
        }[]
      }
      get_question_bank_page: {
        Args: {
          p_category_id?: string
          p_chapter_id?: string
          p_difficulty?: string
          p_is_verified?: boolean
          p_limit?: number
          p_offset?: number
          p_question_format?: string
          p_search_query?: string
          p_source_type?: string
          p_subject_id?: string
          p_topic_id?: string
        }
        Returns: {
          chapter_id: string
          contains_formula: boolean
          correct_answer: string
          created_at: string
          difficulty: string
          explanation: string
          id: string
          is_ai_generated: boolean
          is_important: boolean
          is_verified: boolean
          marks: number
          options: Json
          question_format: string
          question_text: string
          question_type: string
          source_document_purpose: string
          topic_id: string
          total_count: number
        }[]
      }
      get_subject_chapters_with_topics: {
        Args: { p_subject_id: string }
        Returns: {
          ai_generated_video_url: string
          chapter_id: string
          chapter_number: number
          description: string
          title: string
          topics: Json
        }[]
      }
      get_topic_lecture_durations: {
        Args: { p_subject_id: string }
        Returns: {
          topic_id: string
          total_duration_minutes: number
        }[]
      }
      get_video_generation_coverage_report: {
        Args: { p_subject_names?: string[] }
        Returns: {
          chapter_id: string
          chapter_number: number
          chapter_title: string
          coverage_status: string
          latest_created_at: string
          latest_external_job_id: string
          latest_job_id: string
          latest_server_ip: string
          latest_status: string
          published_completed_jobs: number
          subject_name: string
          topic_id: string
          topic_number: string
          topic_title: string
          total_jobs: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_batch_students: {
        Args: { batch_id: string }
        Returns: undefined
      }
      is_group_admin: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      refresh_student_analytics: { Args: never; Returns: undefined }
      refresh_student_analytics_cache: { Args: never; Returns: undefined }
      scan_video_generation_coverage: {
        Args: { p_subject_names?: string[] }
        Returns: {
          chapter_id: string
          chapter_number: number
          chapter_title: string
          coverage_status: string
          latest_created_at: string
          latest_external_job_id: string
          latest_job_id: string
          latest_server_ip: string
          latest_status: string
          published_completed_jobs: number
          subject_name: string
          topic_id: string
          topic_number: string
          topic_title: string
          total_jobs: number
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      update_chapter_orders: {
        Args: { chapter_ids: string[]; new_orders: number[] }
        Returns: undefined
      }
      update_subtopic_orders: {
        Args: { new_orders: number[]; subtopic_ids: string[] }
        Returns: undefined
      }
      update_topic_orders: {
        Args: { new_orders: number[]; topic_ids: string[] }
        Returns: undefined
      }
    }
    Enums: {
      activity_type:
        | "login"
        | "course_access"
        | "test_start"
        | "test_complete"
        | "ai_query"
        | "live_class_join"
        | "assignment_submit"
      app_role: "admin" | "teacher" | "student" | "parent" | "checker"
      badge_type: "silver" | "bronze" | "gold" | "master" | "course_complete"
      followup_priority: "low" | "medium" | "high"
      followup_status: "pending" | "completed" | "dismissed"
      followup_type:
        | "test_reminder"
        | "live_class_reminder"
        | "ai_tutorial_prompt"
        | "general"
      program_type: "live" | "recorded_ai" | "recorded_video"
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
      activity_type: [
        "login",
        "course_access",
        "test_start",
        "test_complete",
        "ai_query",
        "live_class_join",
        "assignment_submit",
      ],
      app_role: ["admin", "teacher", "student", "parent", "checker"],
      badge_type: ["silver", "bronze", "gold", "master", "course_complete"],
      followup_priority: ["low", "medium", "high"],
      followup_status: ["pending", "completed", "dismissed"],
      followup_type: [
        "test_reminder",
        "live_class_reminder",
        "ai_tutorial_prompt",
        "general",
      ],
      program_type: ["live", "recorded_ai", "recorded_video"],
    },
  },
} as const
