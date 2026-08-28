const PAYSTACK_BASE = "https://api.paystack.co";

export function paystackKey(): string | null {
  return process.env["PAYSTACK_SECRET_KEY"] ?? null;
}

async function paystackFetch(path: string, init: RequestInit) {
  const key = paystackKey();
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not configured");

  const response = await fetch(`${PAYSTACK_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const body = (await response.json().catch(() => ({}))) as {
    status?: boolean;
    message?: string;
    data?: unknown;
  };

  if (!response.ok || body.status === false) {
    throw new Error(body.message ?? `Paystack request failed (${response.status})`);
  }
  return body.data as Record<string, unknown>;
}

/** Starts a ZAR charge for the fixed R240 monthly platform fee. */
export async function initializeSubscriptionCharge(params: {
  email: string;
  amountCents: number;
  reference: string;
  callbackUrl: string;
  sellerId: string;
}) {
  const data = await paystackFetch("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: params.email,
      amount: params.amountCents,
      currency: "ZAR",
      reference: params.reference,
      callback_url: params.callbackUrl,
      metadata: { seller_id: params.sellerId, purpose: "seller_subscription" },
      channels: ["card", "eft", "mobile_money", "bank_transfer", "ussd"],
    }),
  });

  return { authorizationUrl: String(data["authorization_url"] ?? "") };
}

export async function verifyTransaction(reference: string) {
  const data = await paystackFetch(`/transaction/verify/${encodeURIComponent(reference)}`, {
    method: "GET",
  });
  return {
    status: String(data["status"] ?? ""),
    amount: Number(data["amount"] ?? 0),
    metadata: (data["metadata"] ?? {}) as Record<string, unknown>,
  };
}

/** Vendor payout sub-account, used later to route the 90% split. */
export async function createSubaccount(params: {
  businessName: string;
  settlementBank: string;
  accountNumber: string;
  commissionRate: number;
}) {
  const data = await paystackFetch("/subaccount", {
    method: "POST",
    body: JSON.stringify({
      business_name: params.businessName,
      settlement_bank: params.settlementBank,
      account_number: params.accountNumber,
      percentage_charge: params.commissionRate,
    }),
  });
  return { subaccountCode: String(data["subaccount_code"] ?? "") };
}
