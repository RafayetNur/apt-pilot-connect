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
      bill_adjustments: {
        Row: {
          adjustment_type: Database["public"]["Enums"]["adjustment_type"]
          amount: number
          approval_status: Database["public"]["Enums"]["approval_status"]
          approved_at: string | null
          approved_by: string | null
          building_id: string
          category: Database["public"]["Enums"]["adjustment_category"]
          created_at: string
          created_by: string
          flat_id: string
          id: string
          original_billing_month: string
          posted_billing_month: string
          reason: string
          rent_record_id: string
          reviewer_note: string | null
          source_credit_created: boolean
          supporting_document_url: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          adjustment_type: Database["public"]["Enums"]["adjustment_type"]
          amount: number
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          building_id: string
          category: Database["public"]["Enums"]["adjustment_category"]
          created_at?: string
          created_by: string
          flat_id: string
          id?: string
          original_billing_month: string
          posted_billing_month: string
          reason: string
          rent_record_id: string
          reviewer_note?: string | null
          source_credit_created?: boolean
          supporting_document_url?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          adjustment_type?: Database["public"]["Enums"]["adjustment_type"]
          amount?: number
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          building_id?: string
          category?: Database["public"]["Enums"]["adjustment_category"]
          created_at?: string
          created_by?: string
          flat_id?: string
          id?: string
          original_billing_month?: string
          posted_billing_month?: string
          reason?: string
          rent_record_id?: string
          reviewer_note?: string | null
          source_credit_created?: boolean
          supporting_document_url?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bill_adjustments_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_adjustments_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_adjustments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_adjustments_flat_id_fkey"
            columns: ["flat_id"]
            isOneToOne: false
            referencedRelation: "flats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_adjustments_rent_record_id_fkey"
            columns: ["rent_record_id"]
            isOneToOne: false
            referencedRelation: "rent_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_adjustments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      building_documents: {
        Row: {
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          building_id: string
          category: Database["public"]["Enums"]["document_category"]
          created_at: string
          description: string | null
          file_name: string
          file_size: number
          file_type: string
          id: string
          is_active: boolean
          replaced_by_document_id: string | null
          replaces_document_id: string | null
          storage_path: string
          title: string
          updated_at: string
          uploaded_by: string
          version_number: number
          visibility: Database["public"]["Enums"]["document_visibility"]
        }
        Insert: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          building_id: string
          category?: Database["public"]["Enums"]["document_category"]
          created_at?: string
          description?: string | null
          file_name: string
          file_size: number
          file_type: string
          id?: string
          is_active?: boolean
          replaced_by_document_id?: string | null
          replaces_document_id?: string | null
          storage_path: string
          title: string
          updated_at?: string
          uploaded_by: string
          version_number?: number
          visibility?: Database["public"]["Enums"]["document_visibility"]
        }
        Update: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          building_id?: string
          category?: Database["public"]["Enums"]["document_category"]
          created_at?: string
          description?: string | null
          file_name?: string
          file_size?: number
          file_type?: string
          id?: string
          is_active?: boolean
          replaced_by_document_id?: string | null
          replaces_document_id?: string | null
          storage_path?: string
          title?: string
          updated_at?: string
          uploaded_by?: string
          version_number?: number
          visibility?: Database["public"]["Enums"]["document_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "building_documents_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "building_documents_replaced_by_document_id_fkey"
            columns: ["replaced_by_document_id"]
            isOneToOne: false
            referencedRelation: "building_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "building_documents_replaces_document_id_fkey"
            columns: ["replaces_document_id"]
            isOneToOne: false
            referencedRelation: "building_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      building_expenses: {
        Row: {
          accounting_month: string
          amount: number
          approval_status: Database["public"]["Enums"]["expense_approval_status"]
          approved_at: string | null
          approved_by: string | null
          building_id: string
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          created_by: string
          description: string
          expense_date: string
          id: string
          payment_method: Database["public"]["Enums"]["expense_payment_method"]
          receipt_document_url: string | null
          related_month: string | null
          replaced_by_expense_id: string | null
          replaces_expense_id: string | null
          reviewer_note: string | null
          source_shared_charge_id: string | null
          source_work_order_id: string | null
          transaction_reference: string | null
          updated_at: string
          vendor_name: string | null
        }
        Insert: {
          accounting_month: string
          amount: number
          approval_status?: Database["public"]["Enums"]["expense_approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          building_id: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          category: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by: string
          description: string
          expense_date: string
          id?: string
          payment_method: Database["public"]["Enums"]["expense_payment_method"]
          receipt_document_url?: string | null
          related_month?: string | null
          replaced_by_expense_id?: string | null
          replaces_expense_id?: string | null
          reviewer_note?: string | null
          source_shared_charge_id?: string | null
          source_work_order_id?: string | null
          transaction_reference?: string | null
          updated_at?: string
          vendor_name?: string | null
        }
        Update: {
          accounting_month?: string
          amount?: number
          approval_status?: Database["public"]["Enums"]["expense_approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          building_id?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string
          description?: string
          expense_date?: string
          id?: string
          payment_method?: Database["public"]["Enums"]["expense_payment_method"]
          receipt_document_url?: string | null
          related_month?: string | null
          replaced_by_expense_id?: string | null
          replaces_expense_id?: string | null
          reviewer_note?: string | null
          source_shared_charge_id?: string | null
          source_work_order_id?: string | null
          transaction_reference?: string | null
          updated_at?: string
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "building_expenses_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "building_expenses_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "building_expenses_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "building_expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "building_expenses_replaced_by_expense_id_fkey"
            columns: ["replaced_by_expense_id"]
            isOneToOne: false
            referencedRelation: "building_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "building_expenses_replaces_expense_id_fkey"
            columns: ["replaces_expense_id"]
            isOneToOne: false
            referencedRelation: "building_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "building_expenses_source_shared_charge_id_fkey"
            columns: ["source_shared_charge_id"]
            isOneToOne: false
            referencedRelation: "shared_building_charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "building_expenses_source_work_order_id_fkey"
            columns: ["source_work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      building_month_closure_events: {
        Row: {
          action: Database["public"]["Enums"]["month_closure_action"]
          billing_month: string
          building_id: string
          closure_id: string
          created_at: string
          id: string
          performed_by: string
          reason_or_note: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["month_closure_action"]
          billing_month: string
          building_id: string
          closure_id: string
          created_at?: string
          id?: string
          performed_by: string
          reason_or_note?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["month_closure_action"]
          billing_month?: string
          building_id?: string
          closure_id?: string
          created_at?: string
          id?: string
          performed_by?: string
          reason_or_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "building_month_closure_events_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "building_month_closure_events_closure_id_fkey"
            columns: ["closure_id"]
            isOneToOne: false
            referencedRelation: "building_month_closures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "building_month_closure_events_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      building_month_closures: {
        Row: {
          billing_month: string
          building_id: string
          closed_at: string | null
          closed_by: string | null
          closing_note: string | null
          created_at: string
          id: string
          reopened_at: string | null
          reopened_by: string | null
          reopening_reason: string | null
          status: Database["public"]["Enums"]["month_closure_status"]
          updated_at: string
        }
        Insert: {
          billing_month: string
          building_id: string
          closed_at?: string | null
          closed_by?: string | null
          closing_note?: string | null
          created_at?: string
          id?: string
          reopened_at?: string | null
          reopened_by?: string | null
          reopening_reason?: string | null
          status?: Database["public"]["Enums"]["month_closure_status"]
          updated_at?: string
        }
        Update: {
          billing_month?: string
          building_id?: string
          closed_at?: string | null
          closed_by?: string | null
          closing_note?: string | null
          created_at?: string
          id?: string
          reopened_at?: string | null
          reopened_by?: string | null
          reopening_reason?: string | null
          status?: Database["public"]["Enums"]["month_closure_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "building_month_closures_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "building_month_closures_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "building_month_closures_reopened_by_fkey"
            columns: ["reopened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      building_notices: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          audience_type: Database["public"]["Enums"]["notice_audience_type"]
          building_id: string
          cancellation_reason: string | null
          content: string
          created_at: string
          created_by: string
          effective_from: string | null
          expires_at: string | null
          id: string
          notice_number: string
          priority: Database["public"]["Enums"]["notice_priority"]
          published_at: string | null
          published_by: string | null
          replaced_by_notice_id: string | null
          replaces_notice_id: string | null
          requires_acknowledgement: boolean
          status: Database["public"]["Enums"]["notice_status"]
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          audience_type?: Database["public"]["Enums"]["notice_audience_type"]
          building_id: string
          cancellation_reason?: string | null
          content: string
          created_at?: string
          created_by: string
          effective_from?: string | null
          expires_at?: string | null
          id?: string
          notice_number: string
          priority?: Database["public"]["Enums"]["notice_priority"]
          published_at?: string | null
          published_by?: string | null
          replaced_by_notice_id?: string | null
          replaces_notice_id?: string | null
          requires_acknowledgement?: boolean
          status?: Database["public"]["Enums"]["notice_status"]
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          audience_type?: Database["public"]["Enums"]["notice_audience_type"]
          building_id?: string
          cancellation_reason?: string | null
          content?: string
          created_at?: string
          created_by?: string
          effective_from?: string | null
          expires_at?: string | null
          id?: string
          notice_number?: string
          priority?: Database["public"]["Enums"]["notice_priority"]
          published_at?: string | null
          published_by?: string | null
          replaced_by_notice_id?: string | null
          replaces_notice_id?: string | null
          requires_acknowledgement?: boolean
          status?: Database["public"]["Enums"]["notice_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "building_notices_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "building_notices_replaced_by_notice_id_fkey"
            columns: ["replaced_by_notice_id"]
            isOneToOne: false
            referencedRelation: "building_notices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "building_notices_replaces_notice_id_fkey"
            columns: ["replaces_notice_id"]
            isOneToOne: false
            referencedRelation: "building_notices"
            referencedColumns: ["id"]
          },
        ]
      }
      buildings: {
        Row: {
          address: string
          area: string
          assigned_manager: string
          created_at: string
          floors: number
          id: string
          name: string
          owner_id: string
          status: Database["public"]["Enums"]["building_status"]
          total_flats: number
          updated_at: string
        }
        Insert: {
          address: string
          area?: string
          assigned_manager?: string
          created_at?: string
          floors?: number
          id?: string
          name: string
          owner_id: string
          status?: Database["public"]["Enums"]["building_status"]
          total_flats?: number
          updated_at?: string
        }
        Update: {
          address?: string
          area?: string
          assigned_manager?: string
          created_at?: string
          floors?: number
          id?: string
          name?: string
          owner_id?: string
          status?: Database["public"]["Enums"]["building_status"]
          total_flats?: number
          updated_at?: string
        }
        Relationships: []
      }
      document_recipients: {
        Row: {
          created_at: string
          document_id: string
          flat_id: string | null
          id: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          document_id: string
          flat_id?: string | null
          id?: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          document_id?: string
          flat_id?: string | null
          id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_recipients_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "building_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_recipients_flat_id_fkey"
            columns: ["flat_id"]
            isOneToOne: false
            referencedRelation: "flats"
            referencedColumns: ["id"]
          },
        ]
      }
      flat_bill_charges: {
        Row: {
          amount: number
          bill_reference: string | null
          billing_month: string
          building_id: string
          charge_type: Database["public"]["Enums"]["flat_charge_type"]
          created_at: string
          description: string | null
          entered_by: string
          flat_id: string
          id: string
          provider_name: string | null
          rent_record_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          bill_reference?: string | null
          billing_month: string
          building_id: string
          charge_type: Database["public"]["Enums"]["flat_charge_type"]
          created_at?: string
          description?: string | null
          entered_by: string
          flat_id: string
          id?: string
          provider_name?: string | null
          rent_record_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          bill_reference?: string | null
          billing_month?: string
          building_id?: string
          charge_type?: Database["public"]["Enums"]["flat_charge_type"]
          created_at?: string
          description?: string | null
          entered_by?: string
          flat_id?: string
          id?: string
          provider_name?: string | null
          rent_record_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flat_bill_charges_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flat_bill_charges_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flat_bill_charges_flat_id_fkey"
            columns: ["flat_id"]
            isOneToOne: false
            referencedRelation: "flats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flat_bill_charges_rent_record_id_fkey"
            columns: ["rent_record_id"]
            isOneToOne: false
            referencedRelation: "rent_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flat_bill_charges_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      flats: {
        Row: {
          bathroom_count: number
          bedroom_count: number
          building_id: string
          created_at: string
          flat_number: string
          floor_number: number
          id: string
          monthly_rent: number
          notes: string
          occupancy_status: Database["public"]["Enums"]["occupancy_status"]
          size_sqft: number
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          bathroom_count?: number
          bedroom_count?: number
          building_id: string
          created_at?: string
          flat_number: string
          floor_number?: number
          id?: string
          monthly_rent?: number
          notes?: string
          occupancy_status?: Database["public"]["Enums"]["occupancy_status"]
          size_sqft?: number
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          bathroom_count?: number
          bedroom_count?: number
          building_id?: string
          created_at?: string
          flat_number?: string
          floor_number?: number
          id?: string
          monthly_rent?: number
          notes?: string
          occupancy_status?: Database["public"]["Enums"]["occupancy_status"]
          size_sqft?: number
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flats_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      in_app_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          notification_type: Database["public"]["Enums"]["notification_type"]
          read_at: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          notification_type?: Database["public"]["Enums"]["notification_type"]
          read_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          notification_type?: Database["public"]["Enums"]["notification_type"]
          read_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      maintenance_attachments: {
        Row: {
          attachment_type: Database["public"]["Enums"]["maintenance_attachment_type"]
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          id: string
          maintenance_request_id: string
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          attachment_type?: Database["public"]["Enums"]["maintenance_attachment_type"]
          created_at?: string
          file_name: string
          file_size: number
          file_type: string
          id?: string
          maintenance_request_id: string
          storage_path: string
          uploaded_by: string
        }
        Update: {
          attachment_type?: Database["public"]["Enums"]["maintenance_attachment_type"]
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          id?: string
          maintenance_request_id?: string
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_attachments_maintenance_request_id_fkey"
            columns: ["maintenance_request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_comments: {
        Row: {
          author_id: string
          comment_text: string
          created_at: string
          id: string
          maintenance_request_id: string
          updated_at: string | null
          visibility: Database["public"]["Enums"]["maintenance_comment_visibility"]
        }
        Insert: {
          author_id: string
          comment_text: string
          created_at?: string
          id?: string
          maintenance_request_id: string
          updated_at?: string | null
          visibility?: Database["public"]["Enums"]["maintenance_comment_visibility"]
        }
        Update: {
          author_id?: string
          comment_text?: string
          created_at?: string
          id?: string
          maintenance_request_id?: string
          updated_at?: string | null
          visibility?: Database["public"]["Enums"]["maintenance_comment_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_comments_maintenance_request_id_fkey"
            columns: ["maintenance_request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_requests: {
        Row: {
          access_instructions: string | null
          acknowledged_at: string | null
          acknowledged_by: string | null
          assigned_at: string | null
          assigned_to: string | null
          building_id: string
          cancellation_reason: string | null
          category: Database["public"]["Enums"]["maintenance_category"]
          closed_at: string | null
          closed_by: string | null
          created_at: string
          description: string
          flat_id: string | null
          id: string
          is_common_area: boolean
          preferred_visit_date: string | null
          priority: Database["public"]["Enums"]["maintenance_priority"]
          rejection_reason: string | null
          reopened_at: string | null
          reopened_by: string | null
          reopening_reason: string | null
          request_number: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["maintenance_status"]
          submitted_by: string
          tenant_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          access_instructions?: string | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          building_id: string
          cancellation_reason?: string | null
          category: Database["public"]["Enums"]["maintenance_category"]
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          description: string
          flat_id?: string | null
          id?: string
          is_common_area?: boolean
          preferred_visit_date?: string | null
          priority?: Database["public"]["Enums"]["maintenance_priority"]
          rejection_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          reopening_reason?: string | null
          request_number: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["maintenance_status"]
          submitted_by: string
          tenant_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          access_instructions?: string | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          building_id?: string
          cancellation_reason?: string | null
          category?: Database["public"]["Enums"]["maintenance_category"]
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          description?: string
          flat_id?: string | null
          id?: string
          is_common_area?: boolean
          preferred_visit_date?: string | null
          priority?: Database["public"]["Enums"]["maintenance_priority"]
          rejection_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          reopening_reason?: string | null
          request_number?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["maintenance_status"]
          submitted_by?: string
          tenant_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_requests_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_flat_id_fkey"
            columns: ["flat_id"]
            isOneToOne: false
            referencedRelation: "flats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_reopened_by_fkey"
            columns: ["reopened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_status_events: {
        Row: {
          created_at: string
          id: string
          maintenance_request_id: string
          new_status: Database["public"]["Enums"]["maintenance_status"]
          note: string | null
          performed_by: string
          previous_status:
            | Database["public"]["Enums"]["maintenance_status"]
            | null
        }
        Insert: {
          created_at?: string
          id?: string
          maintenance_request_id: string
          new_status: Database["public"]["Enums"]["maintenance_status"]
          note?: string | null
          performed_by: string
          previous_status?:
            | Database["public"]["Enums"]["maintenance_status"]
            | null
        }
        Update: {
          created_at?: string
          id?: string
          maintenance_request_id?: string
          new_status?: Database["public"]["Enums"]["maintenance_status"]
          note?: string | null
          performed_by?: string
          previous_status?:
            | Database["public"]["Enums"]["maintenance_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_status_events_maintenance_request_id_fkey"
            columns: ["maintenance_request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_status_events_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notice_acknowledgements: {
        Row: {
          acknowledged_at: string
          id: string
          notice_id: string
          tenant_id: string
        }
        Insert: {
          acknowledged_at?: string
          id?: string
          notice_id: string
          tenant_id: string
        }
        Update: {
          acknowledged_at?: string
          id?: string
          notice_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notice_acknowledgements_notice_id_fkey"
            columns: ["notice_id"]
            isOneToOne: false
            referencedRelation: "building_notices"
            referencedColumns: ["id"]
          },
        ]
      }
      notice_events: {
        Row: {
          action: Database["public"]["Enums"]["notice_action"]
          created_at: string
          id: string
          note: string | null
          notice_id: string
          performed_by: string
        }
        Insert: {
          action: Database["public"]["Enums"]["notice_action"]
          created_at?: string
          id?: string
          note?: string | null
          notice_id: string
          performed_by: string
        }
        Update: {
          action?: Database["public"]["Enums"]["notice_action"]
          created_at?: string
          id?: string
          note?: string | null
          notice_id?: string
          performed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "notice_events_notice_id_fkey"
            columns: ["notice_id"]
            isOneToOne: false
            referencedRelation: "building_notices"
            referencedColumns: ["id"]
          },
        ]
      }
      notice_recipients: {
        Row: {
          created_at: string
          flat_id: string | null
          id: string
          notice_id: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          flat_id?: string | null
          id?: string
          notice_id: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          flat_id?: string | null
          id?: string
          notice_id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notice_recipients_flat_id_fkey"
            columns: ["flat_id"]
            isOneToOne: false
            referencedRelation: "flats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notice_recipients_notice_id_fkey"
            columns: ["notice_id"]
            isOneToOne: false
            referencedRelation: "building_notices"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          email?: string
          full_name?: string
          id: string
          phone?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      rent_payments: {
        Row: {
          amount_paid: number
          applied_amount: number
          building_id: string
          created_at: string
          credit_amount: number
          flat_id: string
          id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_proof_url: string | null
          provider_name: string | null
          receipt_number: string | null
          rent_record_id: string
          reviewer_note: string | null
          submitted_at: string
          tenant_id: string
          transaction_reference: string | null
          updated_at: string
          verification_status: Database["public"]["Enums"]["verification_status"]
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount_paid: number
          applied_amount?: number
          building_id: string
          created_at?: string
          credit_amount?: number
          flat_id: string
          id?: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_proof_url?: string | null
          provider_name?: string | null
          receipt_number?: string | null
          rent_record_id: string
          reviewer_note?: string | null
          submitted_at?: string
          tenant_id: string
          transaction_reference?: string | null
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount_paid?: number
          applied_amount?: number
          building_id?: string
          created_at?: string
          credit_amount?: number
          flat_id?: string
          id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_proof_url?: string | null
          provider_name?: string | null
          receipt_number?: string | null
          rent_record_id?: string
          reviewer_note?: string | null
          submitted_at?: string
          tenant_id?: string
          transaction_reference?: string | null
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rent_payments_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_payments_flat_id_fkey"
            columns: ["flat_id"]
            isOneToOne: false
            referencedRelation: "flats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_payments_record_scope_fkey"
            columns: ["rent_record_id", "building_id", "flat_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "rent_records"
            referencedColumns: ["id", "building_id", "flat_id", "tenant_id"]
          },
          {
            foreignKeyName: "rent_payments_rent_record_id_fkey"
            columns: ["rent_record_id"]
            isOneToOne: false
            referencedRelation: "rent_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_payments_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rent_records: {
        Row: {
          adjustment_total: number
          base_rent: number
          billing_month: string
          building_id: string
          created_at: string
          created_by: string
          due_date: string
          flat_id: string
          id: string
          individual_charges_total: number
          payment_status: Database["public"]["Enums"]["payment_status"]
          remaining_due: number
          shared_charges_total: number
          tenant_id: string
          total_paid: number
          total_payable: number
          updated_at: string
        }
        Insert: {
          adjustment_total?: number
          base_rent?: number
          billing_month: string
          building_id: string
          created_at?: string
          created_by: string
          due_date: string
          flat_id: string
          id?: string
          individual_charges_total?: number
          payment_status?: Database["public"]["Enums"]["payment_status"]
          remaining_due?: number
          shared_charges_total?: number
          tenant_id: string
          total_paid?: number
          total_payable?: number
          updated_at?: string
        }
        Update: {
          adjustment_total?: number
          base_rent?: number
          billing_month?: string
          building_id?: string
          created_at?: string
          created_by?: string
          due_date?: string
          flat_id?: string
          id?: string
          individual_charges_total?: number
          payment_status?: Database["public"]["Enums"]["payment_status"]
          remaining_due?: number
          shared_charges_total?: number
          tenant_id?: string
          total_paid?: number
          total_payable?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rent_records_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_records_flat_id_fkey"
            columns: ["flat_id"]
            isOneToOne: false
            referencedRelation: "flats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_building_charges: {
        Row: {
          billing_month: string
          building_id: string
          category: Database["public"]["Enums"]["shared_charge_category"]
          created_at: string
          created_by: string
          description: string | null
          id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          billing_month: string
          building_id: string
          category: Database["public"]["Enums"]["shared_charge_category"]
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          total_amount: number
          updated_at?: string
        }
        Update: {
          billing_month?: string
          building_id?: string
          category?: Database["public"]["Enums"]["shared_charge_category"]
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_building_charges_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_building_charges_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_charge_allocations: {
        Row: {
          allocated_amount: number
          building_id: string
          created_at: string
          flat_id: string
          id: string
          rent_record_id: string
          shared_charge_id: string
          tenant_id: string
        }
        Insert: {
          allocated_amount: number
          building_id: string
          created_at?: string
          flat_id: string
          id?: string
          rent_record_id: string
          shared_charge_id: string
          tenant_id: string
        }
        Update: {
          allocated_amount?: number
          building_id?: string
          created_at?: string
          flat_id?: string
          id?: string
          rent_record_id?: string
          shared_charge_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_charge_allocations_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_charge_allocations_flat_id_fkey"
            columns: ["flat_id"]
            isOneToOne: false
            referencedRelation: "flats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_charge_allocations_rent_record_id_fkey"
            columns: ["rent_record_id"]
            isOneToOne: false
            referencedRelation: "rent_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_charge_allocations_shared_charge_id_fkey"
            columns: ["shared_charge_id"]
            isOneToOne: false
            referencedRelation: "shared_building_charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_charge_allocations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sslcommerz_transactions: {
        Row: {
          bank_tran_id: string | null
          building_id: string
          created_at: string
          currency: string
          expected_amount: number
          failure_reason: string | null
          finalized_at: string | null
          flat_id: string
          gateway_hostname: string | null
          id: string
          rent_payment_id: string | null
          rent_record_id: string
          risk_level: string | null
          sessionkey: string | null
          status: Database["public"]["Enums"]["gateway_txn_status"]
          tenant_id: string
          tran_id: string
          updated_at: string
          val_id: string | null
          validated_amount: number | null
        }
        Insert: {
          bank_tran_id?: string | null
          building_id: string
          created_at?: string
          currency?: string
          expected_amount: number
          failure_reason?: string | null
          finalized_at?: string | null
          flat_id: string
          gateway_hostname?: string | null
          id?: string
          rent_payment_id?: string | null
          rent_record_id: string
          risk_level?: string | null
          sessionkey?: string | null
          status?: Database["public"]["Enums"]["gateway_txn_status"]
          tenant_id: string
          tran_id: string
          updated_at?: string
          val_id?: string | null
          validated_amount?: number | null
        }
        Update: {
          bank_tran_id?: string | null
          building_id?: string
          created_at?: string
          currency?: string
          expected_amount?: number
          failure_reason?: string | null
          finalized_at?: string | null
          flat_id?: string
          gateway_hostname?: string | null
          id?: string
          rent_payment_id?: string | null
          rent_record_id?: string
          risk_level?: string | null
          sessionkey?: string | null
          status?: Database["public"]["Enums"]["gateway_txn_status"]
          tenant_id?: string
          tran_id?: string
          updated_at?: string
          val_id?: string | null
          validated_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sslcommerz_transactions_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sslcommerz_transactions_flat_id_fkey"
            columns: ["flat_id"]
            isOneToOne: false
            referencedRelation: "flats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sslcommerz_transactions_rent_payment_id_fkey"
            columns: ["rent_payment_id"]
            isOneToOne: false
            referencedRelation: "rent_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sslcommerz_transactions_rent_record_id_fkey"
            columns: ["rent_record_id"]
            isOneToOne: false
            referencedRelation: "rent_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sslcommerz_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_credits: {
        Row: {
          amount: number
          building_id: string
          created_at: string
          flat_id: string
          id: string
          remaining_amount: number
          source_adjustment_id: string | null
          source_payment_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          building_id: string
          created_at?: string
          flat_id: string
          id?: string
          remaining_amount?: number
          source_adjustment_id?: string | null
          source_payment_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          building_id?: string
          created_at?: string
          flat_id?: string
          id?: string
          remaining_amount?: number
          source_adjustment_id?: string | null
          source_payment_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_credits_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_credits_flat_id_fkey"
            columns: ["flat_id"]
            isOneToOne: false
            referencedRelation: "flats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_credits_source_payment_id_fkey"
            columns: ["source_payment_id"]
            isOneToOne: false
            referencedRelation: "rent_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_credits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_events: {
        Row: {
          created_at: string
          id: string
          new_status: Database["public"]["Enums"]["work_order_status"]
          note: string | null
          performed_by: string
          previous_status:
            | Database["public"]["Enums"]["work_order_status"]
            | null
          work_order_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          new_status: Database["public"]["Enums"]["work_order_status"]
          note?: string | null
          performed_by: string
          previous_status?:
            | Database["public"]["Enums"]["work_order_status"]
            | null
          work_order_id: string
        }
        Update: {
          created_at?: string
          id?: string
          new_status?: Database["public"]["Enums"]["work_order_status"]
          note?: string | null
          performed_by?: string
          previous_status?:
            | Database["public"]["Enums"]["work_order_status"]
            | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_events_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_events_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          actual_cost: number | null
          assigned_manager_id: string | null
          building_id: string
          cancellation_reason: string | null
          completed_at: string | null
          completed_by: string | null
          completion_note: string | null
          created_at: string
          created_by: string
          estimated_cost: number | null
          id: string
          maintenance_request_id: string
          scheduled_date: string | null
          scheduled_time: string | null
          status: Database["public"]["Enums"]["work_order_status"]
          technician_name: string | null
          updated_at: string
          vendor_name: string | null
          vendor_phone: string | null
          work_description: string
          work_order_number: string
        }
        Insert: {
          actual_cost?: number | null
          assigned_manager_id?: string | null
          building_id: string
          cancellation_reason?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_note?: string | null
          created_at?: string
          created_by: string
          estimated_cost?: number | null
          id?: string
          maintenance_request_id: string
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: Database["public"]["Enums"]["work_order_status"]
          technician_name?: string | null
          updated_at?: string
          vendor_name?: string | null
          vendor_phone?: string | null
          work_description: string
          work_order_number: string
        }
        Update: {
          actual_cost?: number | null
          assigned_manager_id?: string | null
          building_id?: string
          cancellation_reason?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_note?: string | null
          created_at?: string
          created_by?: string
          estimated_cost?: number | null
          id?: string
          maintenance_request_id?: string
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: Database["public"]["Enums"]["work_order_status"]
          technician_name?: string | null
          updated_at?: string
          vendor_name?: string | null
          vendor_phone?: string | null
          work_description?: string
          work_order_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_assigned_manager_id_fkey"
            columns: ["assigned_manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_maintenance_request_id_fkey"
            columns: ["maintenance_request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allocate_shared_charge: {
        Args: { _shared_charge_id: string }
        Returns: number
      }
      assign_user_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: {
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string
          role: Database["public"]["Enums"]["app_role"]
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_building_expense: {
        Args: {
          _expense_id: string
          _reason: string
          _replacement_expense_id?: string
        }
        Returns: {
          accounting_month: string
          amount: number
          approval_status: Database["public"]["Enums"]["expense_approval_status"]
          approved_at: string | null
          approved_by: string | null
          building_id: string
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          created_by: string
          description: string
          expense_date: string
          id: string
          payment_method: Database["public"]["Enums"]["expense_payment_method"]
          receipt_document_url: string | null
          related_month: string | null
          replaced_by_expense_id: string | null
          replaces_expense_id: string | null
          reviewer_note: string | null
          source_shared_charge_id: string | null
          source_work_order_id: string | null
          transaction_reference: string | null
          updated_at: string
          vendor_name: string | null
        }
        SetofOptions: {
          from: "*"
          to: "building_expenses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      close_building_month: {
        Args: { _billing_month: string; _building_id: string; _note?: string }
        Returns: {
          billing_month: string
          building_id: string
          closed_at: string | null
          closed_by: string | null
          closing_note: string | null
          created_at: string
          id: string
          reopened_at: string | null
          reopened_by: string | null
          reopening_reason: string | null
          status: Database["public"]["Enums"]["month_closure_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "building_month_closures"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_expense_draft_from_work_order: {
        Args: {
          _accounting_month: string
          _amount: number
          _category: Database["public"]["Enums"]["expense_category"]
          _description: string
          _expense_date: string
          _payment_method?: Database["public"]["Enums"]["expense_payment_method"]
          _transaction_reference?: string
          _vendor_name?: string
          _work_order_id: string
        }
        Returns: {
          accounting_month: string
          amount: number
          approval_status: Database["public"]["Enums"]["expense_approval_status"]
          approved_at: string | null
          approved_by: string | null
          building_id: string
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          created_by: string
          description: string
          expense_date: string
          id: string
          payment_method: Database["public"]["Enums"]["expense_payment_method"]
          receipt_document_url: string | null
          related_month: string | null
          replaced_by_expense_id: string | null
          replaces_expense_id: string | null
          reviewer_note: string | null
          source_shared_charge_id: string | null
          source_work_order_id: string | null
          transaction_reference: string | null
          updated_at: string
          vendor_name: string | null
        }
        SetofOptions: {
          from: "*"
          to: "building_expenses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_maintenance_request: {
        Args: {
          _access_instructions?: string
          _building_id: string
          _category: Database["public"]["Enums"]["maintenance_category"]
          _description: string
          _flat_id?: string
          _is_common_area?: boolean
          _preferred_visit_date?: string
          _priority?: Database["public"]["Enums"]["maintenance_priority"]
          _title: string
        }
        Returns: {
          access_instructions: string | null
          acknowledged_at: string | null
          acknowledged_by: string | null
          assigned_at: string | null
          assigned_to: string | null
          building_id: string
          cancellation_reason: string | null
          category: Database["public"]["Enums"]["maintenance_category"]
          closed_at: string | null
          closed_by: string | null
          created_at: string
          description: string
          flat_id: string | null
          id: string
          is_common_area: boolean
          preferred_visit_date: string | null
          priority: Database["public"]["Enums"]["maintenance_priority"]
          rejection_reason: string | null
          reopened_at: string | null
          reopened_by: string | null
          reopening_reason: string | null
          request_number: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["maintenance_status"]
          submitted_by: string
          tenant_id: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "maintenance_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      document_archive: {
        Args: { _document_id: string; _reason: string }
        Returns: {
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          building_id: string
          category: Database["public"]["Enums"]["document_category"]
          created_at: string
          description: string | null
          file_name: string
          file_size: number
          file_type: string
          id: string
          is_active: boolean
          replaced_by_document_id: string | null
          replaces_document_id: string | null
          storage_path: string
          title: string
          updated_at: string
          uploaded_by: string
          version_number: number
          visibility: Database["public"]["Enums"]["document_visibility"]
        }
        SetofOptions: {
          from: "*"
          to: "building_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      document_create: {
        Args: {
          _building_id: string
          _category: Database["public"]["Enums"]["document_category"]
          _description?: string
          _file_name: string
          _file_size: number
          _file_type: string
          _flat_ids?: string[]
          _replaces_document_id?: string
          _storage_path: string
          _tenant_ids?: string[]
          _title: string
          _visibility?: Database["public"]["Enums"]["document_visibility"]
        }
        Returns: {
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          building_id: string
          category: Database["public"]["Enums"]["document_category"]
          created_at: string
          description: string | null
          file_name: string
          file_size: number
          file_type: string
          id: string
          is_active: boolean
          replaced_by_document_id: string | null
          replaces_document_id: string | null
          storage_path: string
          title: string
          updated_at: string
          uploaded_by: string
          version_number: number
          visibility: Database["public"]["Enums"]["document_visibility"]
        }
        SetofOptions: {
          from: "*"
          to: "building_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      document_set_recipients: {
        Args: {
          _document_id: string
          _flat_ids: string[]
          _tenant_ids: string[]
        }
        Returns: undefined
      }
      finalize_sslcommerz_payment: {
        Args: {
          _bank_tran_id: string
          _currency: string
          _risky?: boolean
          _tran_id: string
          _val_id: string
          _validated_amount: number
        }
        Returns: string
      }
      is_month_closed: {
        Args: { _billing_month: string; _building_id: string }
        Returns: boolean
      }
      maintenance_assign: {
        Args: {
          _assigned_to: string
          _priority?: Database["public"]["Enums"]["maintenance_priority"]
          _request_id: string
        }
        Returns: {
          access_instructions: string | null
          acknowledged_at: string | null
          acknowledged_by: string | null
          assigned_at: string | null
          assigned_to: string | null
          building_id: string
          cancellation_reason: string | null
          category: Database["public"]["Enums"]["maintenance_category"]
          closed_at: string | null
          closed_by: string | null
          created_at: string
          description: string
          flat_id: string | null
          id: string
          is_common_area: boolean
          preferred_visit_date: string | null
          priority: Database["public"]["Enums"]["maintenance_priority"]
          rejection_reason: string | null
          reopened_at: string | null
          reopened_by: string | null
          reopening_reason: string | null
          request_number: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["maintenance_status"]
          submitted_by: string
          tenant_id: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "maintenance_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      maintenance_change_status: {
        Args: {
          _new_status: Database["public"]["Enums"]["maintenance_status"]
          _note?: string
          _request_id: string
        }
        Returns: {
          access_instructions: string | null
          acknowledged_at: string | null
          acknowledged_by: string | null
          assigned_at: string | null
          assigned_to: string | null
          building_id: string
          cancellation_reason: string | null
          category: Database["public"]["Enums"]["maintenance_category"]
          closed_at: string | null
          closed_by: string | null
          created_at: string
          description: string
          flat_id: string | null
          id: string
          is_common_area: boolean
          preferred_visit_date: string | null
          priority: Database["public"]["Enums"]["maintenance_priority"]
          rejection_reason: string | null
          reopened_at: string | null
          reopened_by: string | null
          reopening_reason: string | null
          request_number: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["maintenance_status"]
          submitted_by: string
          tenant_id: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "maintenance_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      maintenance_set_priority: {
        Args: {
          _priority: Database["public"]["Enums"]["maintenance_priority"]
          _request_id: string
        }
        Returns: {
          access_instructions: string | null
          acknowledged_at: string | null
          acknowledged_by: string | null
          assigned_at: string | null
          assigned_to: string | null
          building_id: string
          cancellation_reason: string | null
          category: Database["public"]["Enums"]["maintenance_category"]
          closed_at: string | null
          closed_by: string | null
          created_at: string
          description: string
          flat_id: string | null
          id: string
          is_common_area: boolean
          preferred_visit_date: string | null
          priority: Database["public"]["Enums"]["maintenance_priority"]
          rejection_reason: string | null
          reopened_at: string | null
          reopened_by: string | null
          reopening_reason: string | null
          request_number: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["maintenance_status"]
          submitted_by: string
          tenant_id: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "maintenance_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      maintenance_tenant_schedule: {
        Args: { _request_id: string }
        Returns: {
          completed_at: string
          scheduled_date: string
          scheduled_time: string
          status: Database["public"]["Enums"]["work_order_status"]
          technician_name: string
          work_description: string
          work_order_number: string
        }[]
      }
      maintenance_transition_allowed: {
        Args: {
          _from: Database["public"]["Enums"]["maintenance_status"]
          _to: Database["public"]["Enums"]["maintenance_status"]
        }
        Returns: boolean
      }
      notice_acknowledge: {
        Args: { _notice_id: string }
        Returns: {
          acknowledged_at: string
          id: string
          notice_id: string
          tenant_id: string
        }
        SetofOptions: {
          from: "*"
          to: "notice_acknowledgements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      notice_archive: {
        Args: { _note?: string; _notice_id: string }
        Returns: {
          archived_at: string | null
          archived_by: string | null
          audience_type: Database["public"]["Enums"]["notice_audience_type"]
          building_id: string
          cancellation_reason: string | null
          content: string
          created_at: string
          created_by: string
          effective_from: string | null
          expires_at: string | null
          id: string
          notice_number: string
          priority: Database["public"]["Enums"]["notice_priority"]
          published_at: string | null
          published_by: string | null
          replaced_by_notice_id: string | null
          replaces_notice_id: string | null
          requires_acknowledgement: boolean
          status: Database["public"]["Enums"]["notice_status"]
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "building_notices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      notice_audience_user_ids: {
        Args: { _notice_id: string }
        Returns: string[]
      }
      notice_cancel: {
        Args: { _notice_id: string; _reason: string }
        Returns: {
          archived_at: string | null
          archived_by: string | null
          audience_type: Database["public"]["Enums"]["notice_audience_type"]
          building_id: string
          cancellation_reason: string | null
          content: string
          created_at: string
          created_by: string
          effective_from: string | null
          expires_at: string | null
          id: string
          notice_number: string
          priority: Database["public"]["Enums"]["notice_priority"]
          published_at: string | null
          published_by: string | null
          replaced_by_notice_id: string | null
          replaces_notice_id: string | null
          requires_acknowledgement: boolean
          status: Database["public"]["Enums"]["notice_status"]
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "building_notices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      notice_create: {
        Args: {
          _audience_type?: Database["public"]["Enums"]["notice_audience_type"]
          _building_id: string
          _content: string
          _effective_from?: string
          _expires_at?: string
          _flat_ids?: string[]
          _priority?: Database["public"]["Enums"]["notice_priority"]
          _requires_acknowledgement?: boolean
          _tenant_ids?: string[]
          _title: string
        }
        Returns: {
          archived_at: string | null
          archived_by: string | null
          audience_type: Database["public"]["Enums"]["notice_audience_type"]
          building_id: string
          cancellation_reason: string | null
          content: string
          created_at: string
          created_by: string
          effective_from: string | null
          expires_at: string | null
          id: string
          notice_number: string
          priority: Database["public"]["Enums"]["notice_priority"]
          published_at: string | null
          published_by: string | null
          replaced_by_notice_id: string | null
          replaces_notice_id: string | null
          requires_acknowledgement: boolean
          status: Database["public"]["Enums"]["notice_status"]
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "building_notices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      notice_publish: {
        Args: { _confirmed?: boolean; _notice_id: string }
        Returns: {
          archived_at: string | null
          archived_by: string | null
          audience_type: Database["public"]["Enums"]["notice_audience_type"]
          building_id: string
          cancellation_reason: string | null
          content: string
          created_at: string
          created_by: string
          effective_from: string | null
          expires_at: string | null
          id: string
          notice_number: string
          priority: Database["public"]["Enums"]["notice_priority"]
          published_at: string | null
          published_by: string | null
          replaced_by_notice_id: string | null
          replaces_notice_id: string | null
          requires_acknowledgement: boolean
          status: Database["public"]["Enums"]["notice_status"]
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "building_notices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      notice_publish_revision: {
        Args: {
          _audience_type: Database["public"]["Enums"]["notice_audience_type"]
          _confirmed?: boolean
          _content: string
          _effective_from?: string
          _expires_at?: string
          _flat_ids?: string[]
          _notice_id: string
          _priority: Database["public"]["Enums"]["notice_priority"]
          _reason: string
          _requires_acknowledgement: boolean
          _tenant_ids?: string[]
          _title: string
        }
        Returns: {
          archived_at: string | null
          archived_by: string | null
          audience_type: Database["public"]["Enums"]["notice_audience_type"]
          building_id: string
          cancellation_reason: string | null
          content: string
          created_at: string
          created_by: string
          effective_from: string | null
          expires_at: string | null
          id: string
          notice_number: string
          priority: Database["public"]["Enums"]["notice_priority"]
          published_at: string | null
          published_by: string | null
          replaced_by_notice_id: string | null
          replaces_notice_id: string | null
          requires_acknowledgement: boolean
          status: Database["public"]["Enums"]["notice_status"]
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "building_notices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      notice_set_recipients: {
        Args: { _flat_ids: string[]; _notice_id: string; _tenant_ids: string[] }
        Returns: undefined
      }
      notice_update_draft: {
        Args: {
          _audience_type: Database["public"]["Enums"]["notice_audience_type"]
          _content: string
          _effective_from?: string
          _expires_at?: string
          _flat_ids?: string[]
          _notice_id: string
          _priority: Database["public"]["Enums"]["notice_priority"]
          _requires_acknowledgement: boolean
          _tenant_ids?: string[]
          _title: string
        }
        Returns: {
          archived_at: string | null
          archived_by: string | null
          audience_type: Database["public"]["Enums"]["notice_audience_type"]
          building_id: string
          cancellation_reason: string | null
          content: string
          created_at: string
          created_by: string
          effective_from: string | null
          expires_at: string | null
          id: string
          notice_number: string
          priority: Database["public"]["Enums"]["notice_priority"]
          published_at: string | null
          published_by: string | null
          replaced_by_notice_id: string | null
          replaces_notice_id: string | null
          requires_acknowledgement: boolean
          status: Database["public"]["Enums"]["notice_status"]
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "building_notices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      notifications_mark_read: { Args: { _ids?: string[] }; Returns: number }
      notify_users: {
        Args: {
          _entity_id: string
          _entity_type: string
          _message: string
          _title: string
          _type: Database["public"]["Enums"]["notification_type"]
          _user_ids: string[]
        }
        Returns: undefined
      }
      recalc_rent_record_totals: {
        Args: { _rent_record_id: string }
        Returns: undefined
      }
      reopen_building_month: {
        Args: { _billing_month: string; _building_id: string; _reason: string }
        Returns: {
          billing_month: string
          building_id: string
          closed_at: string | null
          closed_by: string | null
          closing_note: string | null
          created_at: string
          id: string
          reopened_at: string | null
          reopened_by: string | null
          reopening_reason: string | null
          status: Database["public"]["Enums"]["month_closure_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "building_month_closures"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      report_accessible_buildings: {
        Args: never
        Returns: {
          id: string
          is_owner: boolean
          name: string
        }[]
      }
      report_cash_flow: {
        Args: { _building_id: string; _from: string; _to: string }
        Returns: Json
      }
      report_collection: {
        Args: { _building_id?: string; _from_month: string; _to_month: string }
        Returns: {
          billing_month: string
          building_id: string
          building_name: string
          collected: number
          collection_rate: number
          fully_paid: number
          outstanding: number
          overdue: number
          partially_paid: number
          total_billed: number
          unpaid: number
        }[]
      }
      report_expenses: {
        Args: { _building_id?: string; _from_month: string; _to_month: string }
        Returns: Json
      }
      report_guard: { Args: { _building_id: string }; Returns: undefined }
      report_monthly_statement: {
        Args: { _billing_month: string; _building_id: string }
        Returns: Json
      }
      report_outstanding: {
        Args: {
          _building_id: string
          _flat_id?: string
          _from_month: string
          _include_settled?: boolean
          _status?: string
          _tenant_id?: string
          _to_month: string
        }
        Returns: {
          billing_month: string
          days_overdue: number
          due_date: string
          flat_number: string
          last_verified_payment: string
          payment_status: string
          remaining_due: number
          rent_record_id: string
          tenant_name: string
          total_billed: number
          total_paid: number
        }[]
      }
      report_owner_summary: {
        Args: { _from_month: string; _to_month: string }
        Returns: Json
      }
      report_reconciliation: {
        Args: { _billing_month: string; _building_id: string }
        Returns: Json
      }
      report_tenant_ledger: {
        Args: { _flat_id?: string; _tenant_id: string }
        Returns: Json
      }
      review_bill_adjustment: {
        Args: { _action: string; _adjustment_id: string; _note?: string }
        Returns: {
          adjustment_type: Database["public"]["Enums"]["adjustment_type"]
          amount: number
          approval_status: Database["public"]["Enums"]["approval_status"]
          approved_at: string | null
          approved_by: string | null
          building_id: string
          category: Database["public"]["Enums"]["adjustment_category"]
          created_at: string
          created_by: string
          flat_id: string
          id: string
          original_billing_month: string
          posted_billing_month: string
          reason: string
          rent_record_id: string
          reviewer_note: string | null
          source_credit_created: boolean
          supporting_document_url: string | null
          tenant_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bill_adjustments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_building_expense: {
        Args: { _action: string; _expense_id: string; _note?: string }
        Returns: {
          accounting_month: string
          amount: number
          approval_status: Database["public"]["Enums"]["expense_approval_status"]
          approved_at: string | null
          approved_by: string | null
          building_id: string
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          created_by: string
          description: string
          expense_date: string
          id: string
          payment_method: Database["public"]["Enums"]["expense_payment_method"]
          receipt_document_url: string | null
          related_month: string | null
          replaced_by_expense_id: string | null
          replaces_expense_id: string | null
          reviewer_note: string | null
          source_shared_charge_id: string | null
          source_work_order_id: string | null
          transaction_reference: string | null
          updated_at: string
          vendor_name: string | null
        }
        SetofOptions: {
          from: "*"
          to: "building_expenses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_rent_payment: {
        Args: { _action: string; _note?: string; _payment_id: string }
        Returns: {
          amount_paid: number
          applied_amount: number
          building_id: string
          created_at: string
          credit_amount: number
          flat_id: string
          id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_proof_url: string | null
          provider_name: string | null
          receipt_number: string | null
          rent_record_id: string
          reviewer_note: string | null
          submitted_at: string
          tenant_id: string
          transaction_reference: string | null
          updated_at: string
          verification_status: Database["public"]["Enums"]["verification_status"]
          verified_at: string | null
          verified_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "rent_payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      withdraw_rent_payment: {
        Args: { _payment_id: string; _reason?: string }
        Returns: {
          amount_paid: number
          applied_amount: number
          building_id: string
          created_at: string
          credit_amount: number
          flat_id: string
          id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_proof_url: string | null
          provider_name: string | null
          receipt_number: string | null
          rent_record_id: string
          reviewer_note: string | null
          submitted_at: string
          tenant_id: string
          transaction_reference: string | null
          updated_at: string
          verification_status: Database["public"]["Enums"]["verification_status"]
          verified_at: string | null
          verified_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "rent_payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      work_order_create: {
        Args: {
          _assigned_manager_id?: string
          _estimated_cost?: number
          _maintenance_request_id: string
          _scheduled_date?: string
          _scheduled_time?: string
          _technician_name?: string
          _vendor_name?: string
          _vendor_phone?: string
          _work_description: string
        }
        Returns: {
          actual_cost: number | null
          assigned_manager_id: string | null
          building_id: string
          cancellation_reason: string | null
          completed_at: string | null
          completed_by: string | null
          completion_note: string | null
          created_at: string
          created_by: string
          estimated_cost: number | null
          id: string
          maintenance_request_id: string
          scheduled_date: string | null
          scheduled_time: string | null
          status: Database["public"]["Enums"]["work_order_status"]
          technician_name: string | null
          updated_at: string
          vendor_name: string | null
          vendor_phone: string | null
          work_description: string
          work_order_number: string
        }
        SetofOptions: {
          from: "*"
          to: "work_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      work_order_update_details: {
        Args: {
          _assigned_manager_id?: string
          _estimated_cost?: number
          _scheduled_date?: string
          _scheduled_time?: string
          _technician_name?: string
          _vendor_name?: string
          _vendor_phone?: string
          _work_description?: string
          _work_order_id: string
        }
        Returns: {
          actual_cost: number | null
          assigned_manager_id: string | null
          building_id: string
          cancellation_reason: string | null
          completed_at: string | null
          completed_by: string | null
          completion_note: string | null
          created_at: string
          created_by: string
          estimated_cost: number | null
          id: string
          maintenance_request_id: string
          scheduled_date: string | null
          scheduled_time: string | null
          status: Database["public"]["Enums"]["work_order_status"]
          technician_name: string | null
          updated_at: string
          vendor_name: string | null
          vendor_phone: string | null
          work_description: string
          work_order_number: string
        }
        SetofOptions: {
          from: "*"
          to: "work_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      work_order_update_status: {
        Args: {
          _actual_cost?: number
          _new_status: Database["public"]["Enums"]["work_order_status"]
          _note?: string
          _work_order_id: string
        }
        Returns: {
          actual_cost: number | null
          assigned_manager_id: string | null
          building_id: string
          cancellation_reason: string | null
          completed_at: string | null
          completed_by: string | null
          completion_note: string | null
          created_at: string
          created_by: string
          estimated_cost: number | null
          id: string
          maintenance_request_id: string
          scheduled_date: string | null
          scheduled_time: string | null
          status: Database["public"]["Enums"]["work_order_status"]
          technician_name: string | null
          updated_at: string
          vendor_name: string | null
          vendor_phone: string | null
          work_description: string
          work_order_number: string
        }
        SetofOptions: {
          from: "*"
          to: "work_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      adjustment_category:
        | "electricity"
        | "gas"
        | "water"
        | "internet"
        | "shared_charge"
        | "flat_repair"
        | "correction"
        | "other"
      adjustment_type: "debit" | "credit"
      app_role: "owner" | "manager" | "tenant"
      approval_status: "pending" | "approved" | "rejected"
      building_status: "active" | "inactive"
      document_category:
        | "building_rule"
        | "tenant_guideline"
        | "emergency_contact"
        | "rent_policy"
        | "maintenance_policy"
        | "meeting_minutes"
        | "utility_document"
        | "legal_document"
        | "receipt_or_invoice"
        | "other"
      document_visibility:
        | "owner_only"
        | "owner_manager"
        | "all_building_tenants"
        | "selected_flats"
        | "selected_tenants"
      expense_approval_status: "pending" | "approved" | "rejected" | "cancelled"
      expense_category:
        | "electricity_common"
        | "generator_fuel"
        | "water"
        | "gas"
        | "internet"
        | "security_guard"
        | "cleaner"
        | "caretaker"
        | "maintenance"
        | "repair"
        | "lift"
        | "supplies"
        | "tax"
        | "insurance"
        | "management"
        | "other"
      expense_payment_method:
        | "cash"
        | "bkash"
        | "nagad"
        | "bank_transfer"
        | "cheque"
        | "other"
      flat_charge_type:
        | "electricity"
        | "gas"
        | "water"
        | "internet"
        | "flat_repair"
        | "other"
      gateway_txn_status:
        | "pending"
        | "paid"
        | "failed"
        | "cancelled"
        | "review_required"
      maintenance_attachment_type:
        | "issue_photo"
        | "issue_video"
        | "document"
        | "completion_proof"
      maintenance_category:
        | "plumbing"
        | "electrical"
        | "gas"
        | "water"
        | "appliance"
        | "structural"
        | "lift"
        | "security"
        | "cleanliness"
        | "common_area"
        | "internet"
        | "pest_control"
        | "other"
      maintenance_comment_visibility: "shared" | "internal"
      maintenance_priority: "low" | "medium" | "high" | "emergency"
      maintenance_status:
        | "submitted"
        | "acknowledged"
        | "assigned"
        | "in_progress"
        | "waiting_for_parts"
        | "resolved"
        | "closed"
        | "rejected"
        | "cancelled"
        | "reopened"
      month_closure_action: "closed" | "reopened"
      month_closure_status: "open" | "closed" | "reopened"
      notice_action:
        | "created"
        | "edited"
        | "published"
        | "acknowledged"
        | "archived"
        | "cancelled"
      notice_audience_type:
        | "all_tenants"
        | "selected_flats"
        | "selected_tenants"
        | "owner_manager_only"
      notice_priority: "normal" | "important" | "urgent" | "emergency"
      notice_status: "draft" | "published" | "archived" | "cancelled"
      notification_type:
        | "notice_published"
        | "notice_updated"
        | "document_shared"
        | "maintenance_update"
        | "payment_update"
        | "general"
      occupancy_status: "vacant" | "occupied"
      payment_method:
        | "bkash"
        | "nagad"
        | "bank_transfer"
        | "cash"
        | "sslcommerz"
      payment_status: "unpaid" | "paid" | "overdue" | "partially_paid"
      shared_charge_category:
        | "guard_salary"
        | "cleaner_salary"
        | "generator"
        | "lift_maintenance"
        | "common_electricity"
        | "water_pump"
        | "waste_management"
        | "cctv_internet"
        | "other"
      verification_status:
        | "pending"
        | "verified"
        | "rejected"
        | "correction_requested"
        | "withdrawn"
        | "cancelled"
      work_order_status:
        | "draft"
        | "assigned"
        | "in_progress"
        | "completed"
        | "cancelled"
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
    Enums: {
      adjustment_category: [
        "electricity",
        "gas",
        "water",
        "internet",
        "shared_charge",
        "flat_repair",
        "correction",
        "other",
      ],
      adjustment_type: ["debit", "credit"],
      app_role: ["owner", "manager", "tenant"],
      approval_status: ["pending", "approved", "rejected"],
      building_status: ["active", "inactive"],
      document_category: [
        "building_rule",
        "tenant_guideline",
        "emergency_contact",
        "rent_policy",
        "maintenance_policy",
        "meeting_minutes",
        "utility_document",
        "legal_document",
        "receipt_or_invoice",
        "other",
      ],
      document_visibility: [
        "owner_only",
        "owner_manager",
        "all_building_tenants",
        "selected_flats",
        "selected_tenants",
      ],
      expense_approval_status: ["pending", "approved", "rejected", "cancelled"],
      expense_category: [
        "electricity_common",
        "generator_fuel",
        "water",
        "gas",
        "internet",
        "security_guard",
        "cleaner",
        "caretaker",
        "maintenance",
        "repair",
        "lift",
        "supplies",
        "tax",
        "insurance",
        "management",
        "other",
      ],
      expense_payment_method: [
        "cash",
        "bkash",
        "nagad",
        "bank_transfer",
        "cheque",
        "other",
      ],
      flat_charge_type: [
        "electricity",
        "gas",
        "water",
        "internet",
        "flat_repair",
        "other",
      ],
      gateway_txn_status: [
        "pending",
        "paid",
        "failed",
        "cancelled",
        "review_required",
      ],
      maintenance_attachment_type: [
        "issue_photo",
        "issue_video",
        "document",
        "completion_proof",
      ],
      maintenance_category: [
        "plumbing",
        "electrical",
        "gas",
        "water",
        "appliance",
        "structural",
        "lift",
        "security",
        "cleanliness",
        "common_area",
        "internet",
        "pest_control",
        "other",
      ],
      maintenance_comment_visibility: ["shared", "internal"],
      maintenance_priority: ["low", "medium", "high", "emergency"],
      maintenance_status: [
        "submitted",
        "acknowledged",
        "assigned",
        "in_progress",
        "waiting_for_parts",
        "resolved",
        "closed",
        "rejected",
        "cancelled",
        "reopened",
      ],
      month_closure_action: ["closed", "reopened"],
      month_closure_status: ["open", "closed", "reopened"],
      notice_action: [
        "created",
        "edited",
        "published",
        "acknowledged",
        "archived",
        "cancelled",
      ],
      notice_audience_type: [
        "all_tenants",
        "selected_flats",
        "selected_tenants",
        "owner_manager_only",
      ],
      notice_priority: ["normal", "important", "urgent", "emergency"],
      notice_status: ["draft", "published", "archived", "cancelled"],
      notification_type: [
        "notice_published",
        "notice_updated",
        "document_shared",
        "maintenance_update",
        "payment_update",
        "general",
      ],
      occupancy_status: ["vacant", "occupied"],
      payment_method: ["bkash", "nagad", "bank_transfer", "cash", "sslcommerz"],
      payment_status: ["unpaid", "paid", "overdue", "partially_paid"],
      shared_charge_category: [
        "guard_salary",
        "cleaner_salary",
        "generator",
        "lift_maintenance",
        "common_electricity",
        "water_pump",
        "waste_management",
        "cctv_internet",
        "other",
      ],
      verification_status: [
        "pending",
        "verified",
        "rejected",
        "correction_requested",
        "withdrawn",
        "cancelled",
      ],
      work_order_status: [
        "draft",
        "assigned",
        "in_progress",
        "completed",
        "cancelled",
      ],
    },
  },
} as const
