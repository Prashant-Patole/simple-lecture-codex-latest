import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PaymentSettings {
  provider: string;
  razorpay_key_id: string;
  razorpay_key_secret: string;
  test_mode: boolean;
}

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  provider: "razorpay",
  razorpay_key_id: "",
  razorpay_key_secret: "",
  test_mode: true,
};

export const usePaymentSettings = () => {
  return useQuery({
    queryKey: ["payment-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_settings")
        .select("*")
        .eq("setting_key", "payment_gateway")
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          // No settings found, return defaults
          return DEFAULT_PAYMENT_SETTINGS;
        }
        throw error;
      }

      const settingValue = data?.setting_value as unknown as PaymentSettings;
      return settingValue || DEFAULT_PAYMENT_SETTINGS;
    },
  });
};

export const useUpdatePaymentSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: PaymentSettings) => {
      const { data: existing } = await supabase
        .from("ai_settings")
        .select("id")
        .eq("setting_key", "payment_gateway")
        .single();

      if (existing) {
        const { error } = await supabase
          .from("ai_settings")
          .update({
            setting_value: settings as any,
            updated_at: new Date().toISOString(),
          })
          .eq("setting_key", "payment_gateway");

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("ai_settings")
          .insert({
            setting_key: "payment_gateway",
            setting_value: settings as any,
            description: "Payment gateway configuration",
          });

        if (error) throw error;
      }

      return settings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-settings"] });
      toast.success("Payment settings saved successfully");
    },
    onError: (error: any) => {
      toast.error("Failed to save payment settings", {
        description: error.message,
      });
    },
  });
};
