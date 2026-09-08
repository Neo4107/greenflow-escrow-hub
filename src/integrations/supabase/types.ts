export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      brand_certificates: {
        Row: {
          brand_name: string;
          certification_expiry_date: string | null;
          created_at: string;
          document_path: string;
          document_type: string | null;
          id: string;
          product_id: string;
          review_notes: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          seller_id: string;
          status: Database["public"]["Enums"]["certificate_status"];
          updated_at: string;
        };
        Insert: {
          brand_name: string;
          certification_expiry_date?: string | null;
          created_at?: string;
          document_path: string;
          document_type?: string | null;
          id?: string;
          product_id: string;
          review_notes?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          seller_id: string;
          status?: Database["public"]["Enums"]["certificate_status"];
          updated_at?: string;
        };
        Update: {
          brand_name?: string;
          certification_expiry_date?: string | null;
          created_at?: string;
          document_path?: string;
          document_type?: string | null;
          id?: string;
          product_id?: string;
          review_notes?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          seller_id?: string;
          status?: Database["public"]["Enums"]["certificate_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brand_certificates_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "brand_certificates_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "sellers";
            referencedColumns: ["id"];
          },
        ];
      };
      dispute_evidence: {
        Row: {
          caption: string | null;
          created_at: string;
          file_path: string;
          file_type: string | null;
          id: string;
          return_request_id: string;
          uploaded_by: string;
          uploader_role: Database["public"]["Enums"]["app_role"];
        };
        Insert: {
          caption?: string | null;
          created_at?: string;
          file_path: string;
          file_type?: string | null;
          id?: string;
          return_request_id: string;
          uploaded_by: string;
          uploader_role: Database["public"]["Enums"]["app_role"];
        };
        Update: {
          caption?: string | null;
          created_at?: string;
          file_path?: string;
          file_type?: string | null;
          id?: string;
          return_request_id?: string;
          uploaded_by?: string;
          uploader_role?: Database["public"]["Enums"]["app_role"];
        };
        Relationships: [
          {
            foreignKeyName: "dispute_evidence_return_request_id_fkey";
            columns: ["return_request_id"];
            isOneToOne: false;
            referencedRelation: "return_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          commission_cents: number;
          created_at: string;
          id: string;
          order_id: string;
          payout_cents: number;
          product_id: string;
          quantity: number;
          seller_id: string;
          subtotal_cents: number;
          title: string;
          unit_price_cents: number;
        };
        Insert: {
          commission_cents: number;
          created_at?: string;
          id?: string;
          order_id: string;
          payout_cents: number;
          product_id: string;
          quantity: number;
          seller_id: string;
          subtotal_cents: number;
          title: string;
          unit_price_cents: number;
        };
        Update: {
          commission_cents?: number;
          created_at?: string;
          id?: string;
          order_id?: string;
          payout_cents?: number;
          product_id?: string;
          quantity?: number;
          seller_id?: string;
          subtotal_cents?: number;
          title?: string;
          unit_price_cents?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "sellers";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          buyer_email: string;
          buyer_user_id: string | null;
          commission_cents: number;
          commission_rate: number;
          created_at: string;
          currency: string;
          gateway: string;
          gateway_reference: string;
          id: string;
          paid_at: string | null;
          payout_cents: number;
          status: Database["public"]["Enums"]["order_status"];
          subtotal_cents: number;
          updated_at: string;
        };
        Insert: {
          buyer_email: string;
          buyer_user_id?: string | null;
          commission_cents: number;
          commission_rate?: number;
          created_at?: string;
          currency?: string;
          gateway?: string;
          gateway_reference: string;
          id?: string;
          paid_at?: string | null;
          payout_cents: number;
          status?: Database["public"]["Enums"]["order_status"];
          subtotal_cents: number;
          updated_at?: string;
        };
        Update: {
          buyer_email?: string;
          buyer_user_id?: string | null;
          commission_cents?: number;
          commission_rate?: number;
          created_at?: string;
          currency?: string;
          gateway?: string;
          gateway_reference?: string;
          id?: string;
          paid_at?: string | null;
          payout_cents?: number;
          status?: Database["public"]["Enums"]["order_status"];
          subtotal_cents?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      platform_fee_ledger: {
        Row: {
          amount_cents: number;
          balance_after_cents: number;
          created_at: string;
          description: string | null;
          entry_type: Database["public"]["Enums"]["fee_entry_type"];
          id: string;
          order_id: string | null;
          payout_id: string | null;
          period_start: string | null;
          seller_id: string;
          subscription_payment_id: string | null;
          updated_at: string;
        };
        Insert: {
          amount_cents: number;
          balance_after_cents?: number;
          created_at?: string;
          description?: string | null;
          entry_type: Database["public"]["Enums"]["fee_entry_type"];
          id?: string;
          order_id?: string | null;
          payout_id?: string | null;
          period_start?: string | null;
          seller_id: string;
          subscription_payment_id?: string | null;
          updated_at?: string;
        };
        Update: {
          amount_cents?: number;
          balance_after_cents?: number;
          created_at?: string;
          description?: string | null;
          entry_type?: Database["public"]["Enums"]["fee_entry_type"];
          id?: string;
          order_id?: string | null;
          payout_id?: string | null;
          period_start?: string | null;
          seller_id?: string;
          subscription_payment_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "platform_fee_ledger_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "platform_fee_ledger_payout_id_fkey";
            columns: ["payout_id"];
            isOneToOne: false;
            referencedRelation: "seller_payouts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "platform_fee_ledger_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "sellers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "platform_fee_ledger_subscription_payment_id_fkey";
            columns: ["subscription_payment_id"];
            isOneToOne: false;
            referencedRelation: "subscription_payments";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          admin_notes: string | null;
          brand_name: string | null;
          category: string | null;
          created_at: string;
          description: string | null;
          eco_attributes: string[];
          id: string;
          images: string[];
          is_branded: boolean;
          price_cents: number;
          seller_id: string;
          slug: string;
          status: Database["public"]["Enums"]["product_status"];
          stock: number;
          title: string;
          updated_at: string;
        };
        Insert: {
          admin_notes?: string | null;
          brand_name?: string | null;
          category?: string | null;
          created_at?: string;
          description?: string | null;
          eco_attributes?: string[];
          id?: string;
          images?: string[];
          is_branded?: boolean;
          price_cents: number;
          seller_id: string;
          slug: string;
          status?: Database["public"]["Enums"]["product_status"];
          stock?: number;
          title: string;
          updated_at?: string;
        };
        Update: {
          admin_notes?: string | null;
          brand_name?: string | null;
          category?: string | null;
          created_at?: string;
          description?: string | null;
          eco_attributes?: string[];
          id?: string;
          images?: string[];
          is_branded?: boolean;
          price_cents?: number;
          seller_id?: string;
          slug?: string;
          status?: Database["public"]["Enums"]["product_status"];
          stock?: number;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "sellers";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      return_requests: {
        Row: {
          admin_notes: string | null;
          buyer_user_id: string;
          created_at: string;
          description: string | null;
          id: string;
          item_damaged: boolean;
          item_used: boolean;
          order_id: string;
          order_item_id: string;
          reason: string;
          refund_amount_cents: number;
          requested_outcome: Database["public"]["Enums"]["rma_outcome"];
          resolution_summary: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          retention_offer: string | null;
          retention_offer_accepted: boolean | null;
          seller_id: string;
          status: Database["public"]["Enums"]["rma_status"];
          updated_at: string;
        };
        Insert: {
          admin_notes?: string | null;
          buyer_user_id: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          item_damaged?: boolean;
          item_used?: boolean;
          order_id: string;
          order_item_id: string;
          reason: string;
          refund_amount_cents?: number;
          requested_outcome?: Database["public"]["Enums"]["rma_outcome"];
          resolution_summary?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          retention_offer?: string | null;
          retention_offer_accepted?: boolean | null;
          seller_id: string;
          status?: Database["public"]["Enums"]["rma_status"];
          updated_at?: string;
        };
        Update: {
          admin_notes?: string | null;
          buyer_user_id?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          item_damaged?: boolean;
          item_used?: boolean;
          order_id?: string;
          order_item_id?: string;
          reason?: string;
          refund_amount_cents?: number;
          requested_outcome?: Database["public"]["Enums"]["rma_outcome"];
          resolution_summary?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          retention_offer?: string | null;
          retention_offer_accepted?: boolean | null;
          seller_id?: string;
          status?: Database["public"]["Enums"]["rma_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "return_requests_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "return_requests_order_item_id_fkey";
            columns: ["order_item_id"];
            isOneToOne: false;
            referencedRelation: "order_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "return_requests_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "sellers";
            referencedColumns: ["id"];
          },
        ];
      };
      seller_payouts: {
        Row: {
          amount_cents: number;
          commission_cents: number;
          created_at: string;
          escrow_release_at: string;
          fee_deducted_cents: number;
          gross_cents: number;
          id: string;
          notes: string | null;
          order_id: string;
          paid_at: string | null;
          released_at: string | null;
          seller_id: string;
          status: Database["public"]["Enums"]["payout_status"];
          updated_at: string;
        };
        Insert: {
          amount_cents: number;
          commission_cents: number;
          created_at?: string;
          escrow_release_at: string;
          fee_deducted_cents?: number;
          gross_cents: number;
          id?: string;
          notes?: string | null;
          order_id: string;
          paid_at?: string | null;
          released_at?: string | null;
          seller_id: string;
          status?: Database["public"]["Enums"]["payout_status"];
          updated_at?: string;
        };
        Update: {
          amount_cents?: number;
          commission_cents?: number;
          created_at?: string;
          escrow_release_at?: string;
          fee_deducted_cents?: number;
          gross_cents?: number;
          id?: string;
          notes?: string | null;
          order_id?: string;
          paid_at?: string | null;
          released_at?: string | null;
          seller_id?: string;
          status?: Database["public"]["Enums"]["payout_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "seller_payouts_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "seller_payouts_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "sellers";
            referencedColumns: ["id"];
          },
        ];
      };
      sellers: {
        Row: {
          commission_rate: number;
          contact_email: string | null;
          created_at: string;
          description: string | null;
          fee_notice_90d_sent_at: string | null;
          fees_charged_through: string | null;
          id: string;
          is_active_subscription: boolean;
          listing_started_at: string;
          logo_url: string | null;
          next_billing_date: string | null;
          outstanding_fee_cents: number;
          paystack_subaccount_code: string | null;
          province: string | null;
          slug: string;
          store_name: string;
          subscription_fee_cents: number;
          subscription_status: Database["public"]["Enums"]["subscription_status"];
          tagline: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          commission_rate?: number;
          contact_email?: string | null;
          created_at?: string;
          description?: string | null;
          fee_notice_90d_sent_at?: string | null;
          fees_charged_through?: string | null;
          id?: string;
          is_active_subscription?: boolean;
          listing_started_at?: string;
          logo_url?: string | null;
          next_billing_date?: string | null;
          outstanding_fee_cents?: number;
          paystack_subaccount_code?: string | null;
          province?: string | null;
          slug: string;
          store_name: string;
          subscription_fee_cents?: number;
          subscription_status?: Database["public"]["Enums"]["subscription_status"];
          tagline?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          commission_rate?: number;
          contact_email?: string | null;
          created_at?: string;
          description?: string | null;
          fee_notice_90d_sent_at?: string | null;
          fees_charged_through?: string | null;
          id?: string;
          is_active_subscription?: boolean;
          listing_started_at?: string;
          logo_url?: string | null;
          next_billing_date?: string | null;
          outstanding_fee_cents?: number;
          paystack_subaccount_code?: string | null;
          province?: string | null;
          slug?: string;
          store_name?: string;
          subscription_fee_cents?: number;
          subscription_status?: Database["public"]["Enums"]["subscription_status"];
          tagline?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      subscription_payments: {
        Row: {
          amount_cents: number;
          created_at: string;
          currency: string;
          gateway: string;
          gateway_reference: string | null;
          id: string;
          paid_at: string | null;
          period_end: string | null;
          period_start: string | null;
          seller_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          amount_cents?: number;
          created_at?: string;
          currency?: string;
          gateway?: string;
          gateway_reference?: string | null;
          id?: string;
          paid_at?: string | null;
          period_end?: string | null;
          period_start?: string | null;
          seller_id: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          amount_cents?: number;
          created_at?: string;
          currency?: string;
          gateway?: string;
          gateway_reference?: string | null;
          id?: string;
          paid_at?: string | null;
          period_end?: string | null;
          period_start?: string | null;
          seller_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscription_payments_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "sellers";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "seller" | "buyer";
      certificate_status: "pending" | "approved" | "rejected";
      fee_entry_type: "fee_charge" | "sales_deduction" | "out_of_pocket_payment" | "write_off";
      order_status: "pending" | "paid" | "failed" | "cancelled" | "refunded";
      payout_status: "escrow" | "releasable" | "paid" | "withheld" | "refunded" | "reversed";
      product_status: "draft" | "pending_admin_review" | "approved" | "rejected";
      rma_outcome: "refund" | "replacement" | "store_credit";
      rma_status:
        | "open"
        | "ai_retention_offered"
        | "awaiting_return"
        | "escalated"
        | "resolved_refund"
        | "resolved_replacement"
        | "resolved_credit"
        | "rejected";
      subscription_status: "trialing" | "active" | "past_due" | "cancelled";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "seller", "buyer"],
      certificate_status: ["pending", "approved", "rejected"],
      fee_entry_type: ["fee_charge", "sales_deduction", "out_of_pocket_payment", "write_off"],
      order_status: ["pending", "paid", "failed", "cancelled", "refunded"],
      payout_status: ["escrow", "releasable", "paid", "withheld", "refunded", "reversed"],
      product_status: ["draft", "pending_admin_review", "approved", "rejected"],
      rma_outcome: ["refund", "replacement", "store_credit"],
      rma_status: [
        "open",
        "ai_retention_offered",
        "awaiting_return",
        "escalated",
        "resolved_refund",
        "resolved_replacement",
        "resolved_credit",
        "rejected",
      ],
      subscription_status: ["trialing", "active", "past_due", "cancelled"],
    },
  },
} as const;
