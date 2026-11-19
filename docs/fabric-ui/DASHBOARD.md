# Cirrus dashboard configuration (client side)

The main menu's partner strip, the bottom-right promotion banner, the STORE button and the featured servers in Multiplayer are
driven by one JSON document. The Cirrus website dashboard does not exist yet; the client is ready for it.

## Where the data comes from

1. **Last good download**: `config/cirrus-client/dashboard-cache.json` (written atomically after a validated fetch).
2. **Bundled fallback**: `assets/cirrus_fabric/dashboard/default-dashboard.json` inside the mod. Its partners are clearly labelled
   samples (`*.example` addresses that never resolve) and the store is disabled until the dashboard provides a URL.

A refresh over the network only happens when a dashboard URL is set, either `dashboard.url` in the Cirrus config file (no settings screen for it yet) or
`-Dcirrus.dashboard.url=https://...`. With no URL the client never contacts anything for this data. The URL must be `https`.

## Schema (version 1)

```json
{
  "schema": 1,
  "revision": 12,
  "store":   { "label": "STORE", "url": "https://...", "enabled": true },
  "partners": [
    { "id": "my-server", "name": "My Server", "address": "play.example.com[:port]", "tagline": "...",
      "color": "#1B8FFF", "iconUrl": "https://...png (reserved)", "featured": true, "order": 1 }
  ],
  "banners": [
    { "id": "launch", "title": "...", "subtitle": "...", "cta": "Learn more", "url": "https://...",
      "colorA": "#0B1E4A", "colorB": "#1B8FFF", "imageUrl": "https://... (reserved)", "order": 1 }
  ],
  "storePromos": [ { "id": "sale", "text": "20% off capes", "url": "https://...", "order": 1 } ]
}
```

## Safety rules enforced by `DashboardParser`

* Document at most 128 KiB; wrong `schema`, non-JSON or non-object roots are rejected and the previous data is kept.
* Each entry is validated on its own, so one bad entry is dropped without losing the rest. Duplicate ids are dropped.
* Caps: 12 partners, 6 banners, 4 store promotions.
* Every URL must be `https` with a host and no embedded credentials; otherwise it becomes empty (an unusable store URL disables the button).
* Server addresses must be `host` or `host:port` (port 1-65535).
* Text is length-limited and stripped of control characters and Minecraft `§` formatting.
* Links open through the vanilla "Open link?" confirmation screen.

## What is not built yet

* `iconUrl` / `imageUrl` are parsed and validated but not downloaded; tiles show coloured monograms and banners are drawn from colours and text.
* No website dashboard or publishing endpoint exists; there is no authentication, analytics or tracking in the client.
* Partner status uses Minecraft's normal server-list ping against each partner address when the title screen opens.
