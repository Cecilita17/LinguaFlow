# YouTube Caption Extractor

This is the separately deployable extractor used by LinguaFlow's **Beta: YouTube CC** import. It deliberately runs outside Vercel: YouTube can flag Vercel's shared datacenter egress as automated traffic before it exposes caption tracks.

## Deploy

Build from the repository root:

```bash
docker build -f services/youtube-caption-extractor/Dockerfile -t linguaflow-youtube-extractor .
docker run -p 8080:8080 \
  -e EXTRACTOR_API_KEY="use-a-long-random-secret" \
  linguaflow-youtube-extractor
```

Deploy the same Docker image to an always-on host with a stable egress IP. The service exposes `GET /health` and authenticated `POST /extract/youtube`.

## Required LinguaFlow environment variables

Set these in Vercel after deploying the extractor:

```text
YOUTUBE_CAPTION_EXTRACTOR_URL=https://your-extractor.example.com
YOUTUBE_CAPTION_EXTRACTOR_API_KEY=the-same-value-as-EXTRACTOR_API_KEY
```

The URL must be HTTPS in production. Do not expose `EXTRACTOR_API_KEY` to the browser.

## YouTube session credentials

The service obtains visitor data from YouTube by default. If YouTube still requires an integrity attestation, configure these **only on the extractor host**:

```text
YOUTUBE_VISITOR_DATA=...
YOUTUBE_PO_TOKEN=...
```

They are never returned to LinguaFlow or logged. The token must be paired with the visitor data from the same trusted session and should be rotated when it expires. The extractor continues to return the same timestamped LinguaFlow subtitle contract.
