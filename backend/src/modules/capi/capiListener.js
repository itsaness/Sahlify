import { shippingEvents } from "../shipping/shippingEvents.js";
import { sendOrderCapiEvent } from "./capiService.js";

let registered = false;

export function registerCapiListeners() {
  if (registered) return;
  registered = true;

  shippingEvents.on("shipment.delivered", ({ storeId, orderId, shipment }) => {
    const eventTime = shipment?.delivered_at
      ? Math.floor(new Date(shipment.delivered_at).getTime() / 1000)
      : Math.floor(Date.now() / 1000);

    sendOrderCapiEvent({
      storeId,
      orderId,
      eventName: "Purchase",
      eventId: `order_${orderId}_purchase`,
      eventTime,
    }).catch((err) => console.error("CAPI Purchase dispatch error:", err));
  });
}
