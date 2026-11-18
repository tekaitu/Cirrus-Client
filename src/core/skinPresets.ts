import type { SkinModel } from "../api/types";

/**
 * Four original Cirrus skins. They are real 64 x 64 PNGs (not SVG), so the
 * same bytes can be drawn in the preview, saved to the library, and handed to
 * Minecraft's skin service when the person applies one to their account.
 */

export interface SkinPreset {
  id: string;
  name: string;
  model: SkinModel;
  dataUrl: string;
}

const PRESET_PNG: Record<string, string> = {
  "cirrus-sky":
    "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABa0lEQVR42u2asWrCUBSGk9C1FAQRBJ2KuNuSPIPODqKLD6GLmzg5OXeRon0Fn0EpfQHJFMGl4NI9dfVexcvtCRVzv3/KxSTol3P+6/mJv1ktfz2BkmQnudybLNbeLRV4jgsAAAAAAADgsh5M+7hpn34btYVfgf8Bt60A0wnyJ5wTDyg0uhePnQFw+Pq4eMwu4BKAJNmJp7+7M8FTVauV3FWAX39pifKAUnNmdf53/Hn18+Lzq7KeRhvRDwybPR8PAAAA/m6CP4e9sn6KBlY9bauz+0XqcrgOM/UIWgAAeMB1PRbKVAAAAOCwB+hKt2oWENS6VAAAAOCQB/y3+kv9GamzQj8OqAAAACBDD9Dnf30WOMsHtOv1TE+cB2ia91KDR1ABAACAxANM83/e8gFaAAAAAAAAAOCwfOkNpO8XvI87GecFVAAAACCZBaSyzRNMsn0fwDYvoAUAgAdkq3vLE2gBAAAAAAAAgMM6AjHuUvhbetSBAAAAAElFTkSuQmCC",
  "cirrus-cloud":
    "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABeklEQVR42u2asUvDUBCHX6RbF6WTg3XpUCq4VEcX6ewuOLgVLHQX6ahjh5YK3cS/QOrarZOgi2Bx6GI6FATp5KzzO8orzwuG5H2/KY9LQvr17vdyR6LpZPRjFJrHseZyc/95bNLUhglcAAgdQCHtB9h8apMBAABAih6wbh8fPT44461WmwzI9S6Q9X84sQy4fq6sPA4GwNXBbOUxu0BIAOZxrO7+Mv0qvFMu5y4DotNmRzUP6N5cep0/+1g445XdbWu9nI5VP7B2dBLhAQAAwN9N8P31xVr3Bn2vmvaVvF9JxLdqjUQ9ghIAAB7gVnW/TgYAAAABe4DU7fDOWl80z8kAAAAgIA/4b30V9+y17D1EnAwAAAB0HiD7f9kLyLgx9nuAnOlp5wFSpe83p0eQAQAAgM4D1vX/eZsPUAIAAAAAAACAgBVpb6D9vqBzdpjovIAMAAAAdL2AVv7zBLcH+H4P4DsvoAQAgAckq6zNEygBAAAAAAAAQMD6Bbm3WL61wlEGAAAAAElFTkSuQmCC",
  "cirrus-storm":
    "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABbUlEQVR42u2avU4CQRSFd40NmlCIIfiXoOX2FrTaWNDbUVsQnkAtlISGRsIT0JHwANjwAtLiC2CAkEBBgpTQMiNhMt5JdJnvVDvZH8K3957hnhA2a4/LQKD+YCS5PXhrdYO/1F7guQAAAAAAAAA+a9+0j5v26WopTwXEugJMF8T9DTurgM+b143H3gCIOk8bj9kFfALQH4zE01/sTHBdF6eZnauA8CrKifKAs2xkdf10/LX1/FH6XFkX705EX/C+VA7xAAAA4PcmOJ9NlPVx5tKqp23183mqB9TbQ6ceQQsAAA/YrsNkigoAAAA89gBdi++Zsk4cJKkAAADA4zzgv3tAr/tOHgAAAFj8DtDnf30W0M/rHqBnevI8QNVz4VpZvzQ+qAAAAMChB5jm/13LB2gBAAAAAAAAgM95gPQB0jyh8nAr+nxmAVoAAG5nAals8wSTbP8PYJsX0AIAwAPcKm55Ai0AAAAAAAAA8Fgr06FR9NABYyAAAAAASUVORK5CYII=",
  "cirrus-dawn":
    "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABgElEQVR42u2avUoDQRSF7wbFOhYqxN/SRgIpAgGt7FIJamWr2IgPYCNoYZUmpBDxBdTWF7CzEOwsNT8LWllLClPPGDZc7+qSne9UOzubJfvlzJncy0ZvD3ffYlDc61o+LrX1NclSBQlcAAgdwETWX+Bk7xgHAAAAGWbAqH38/vI6cf7g7BQH5HoXGPdfODUHLK0Uhx4HA6D9+jn0mF0gJABxr2uu/sb6r3BpfiF3DojqtU1TP6CxNa26/qXzkTi/ujjrjKequ6YHXN7YjsgAAADg9yHYfo+d8Xl9RrWmtfLvV66681+PN6lmBEsAAGTAiCJoruSd6eMAAAAg0GJIROTqadIZ71f6OAAAAAgoA/5bz7fN5As6TRwAAACkmAF+/e/XAv68iNsf8Ht61n6Ar/LOkS4jcAAAAKDKgJ/1f777AywBAAAAAAAAQMCKrDewvl/Qujj8234BDgAAAFS1gFX6fkKytO8DaPsFLAEAkAHpSt9PwAEAAAAAAAAAAGSkAeHfVa2mWIIsAAAAAElFTkSuQmCC",
};

export const SKIN_PRESETS: SkinPreset[] = [
  {
    id: "cirrus-sky",
    name: "Cirrus Sky",
    model: "classic",
    dataUrl: `data:image/png;base64,${PRESET_PNG["cirrus-sky"]}`,
  },
  {
    id: "cirrus-cloud",
    name: "Cirrus Cloud",
    model: "slim",
    dataUrl: `data:image/png;base64,${PRESET_PNG["cirrus-cloud"]}`,
  },
  {
    id: "cirrus-storm",
    name: "Cirrus Storm",
    model: "classic",
    dataUrl: `data:image/png;base64,${PRESET_PNG["cirrus-storm"]}`,
  },
  {
    id: "cirrus-dawn",
    name: "Cirrus Dawn",
    model: "slim",
    dataUrl: `data:image/png;base64,${PRESET_PNG["cirrus-dawn"]}`,
  },
];

/** The base64 payload the skin library stores for a preset. */
export function presetBase64(preset: SkinPreset): string {
  return PRESET_PNG[preset.id] ?? "";
}
