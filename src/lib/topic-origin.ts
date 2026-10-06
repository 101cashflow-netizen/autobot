/**
 * Decides where autopilot's next subject comes from.
 *
 * Kept free of imports so the rule can be exercised on its own. `roll` is a
 * number in [0, 1), passed in rather than drawn here for the same reason.
 *
 * - No enabled topic of the owner's own: trending, whatever the setting — an
 *   empty list must never stop autopilot.
 * - "trending": always trending.
 * - "mixed": an even split.
 * - "mine", or unset on databases older than the setting: the owner's list.
 */
export function decideTopicOrigin(
  source: "mine" | "trending" | "mixed" | undefined,
  hasOwnTopic: boolean,
  roll: number
): "mine" | "trending" {
  if (!hasOwnTopic || source === "trending") return "trending";
  if (source === "mixed") return roll < 0.5 ? "mine" : "trending";
  return "mine";
}
