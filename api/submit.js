import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

const ses = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const ddbClient = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const ddb = DynamoDBDocumentClient.from(ddbClient);

const COUPLE_TABLE = "svq-couple-submissions";
const CLINICIAN_EMAIL = process.env.CLINICIAN_EMAIL;
const FROM_EMAIL = process.env.FROM_EMAIL;

// ── GAP TAG TEXT ──────────────────────────────────────────────────────────────
function gapText(gapScore) {
  return gapScore >= 2
    ? "This value matters to you and may not be getting the space it needs right now."
    : "This value is active in your life right now.";
}

// ── CLIENT EMAIL HTML ─────────────────────────────────────────────────────────
function buildClientEmail(payload) {
  const { respondent, rankedMeanings, rankedDomains, topSubcats } = payload;
  const name = respondent.name || "there";
  const top = rankedMeanings[0];
  const top2dom = rankedDomains;

  const meaningRows = rankedMeanings.map((m, i) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#888;font-size:13px;width:24px;">${i + 1}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">
        <div style="font-weight:600;color:#1a2744;font-size:15px;">Sex as ${m.meaning}</div>
        <div style="font-size:13px;color:#555;margin-top:2px;">${m.impScore}% agreement</div>
        <div style="font-size:13px;color:#777;margin-top:4px;line-height:1.5;">${m.shortDescription || ''}</div>
      </td>
    </tr>`).join('');

  const domainSections = top2dom.map((d, i) => {
    const subcats = topSubcats[d.domain] || [];
    const subcatHTML = subcats.map(sc => `
      <div style="margin-bottom:16px;">
        <div style="font-weight:600;color:#1a2744;font-size:15px;margin-bottom:4px;">${sc.subcat}</div>
        <div style="font-size:14px;color:#444;margin-bottom:6px;">${sc.description || ''}</div>
        <div style="display:inline-block;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:500;
          background:${sc.gapScore >= 2 ? '#fff3e0' : '#e8f5e9'};
          color:${sc.gapScore >= 2 ? '#b8882a' : '#2e7d32'};">
          ${gapText(sc.gapScore)}
        </div>
      </div>`).join('');

    return `
      <div style="background:#f9f9f9;border-radius:8px;padding:20px;margin-bottom:16px;">
        <div style="font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Domain ${i + 1}</div>
        <div style="font-size:20px;font-weight:700;color:#1a2744;font-family:Georgia,serif;margin-bottom:8px;">${d.domain}</div>
        ${d.description ? `<div style="font-size:14px;color:#555;line-height:1.6;margin-bottom:14px;">${d.description}</div>` : ''}
        ${subcatHTML}
      </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Your Sexual Values Quiz Results</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">

        <!-- Header -->
        <tr><td style="background:#1a2744;padding:32px 36px;">
          <div style="font-size:11px;font-weight:600;color:#d4aa70;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">Sexual Values Quiz</div>
          <div style="font-size:26px;font-weight:700;color:#ffffff;font-family:Georgia,serif;">Your Results</div>
          ${respondent.name ? `<div style="font-size:14px;color:#aab4cc;margin-top:6px;">${respondent.name}</div>` : ''}
        </td></tr>

        <!-- Orientation -->
        <tr><td style="padding:28px 36px 0;">
          <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 8px;">
            Your results are organized in three layers: your top sexual value, your top two domains, and the specific sub-categories within each domain where your values are sharpest.
          </p>
          <p style="font-size:14px;color:#555;line-height:1.6;margin:0;">
            These results are a starting point. Bring them into your next session with your therapist.
          </p>
        </td></tr>

        <!-- Top Meaning -->
        <tr><td style="padding:28px 36px 0;">
          <div style="font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px;">Your top sexual value</div>
          <div style="background:#1a2744;border-radius:10px;padding:24px;">
            <div style="font-size:11px;color:#d4aa70;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Top meaning</div>
            <div style="font-size:22px;font-weight:700;color:#ffffff;font-family:Georgia,serif;margin-bottom:4px;">Sex as ${top.meaning}</div>
            <div style="font-size:28px;font-weight:700;color:#d4aa70;margin-bottom:12px;">${top.impScore}%</div>
            <div style="font-size:14px;color:#ccd2df;line-height:1.65;">${top.fullDescription || ''}</div>
          </div>
        </td></tr>

        <!-- All Meanings Ranked -->
        <tr><td style="padding:24px 36px 0;">
          <div style="font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px;">All your meanings, ranked</div>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden;">
            ${meaningRows}
          </table>
        </td></tr>

        <!-- Top Domains -->
        <tr><td style="padding:24px 36px 0;">
          <div style="font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px;">Your top domains</div>
          ${domainSections}
        </td></tr>

        <!-- Booking CTA -->
        <tr><td style="padding:24px 36px 0;">
          <div style="text-align:center;padding:24px;background:#f9f9f9;border-radius:10px;">
            <p style="font-size:15px;color:#1a2744;font-weight:600;margin:0 0 16px;">Ready to talk through your results?</p>
            <a href="https://hannah-wood-kraft.clientsecure.me/" style="display:inline-block;padding:14px 28px;background:#d4aa70;color:#ffffff;font-weight:600;font-size:15px;text-decoration:none;border-radius:6px;">Book a session to talk</a>
          </div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:24px 36px 32px;border-top:1px solid #eee;margin-top:24px;">
          <p style="font-size:12px;color:#999;line-height:1.6;margin:0;">
            This assessment was completed as part of your work with your therapist. Results are confidential and have also been shared with your clinician.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── CLINICIAN EMAIL HTML ──────────────────────────────────────────────────────
function buildClinicianEmail(payload) {
  const { respondent, rankedMeanings, rankedDomains, topSubcats, scScores, clinicianFlags, securityAroundAttraction, submittedAt, subcatDescs, domainDescs } = payload;

  const gapColor = (g) => g >= 2 ? '#c0392b' : '#27ae60';
  const gapLabel = (g) => g >= 2 ? 'Gap' : 'Met';

  // All meanings
  const meaningRows = rankedMeanings.map((m, i) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#888;font-size:13px;width:24px;">${i + 1}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">
        <div style="font-weight:600;color:#1a2744;font-size:15px;">Sex as ${m.meaning}</div>
        <div style="font-size:13px;color:#555;margin-top:2px;">${m.shortDescription || ''}</div>
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;text-align:right;font-weight:600;color:#1a2744;">${m.impScore}%</td>
    </tr>`).join('');

  // Domains + subcats (ALL subcats per domain, not just top)
  const domainSections = rankedDomains.map((d, i) => {
    const allSubcats = Object.entries(scScores || {})
      .filter(([, s]) => s.domain === d.domain)
      .sort(([, a], [, b]) => b.rankingScore - a.rankingScore);

    const subcatRows = allSubcats.map(([sc, s]) => `
      <tr>
        <td style="padding:7px 12px;border-bottom:1px solid #f0f0f0;">
          <div style="font-size:14px;font-weight:600;color:#333;">${sc}</div>
          ${subcatDescs && subcatDescs[sc] ? `<div style="font-size:12px;color:#777;line-height:1.5;margin-top:2px;">${subcatDescs[sc]}</div>` : ''}
        </td>
        <td style="padding:7px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;text-align:right;font-weight:600;color:#1a2744;vertical-align:top;">${Math.round((s.impScore / 5) * 100)}%</td>
        <td style="padding:7px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;text-align:right;font-weight:700;color:${gapColor(s.gapScore)};vertical-align:top;">${gapLabel(s.gapScore)} (${s.gapScore > 0 ? '+' : ''}${s.gapScore.toFixed(2)})</td>
      </tr>`).join('');

    return `
      <div style="background:#f9f9f9;border-radius:8px;padding:20px;margin-bottom:16px;">
        <div style="font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Domain ${i + 1}</div>
        <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:6px;">
          <div style="font-size:18px;font-weight:700;color:#1a2744;font-family:Georgia,serif;">${d.domain}</div>
          <div style="font-size:16px;font-weight:700;color:#d4aa70;">${Math.round((d.score / 5) * 100)}%</div>
        </div>
        ${domainDescs && domainDescs[d.domain] ? `<div style="font-size:13px;color:#555;line-height:1.55;margin-bottom:12px;">${domainDescs[d.domain]}</div>` : ''}
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e8e8;border-radius:6px;overflow:hidden;background:#fff;">
          <tr style="background:#f0f0f0;">
            <td style="padding:6px 12px;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;">Sub-category</td>
            <td style="padding:6px 12px;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;text-align:right;">Agreement</td>
            <td style="padding:6px 12px;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;text-align:right;">Gap</td>
          </tr>
          ${subcatRows}
        </table>
      </div>`;
  }).join('');

  // Clinician flags
  const flags = clinicianFlags || {};
  const flagHTML = `
    <tr><td style="padding:7px 10px;border-bottom:1px solid #eee;font-weight:600;font-size:13px;">Meaning divergence</td>
      <td style="padding:7px 10px;border-bottom:1px solid #eee;font-size:13px;">${flags.meaningDivergence ? `Yes — ${flags.meaningDivergenceNote || ''}` : 'No'}</td></tr>
    <tr><td style="padding:7px 10px;border-bottom:1px solid #eee;font-weight:600;font-size:13px;">High importance / high gap subcats</td>
      <td style="padding:7px 10px;border-bottom:1px solid #eee;font-size:13px;">${flags.highImportanceHighGap?.length ? flags.highImportanceHighGap.join(', ') : 'None'}</td></tr>
    <tr><td style="padding:7px 10px;border-bottom:1px solid #eee;font-weight:600;font-size:13px;">Exclusivity vs Feeling Safe divergence</td>
      <td style="padding:7px 10px;border-bottom:1px solid #eee;font-size:13px;">${flags.exclusivityFeelinSafeDivergence ? 'Yes' : 'No'}</td></tr>
    <tr><td style="padding:7px 10px;border-bottom:1px solid #eee;font-weight:600;font-size:13px;">Spontaneity + Deliberateness both high</td>
      <td style="padding:7px 10px;border-bottom:1px solid #eee;font-size:13px;">${flags.spontaneityDeliberatenessBothHigh ? 'Yes' : 'No'}</td></tr>
    <tr><td style="padding:7px 10px;font-weight:600;font-size:13px;">Security-around-attraction subscale</td>
      <td style="padding:7px 10px;font-size:13px;">${securityAroundAttraction ?? 'N/A'}</td></tr>`;

  const coupleNote = respondent.coupleCode
    ? `<tr><td style="padding:7px 10px;border-bottom:1px solid #eee;font-weight:600;">Couple code</td><td style="padding:7px 10px;border-bottom:1px solid #eee;">${respondent.coupleCode}</td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>SVQ Clinician Report</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#fff;border-radius:12px;overflow:hidden;">

        <!-- Header -->
        <tr><td style="background:#1a2744;padding:24px 32px;">
          <div style="font-size:11px;color:#d4aa70;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">SVQ Clinician Report</div>
          <div style="font-size:22px;font-weight:700;color:#fff;font-family:Georgia,serif;">Full Results — ${respondent.name || 'Anonymous'}</div>
          <div style="font-size:13px;color:#aab4cc;margin-top:4px;">${submittedAt || ''} &nbsp;·&nbsp; ${respondent.email}</div>
        </td></tr>

        <tr><td style="padding:24px 32px 0;">

          <!-- Clinician Flags -->
          <div style="font-size:13px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:8px;">Clinician Flags</div>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:6px;margin-bottom:24px;">
            ${flagHTML}
            ${coupleNote}
          </table>

          <!-- All Meanings -->
          <div style="font-size:13px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:8px;">All Meanings (ranked)</div>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden;margin-bottom:24px;">
            ${meaningRows}
          </table>

          <!-- Domains + Sub-categories -->
          <div style="font-size:13px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:12px;">Domains and Sub-categories</div>
          ${domainSections}

        </td></tr>

        <tr><td style="padding:16px 32px 24px;border-top:1px solid #eee;">
          <p style="font-size:12px;color:#999;margin:0;">SVQ — confidential clinical data.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── COUPLE CODE / DYNAMODB HELPERS ─────────────────────────────────────────────
// Table: svq-couple-submissions
// Partition key: coupleCode (string)   Sort key: email (string)

async function getExistingSubmissions(coupleCode) {
  const result = await ddb.send(new QueryCommand({
    TableName: COUPLE_TABLE,
    KeyConditionExpression: "coupleCode = :cc",
    ExpressionAttributeValues: { ":cc": coupleCode },
  }));
  return result.Items || [];
}

async function saveCoupleSubmission(coupleCode, payload) {
  const { respondent, rankedMeanings, rankedDomains, topSubcats } = payload;
  await ddb.send(new PutCommand({
    TableName: COUPLE_TABLE,
    Item: {
      coupleCode,
      email: respondent.email,
      name: respondent.name || "",
      submittedAt: payload.submittedAt,
      rankedMeanings,
      rankedDomains,
      topSubcats,
    },
  }));
}

// Handles the couple-code side of a submission. Returns a status object so the
// handler can decide what (if anything) to do next. Does NOT send any email —
// individual results emails already sent by this point regardless of couple code.
async function handleCoupleCode(payload) {
  const coupleCode = payload.respondent?.coupleCode?.trim();
  if (!coupleCode) {
    return { coupleCode: null, status: "no_code" };
  }

  const existing = await getExistingSubmissions(coupleCode);
  const alreadySubmitted = existing.find(item => item.email === payload.respondent.email);

  if (!alreadySubmitted && existing.length >= 2) {
    // Code already has two other people on it. Front-end should have blocked
    // this before quiz start, but this is the backend safety net. We do NOT
    // throw — the person's own results email has already sent successfully,
    // this only affects the couple comparison, which will not run.
    console.warn(`Couple code ${coupleCode} rejected: already has ${existing.length} submissions`);
    return { coupleCode, status: "code_locked" };
  }

  await saveCoupleSubmission(coupleCode, payload);

  const updated = alreadySubmitted
    ? existing // resubmission under same email, count unchanged
    : [...existing, { email: payload.respondent.email }];

  if (updated.length >= 2) {
    // TODO (next build step): both partners have now submitted under this code.
    // This is where comparison logic (meanings/domains/sub-categories overlap),
    // the AI narration call, and the two comparison emails get triggered.
    // Not built yet — see Doc 1, Couple Code Phase, build queue items 3-6.
    console.log(`Couple code ${coupleCode} is complete — comparison flow not yet built.`);
    return { coupleCode, status: "ready_for_comparison" };
  }

  return { coupleCode, status: "waiting_for_partner" };
}

// ── HANDLER ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    const payload = req.body;
    const { respondent } = payload;

    if (!respondent?.email) {
      return res.status(400).json({ error: 'Respondent email required' });
    }

    payload.submittedAt = new Date().toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      dateStyle: 'full',
      timeStyle: 'short',
    });

    // Send client email — always sends, regardless of couple code
    await ses.send(new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: { ToAddresses: [respondent.email] },
      Message: {
        Subject: { Data: 'Your Sexual Values Quiz Results', Charset: 'UTF-8' },
        Body: { Html: { Data: buildClientEmail(payload), Charset: 'UTF-8' } },
      },
    }));

    // Send clinician email — always sends, regardless of couple code
    await ses.send(new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: { ToAddresses: [CLINICIAN_EMAIL] },
      Message: {
        Subject: { Data: `SVQ Results — ${respondent.name || respondent.email} — ${payload.submittedAt}`, Charset: 'UTF-8' },
        Body: { Html: { Data: buildClinicianEmail(payload), Charset: 'UTF-8' } },
      },
    }));

    // Couple code handling — never blocks or affects the emails above.
    // If this fails for any reason, the person's own results still went
    // through; we log the error but do not fail the request.
    let coupleStatus = { status: "no_code" };
    if (respondent.coupleCode) {
      try {
        coupleStatus = await handleCoupleCode(payload);
      } catch (coupleErr) {
        console.error('Couple code handling error (individual emails already sent):', coupleErr);
        coupleStatus = { status: "error", detail: coupleErr.message };
      }
    }

    return res.status(200).json({ ok: true, couple: coupleStatus });

  } catch (err) {
    console.error('SVQ submit error:', err);
    return res.status(500).json({ error: 'Email delivery failed', detail: err.message });
  }
}
