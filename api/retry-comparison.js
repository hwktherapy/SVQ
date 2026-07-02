import {
  getExistingSubmissions,
  computeComparison,
  getNarration,
  sendComparisonEmails,
  sendFailureAlert,
  markComparisonSent,
} from "./submit.js";

// Simple plain-text HTML response — this is a link clicked from an email,
// viewed by Hannah in a browser, not an API consumed by the front-end.
function page(title, message) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/><title>${title}</title></head>
<body style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;padding:48px;background:#f4f4f4;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:10px;padding:32px;border:1px solid #eee;">
    <h2 style="color:#1a2744;margin:0 0 12px;">${title}</h2>
    <p style="color:#555;font-size:15px;line-height:1.6;margin:0;">${message}</p>
  </div>
</body></html>`;
}

// No security token on this endpoint — locked decision (Doc 1 item 38): it
// can only ever act on a specific couple code's already-on-file data and
// resend to the same two addresses already on that record, which was judged
// sufficient for a low-volume solo-practice tool.
export default async function handler(req, res) {
  const coupleCode = (req.query.code || "").trim();

  if (!coupleCode) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(400).send(page("Missing couple code", "No couple code was provided in the retry link."));
  }

  try {
    const records = await getExistingSubmissions(coupleCode);

    if (records.length < 2) {
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(page(
        "Nothing to retry",
        `Couple code <strong>${coupleCode}</strong> doesn't have two completed submissions on file. Nothing to send.`
      ));
    }

    const [partnerA, partnerB] = records;

    if (partnerA.comparisonSent || partnerB.comparisonSent) {
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(page(
        "Already sent",
        `The comparison email for couple code <strong>${coupleCode}</strong> already went out successfully. Nothing to retry.`
      ));
    }

    const comparison = computeComparison(partnerA, partnerB);

    let narration = null;
    if (comparison.hasAnyOverlap) {
      const result = await getNarration(comparison);
      narration = result.narration;
      if (!narration) {
        await sendFailureAlert(coupleCode, partnerA, partnerB, `Retry attempt — narration failed again: ${result.error}`);
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(page(
          "Failed again",
          `Narration failed again for couple code <strong>${coupleCode}</strong>. Another failure alert has been sent with the error details.`
        ));
      }
    }

    await sendComparisonEmails(partnerA, partnerB, comparison, narration);
    await markComparisonSent(coupleCode, partnerA.email);
    await markComparisonSent(coupleCode, partnerB.email);

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(page(
      "Sent",
      `The comparison email for couple code <strong>${coupleCode}</strong> was sent successfully to both partners.`
    ));

  } catch (err) {
    console.error(`Retry failed for couple code ${coupleCode}:`, err);
    res.setHeader('Content-Type', 'text/html');
    return res.status(500).send(page(
      "Retry failed",
      `Something went wrong retrying couple code <strong>${coupleCode}</strong>: ${err.message}. Check Vercel logs for details.`
    ));
  }
}
