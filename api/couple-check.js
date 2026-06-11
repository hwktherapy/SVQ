// couple-check.js
// STUBBED — activate after solo submission is live and tested.
//
// When ready to build:
// This endpoint is called by submit.js after saving to storage.
// It checks if both respondents with the same couple code have submitted,
// then sends a combined overlap/divergence email to each and a combined
// clinician report to Hannah.
//
// Overlap logic: compare top meaning, top 2 domains, top 2 sub-categories
// per domain between the two respondents. Flag matches and mismatches.
//
// Requires: a storage layer (Supabase or similar) to hold submissions
// until the second partner completes. Without storage, couple code logic
// cannot be implemented. This is the trigger for adding Supabase later.

export default async function handler(req, res) {
  return res.status(200).json({ status: 'couple-check stub — not yet active' });
}
