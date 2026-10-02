import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  title: z.string().min(2).max(120),
  category: z.string().max(60).optional(),
  ecoAttributes: z.array(z.string().max(40)).max(20),
  brandName: z.string().max(80).optional(),
  notes: z.string().max(2000).optional(),
});

export const generateProductDescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { text: null, error: "AI writing isn't set up yet." };

    const prompt = [
      `Product: ${data.title}`,
      data.category ? `Category: ${data.category}` : "",
      data.brandName ? `Brand: ${data.brandName}` : "",
      data.ecoAttributes.length ? `Eco qualities: ${data.ecoAttributes.join(", ")}` : "",
      data.notes ? `Seller notes: ${data.notes}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        instructions:
          "You write product descriptions for a South African eco-friendly marketplace. Write 2 short paragraphs (max 110 words total) in warm, honest, plain English. Highlight the eco qualities given. Never invent certifications, measurements or claims not provided. Return only the description text, no headings or markdown.",
        input: prompt,
      }),
    });

    if (!res.ok || !res.body) {
      const status = res.status;
      console.error("AI description failed", status, await res.text().catch(() => ""));
      if (status === 429) return { text: null, error: "Too many requests — try again in a minute." };
      if (status === 402) return { text: null, error: "AI credits have run out for this workspace." };
      return { text: null, error: "The AI writer couldn't respond. Please try again." };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const event = JSON.parse(payload);
          if (event.type === "response.output_text.delta") text += event.delta ?? "";
        } catch {
          /* ignore partial */
        }
      }
    }

    text = text.trim();
    if (!text) return { text: null, error: "The AI writer returned nothing. Add more detail and try again." };
    return { text, error: null as string | null };
  });
