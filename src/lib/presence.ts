import { config } from "./config";

export function isPresent(at: number | null, within = config.liveWithinMs) {
  return at != null && Date.now() - at < within;
}
