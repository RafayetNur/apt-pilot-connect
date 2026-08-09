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
    PostgrestVersion: "14.15"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allocate_shared_charge: {
        Args: { _shared_charge_id: string }
        Returns: number
      }
      can_review_building: {
        Args: { building_uuid: string; user_uuid: string }
        Returns: boolean
      }
      can_review_tenant: {
        Args: { tenant_uuid: string; user_uuid: string }
        Returns: boolean
      }
      can_view_building: {
        Args: { building_uuid: string; user_uuid: string }
        Returns: boolean
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_building_owner: {
        Args: { building_uuid: string; user_uuid: string }
        Returns: boolean
      }
      is_month_closed: {
        Args: { _billing_month: string; _building_id: string }
        Returns: boolean
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
      month_closure_action: "closed" | "reopened"
      month_closure_status: "open" | "closed" | "reopened"
      occupancy_status: "vacant" | "occupied"
      payment_method: "bkash" | "nagad" | "bank_transfer" | "cash"
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
      month_closure_action: ["closed", "reopened"],
      month_closure_status: ["open", "closed", "reopened"],
      occupancy_status: ["vacant", "occupied"],
      payment_method: ["bkash", "nagad", "bank_transfer", "cash"],
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
    },
  },
} as const
