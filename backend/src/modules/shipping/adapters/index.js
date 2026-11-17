import yalidine from "./yalidine.js";
import ecotrack from "./ecotrack.js";
import procolis from "./procolis.js";
import maystro from "./maystro.js";
import noest from "./noest.js";
import manual from "./manual.js";

const ADAPTERS = {
  yalidine,
  ecotrack,
  procolis,
  maystro,
  noest,
  manual,
};

export function getCarrierAdapter(platform) {
  const adapter = ADAPTERS[platform];
  if (!adapter) {
    throw new Error(`Carrier platform '${platform}' adapter is not implemented yet`);
  }
  return adapter;
}
