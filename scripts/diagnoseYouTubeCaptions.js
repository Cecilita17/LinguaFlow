#!/usr/bin/env node
import { Innertube } from 'youtubei.js';

const videoId = process.argv[2];
const validVideoId = /^[A-Za-z0-9_-]{11}$/;
const clientProfiles = ['ANDROID', 'IOS', 'WEB'];

if (!validVideoId.test(videoId || '')) {
  console.error('Usage: node scripts/diagnoseYouTubeCaptions.js VIDEO_ID');
  process.exitCode = 1;
} else {
  const innertube = await Innertube.create({
    client_type: 'WEB',
    generate_session_locally: true,
    enable_session_cache: false,
    retrieve_player: false
  });

  for (const clientProfile of clientProfiles) {
    try {
      const info = await innertube.getInfo(videoId, { client: clientProfile });
      const captions = info?.captions;
      const tracks = captions?.caption_tracks;
      const output = {
        clientProfile,
        success: true,
        basicInfoPresent: Boolean(info?.basic_info),
        captionsPresent: Boolean(captions),
        captionsType: captions?.constructor?.name || null,
        captionKeys: captions ? Object.keys(captions).sort() : [],
        captionTracksPresent: Array.isArray(tracks),
        captionTrackCount: Array.isArray(tracks) ? tracks.length : null,
        tracks: Array.isArray(tracks)
          ? tracks.map((track) => ({
            languageCode: track.language_code || null,
            languageLabel: String(track.name?.toString?.() || track.name || '').slice(0, 120),
            kind: track.kind === 'asr' ? 'auto-generated' : 'manual'
          }))
          : [],
        playabilityStatus: info?.playability_status?.status?.toString?.() || null,
        playabilityReason: String(info?.playability_status?.reason?.toString?.() || '').replace(/\s+/g, ' ').slice(0, 180) || null
      };
      console.log(JSON.stringify(output));
    } catch (error) {
      console.log(JSON.stringify({
        clientProfile,
        success: false,
        errorName: error?.name || 'Error',
        errorMessage: String(error?.message || 'Unknown error').replace(/\s+/g, ' ').slice(0, 180)
      }));
    }
  }
}
