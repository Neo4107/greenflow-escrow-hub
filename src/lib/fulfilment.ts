export const FULFILMENT_LABELS: Record<string, string> = {
  awaiting_packing: "Awaiting packing",
  packed: "Packed",
  dispatched: "Dispatched with The Courier Guy",
  delivered: "Delivered",
};
export const courierTrackingUrl = (waybill: string) =>
  `https://portal.thecourierguy.co.za/track?ref=${encodeURIComponent(waybill)}`;
