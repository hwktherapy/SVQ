# SVQ Backend — Deployment Guide
# Complete these steps in order. Steps marked [YOU] require you to do something.
# Steps marked [TERMINAL] require typing a command. Steps marked [BROWSER] are done in a web browser.

---

## PART 1 — AWS SES (email sending)

### Step 1 [BROWSER] — Create an AWS account
1. Go to https://aws.amazon.com and click "Create an AWS Account"
2. Use your hwktherapy.com Google Workspace email
3. Select the free tier / personal account option
4. Add a credit card (you will not be charged — free tier covers your volume easily)

### Step 2 [BROWSER] — Verify your sending domain in SES
1. In AWS Console, search for "SES" → click "Simple Email Service"
2. In the left menu: Identities → Create Identity
3. Choose "Domain" and enter: hwktherapy.com
4. AWS will give you DNS records to add — copy them
5. Log into your domain registrar (wherever you bought hwktherapy.com) and add those DNS records
6. Wait up to 24 hours for verification (usually faster)

### Step 3 [BROWSER] — Create an IAM user for sending
1. In AWS Console, search for "IAM"
2. Users → Create User → name it "svq-ses-sender"
3. Attach policy: AmazonSESFullAccess
4. Create user → Security credentials tab → Create access key → choose "Application running outside AWS"
5. Copy the Access Key ID and Secret Access Key — you will need these in Part 3

### Step 4 [BROWSER] — Request production access (move out of sandbox)
SES starts in sandbox mode, which means you can only send to verified addresses.
1. In SES console → Account dashboard → Request production access
2. Fill out the form: explain it's a clinical tool for a private practice, low volume (~50 emails/week)
3. AWS approves these quickly for legitimate low-volume use (usually same day)

### Step 5 [BROWSER] — Sign the BAA
1. In AWS Console → top right account menu → Account
2. Scroll to "AWS Artifact" or search for "AWS Artifact" in the console
3. Download and sign the HIPAA BAA
   (Alternatively: https://aws.amazon.com/compliance/hipaa-compliance/ → scroll to BAA section)

---

## PART 2 — Vercel (hosting)

### Step 6 [BROWSER] — Create a Vercel account
1. Go to https://vercel.com and sign up with your Google Workspace email
2. Select the free Hobby plan

### Step 7 [BROWSER or TERMINAL] — Deploy the project
Option A — via GitHub (recommended):
1. Create a free GitHub account at https://github.com
2. Create a new repository called "svq"
3. Upload the svq-backend folder contents to that repository
4. In Vercel: New Project → Import from GitHub → select your svq repo
5. Vercel will detect it automatically and deploy

Option B — via Vercel CLI:
1. Install Node.js from https://nodejs.org (LTS version)
2. Open Terminal and run:
   npm install -g vercel
   cd path/to/svq-backend
   vercel login
   vercel

### Step 8 [BROWSER] — Add environment variables
1. In Vercel dashboard → your project → Settings → Environment Variables
2. Add each variable from .env.example with its real value:
   - AWS_SES_REGION = us-east-1
   - AWS_SES_ACCESS_KEY_ID = (from Step 3)
   - AWS_SES_SECRET_ACCESS_KEY = (from Step 3)
   - CLINICIAN_EMAIL = hannah@hwktherapy.com
   - FROM_EMAIL = noreply@hwktherapy.com
3. Redeploy after adding variables: Deployments → three dots → Redeploy

### Step 9 [BROWSER] — Connect your domain
1. In Vercel → project → Settings → Domains
2. Add: quiz.hwktherapy.com (or svq.hwktherapy.com — your choice)
3. Vercel will give you DNS records to add to your domain registrar
4. Add them — propagation takes up to 24 hours

---

## PART 3 — Test

Once deployed:
1. Go to your quiz URL
2. Complete the quiz with your own email
3. Check that you receive a client results email
4. Check that hannah@hwktherapy.com receives a clinician report
5. Confirm both look correct

---

## Ongoing costs (estimated)
- Vercel: $0 (free tier, more than sufficient)
- AWS SES: $0 (free tier = 62,000 emails/month — you will never hit this)
- Google Workspace: $6/month (already set up)
- Total: ~$6/month
