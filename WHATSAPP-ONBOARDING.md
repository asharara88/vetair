# WhatsApp Business API Onboarding

Vetair's comms layer uses Meta's WhatsApp Business Cloud API. For the pitch
demo, sandbox mode is sufficient — no business verification required.

## Overview of what you'll configure

- **Meta developer app** with WhatsApp product added
- **Sandbox phone number** Meta provides (a test number, not your own)
- **Up to 5 test recipient numbers** you whitelist manually
- **3 env vars** pasted into Vercel + Supabase
- **1 webhook URL** pointed at our Next.js route

## Step-by-step

### 1. Create a Meta developer account

If you don't already have one: https://developers.facebook.com/ → sign in with
your personal Facebook account → agree to the developer terms.

### 2. Create an app

1. https://developers.facebook.com/apps/
2. Click **Create App**
3. Use case: **Other** → **Business**
4. Name it "Vetair" (or anything — only you see this)

### 3. Add the WhatsApp product

In your new app's dashboard:

1. Under "Add products to your app", find **WhatsApp** → **Set up**
2. You'll land on the WhatsApp config page with a default test business
   account pre-created for you.

### 4. Capture the three credentials

Still on the WhatsApp config page:

- **Phone number ID** → top of the "From" section. Looks like a numeric ID.
  Set this as `WHATSAPP_PHONE_NUMBER_ID`.
- **Access token** → top of "API Setup". The default is a 24-hour temporary
  token (fine for pitch demo). For production, generate a permanent system
  user token under **Business Settings → System Users**.
  Set this as `WHATSAPP_ACCESS_TOKEN`.
- **App secret** → go to **App settings → Basic**. Click **Show** next to
  "App secret". Set this as `WHATSAPP_APP_SECRET`.

### 5. Whitelist your test recipient numbers

Under **WhatsApp → API Setup → To**: click **Manage phone number list** and
add up to 5 numbers that can receive messages from the sandbox. Add:

- Your own UAE number
- Haitham's UAE number (if he's joining the demo)
- Any other demo recipients

Each number must verify via a one-time code Meta sends.

### 6. Set the webhook

In the sidebar: **WhatsApp → Configuration → Webhook**.

- **Callback URL**: `https://vetair-git-main-ahmedmsharara-4731s-projects.vercel.app/api/webhooks/whatsapp`
  (swap this for your custom domain once attached)
- **Verify token**: any string you choose, e.g. a random 32-char hex. Set the
  SAME value as `WHATSAPP_VERIFY_TOKEN` in Vercel env vars. You'll paste this
  string in both places.
- Click **Verify and save**. Meta will do a `GET` on our webhook; our route
  echoes the `hub.challenge` back iff the verify token matches.
- Under **Webhook fields**: subscribe to **messages** at minimum. Also
  recommended: **message_status_update** to get delivery/read receipts.

### 7. Set the env vars

**Vercel** → project `vetair` → Settings → Environment Variables.
Add all three to **Production** and **Preview** scopes:

```
WHATSAPP_PHONE_NUMBER_ID=<from step 4>
WHATSAPP_ACCESS_TOKEN=<from step 4>
WHATSAPP_APP_SECRET=<from step 4>
WHATSAPP_VERIFY_TOKEN=<whatever string you chose in step 6>
```

**Supabase** → project `yydnaisrgwiuuiespagi` → Edge Functions → Secrets.
Only the sending creds are needed here:

```
WHATSAPP_PHONE_NUMBER_ID=<same as above>
WHATSAPP_ACCESS_TOKEN=<same as above>
```

### 8. Smoke test

Once webhooks are verified and env vars are saved:

1. **Inbound**: send "test 1" from your whitelisted phone to Meta's sandbox
   number. Open the Supabase dashboard → `whatsapp_webhook_events` table. You
   should see a row with `signature_valid=true` and `event_type='message'`.
2. **Outbound**: call the `whatsapp-send` edge function:
   ```bash
   curl -X POST https://yydnaisrgwiuuiespagi.supabase.co/functions/v1/whatsapp-send \
     -H "Content-Type: application/json" \
     -d '{"owner_id": "<owner-uuid>", "body": "Vetair online."}'
   ```
   Expected: your phone receives "Vetair online." within a few seconds.

## Graceful fallback behavior

If WhatsApp creds are **not** set:

- **Inbound webhook** still works for signature verification tests but of
  course receives no real messages.
- **Outbound send** detects the missing creds and marks `comms_messages.status
  = 'sent'` with a dramatized id `wamid.DRAMATIZED_<uuid>` — the UI pipeline
  continues to work; nothing is actually sent to Meta.

This means the pitch deck demo functions regardless of Meta configuration,
and you can flip to "live" at will by pasting the creds.

## Security notes

- The **app secret** gates inbound webhook authenticity (Meta signs every
  POST with HMAC-SHA256 over the raw body). Our webhook handler refuses to
  act on any POST whose signature doesn't match.
- All inbound events are audited in `whatsapp_webhook_events` regardless of
  signature validity — so if somebody is spraying our webhook URL with
  garbage, we see it in the audit log with `signature_valid=false`.
- The temporary 24h access token will expire. For pitch day, generate a
  permanent system user token (Business Settings → System Users → Add →
  Admin role → Generate new token with `whatsapp_business_messaging` and
  `whatsapp_business_management` scopes).

## Cost

- **Sandbox conversations** (Meta test number → 5 whitelisted numbers): free.
- **Production conversations** (once verified): Meta charges per
  business-initiated 24-hour conversation window. UAE outbound is ~$0.04–0.06
  per conversation depending on category. Inbound (user-initiated within 24h
  of last outbound) is free.

Not a concern for pitch or pilot stage.
