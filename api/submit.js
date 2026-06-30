import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const ses = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

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
            <a href="https://hannah-wood-kraft.clientsecure.me/" style="display:inline-block;padding:14px 28px;background:#d4aa70;color:#ffffff;font-weight:600;font-size:15px;text-decoration:none;border-radius:6px;">Book a session with your therapist</a>
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
  const { respondent, rankedMeanings, rankedDomains, topSubcats, scScores, clinicianFlags, securityAroundAttraction, rawResponses, submittedAt } = payload;

  const meaningRows = rankedMeanings.map(m => `
    <tr>
      <td style="padding:7px 10px;border-bottom:1px solid #eee;font-weight:600;color:#1a2744;">${m.meaning}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #eee;">${m.impScore}%</td>
      <td style="padding:7px 10px;border-bottom:1px solid #eee;">${m.gapScore}</td>
    </tr>`).join('');

  const domainRows = rankedDomains.map(d => `
    <tr>
      <td style="padding:7px 10px;border-bottom:1px solid #eee;font-weight:600;color:#1a2744;">${d.domain}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #eee;">${d.score.toFixed(2)}</td>
    </tr>`).join('');

  const subcatRows = Object.entries(scScores || {}).map(([sc, s]) => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:13px;">${sc}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:13px;">${s.impScore.toFixed(2)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:13px;">${s.gapScore.toFixed(3)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:13px;">${s.rankingScore.toFixed(2)}</td>
    </tr>`).join('');

  const flags = clinicianFlags || {};
  const flagHTML = `
    <tr><td style="padding:7px 10px;border-bottom:1px solid #eee;font-weight:600;">Meaning divergence</td>
      <td style="padding:7px 10px;border-bottom:1px solid #eee;">${flags.meaningDivergence ? `Yes — ${flags.meaningDivergenceNote || ''}` : 'No'}</td></tr>
    <tr><td style="padding:7px 10px;border-bottom:1px solid #eee;font-weight:600;">High importance / high gap subcats</td>
      <td style="padding:7px 10px;border-bottom:1px solid #eee;">${flags.highImportanceHighGap?.length ? flags.highImportanceHighGap.join(', ') : 'None'}</td></tr>
    <tr><td style="padding:7px 10px;border-bottom:1px solid #eee;font-weight:600;">Exclusivity vs Feeling Safe divergence</td>
      <td style="padding:7px 10px;border-bottom:1px solid #eee;">${flags.exclusivityFeelinSafeDivergence ? 'Yes' : 'No'}</td></tr>
    <tr><td style="padding:7px 10px;border-bottom:1px solid #eee;font-weight:600;">Spontaneity + Deliberateness both high</td>
      <td style="padding:7px 10px;border-bottom:1px solid #eee;">${flags.spontaneityDeliberatenessBothHigh ? 'Yes' : 'No'}</td></tr>
    <tr><td style="padding:7px 10px;font-weight:600;">Security-around-attraction subscale</td>
      <td style="padding:7px 10px;">${securityAroundAttraction ?? 'N/A'}</td></tr>`;

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
          <div style="font-size:13px;color:#aab4cc;margin-top:4px;">${submittedAt || ''}</div>
        </td></tr>

        <tr><td style="padding:24px 32px 0;">

          <!-- Respondent -->
          <div style="font-size:13px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:8px;">Respondent</div>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:6px;margin-bottom:24px;">
            <tr><td style="padding:7px 10px;border-bottom:1px solid #eee;font-weight:600;width:200px;">Email</td><td style="padding:7px 10px;border-bottom:1px solid #eee;">${respondent.email}</td></tr>
            <tr><td style="padding:7px 10px;border-bottom:1px solid #eee;font-weight:600;">Name</td><td style="padding:7px 10px;border-bottom:1px solid #eee;">${respondent.name || 'Anonymous'}</td></tr>
            ${coupleNote}
          </table>

          <!-- Clinician Flags -->
          <div style="font-size:13px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:8px;">Clinician Flags</div>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:6px;margin-bottom:24px;">
            ${flagHTML}
          </table>

          <!-- Meanings -->
          <div style="font-size:13px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:8px;">Meanings (ranked)</div>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:6px;margin-bottom:24px;">
            <tr style="background:#f9f9f9;">
              <td style="padding:7px 10px;font-weight:700;font-size:12px;border-bottom:1px solid #eee;">MEANING</td>
              <td style="padding:7px 10px;font-weight:700;font-size:12px;border-bottom:1px solid #eee;">AGREEMENT %</td>
              <td style="padding:7px 10px;font-weight:700;font-size:12px;border-bottom:1px solid #eee;">GAP</td>
            </tr>
            ${meaningRows}
          </table>

          <!-- Domains -->
          <div style="font-size:13px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:8px;">Domains</div>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:6px;margin-bottom:24px;">
            <tr style="background:#f9f9f9;">
              <td style="padding:7px 10px;font-weight:700;font-size:12px;border-bottom:1px solid #eee;">DOMAIN</td>
              <td style="padding:7px 10px;font-weight:700;font-size:12px;border-bottom:1px solid #eee;">SCORE</td>
            </tr>
            ${domainRows}
          </table>

          <!-- Sub-categories -->
          <div style="font-size:13px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:8px;">Sub-categories (all 18)</div>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:6px;margin-bottom:24px;">
            <tr style="background:#f9f9f9;">
              <td style="padding:6px 10px;font-weight:700;font-size:12px;border-bottom:1px solid #eee;">SUBCAT</td>
              <td style="padding:6px 10px;font-weight:700;font-size:12px;border-bottom:1px solid #eee;">IMP</td>
              <td style="padding:6px 10px;font-weight:700;font-size:12px;border-bottom:1px solid #eee;">GAP</td>
              <td style="padding:6px 10px;font-weight:700;font-size:12px;border-bottom:1px solid #eee;">RANK</td>
            </tr>
            ${subcatRows}
          </table>

        </td></tr>

        <tr><td style="padding:16px 32px 24px;border-top:1px solid #eee;">
          <p style="font-size:12px;color:#999;margin:0;">SVQ — confidential clinical data. Raw responses available on request.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
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

    // Send client email
    await ses.send(new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: { ToAddresses: [respondent.email] },
      Message: {
        Subject: { Data: 'Your Sexual Values Quiz Results', Charset: 'UTF-8' },
        Body: { Html: { Data: buildClientEmail(payload), Charset: 'UTF-8' } },
      },
    }));

    // Send clinician email
    await ses.send(new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: { ToAddresses: [CLINICIAN_EMAIL] },
      Message: {
        Subject: { Data: `SVQ Results — ${respondent.name || respondent.email} — ${payload.submittedAt}`, Charset: 'UTF-8' },
        Body: { Html: { Data: buildClinicianEmail(payload), Charset: 'UTF-8' } },
      },
    }));

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('SVQ submit error:', err);
    return res.status(500).json({ error: 'Email delivery failed', detail: err.message });
  }
}
