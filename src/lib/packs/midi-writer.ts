export interface MidiGuideParams {
  title: string;
  bpm: number;
  musicalKey: string;
  bars?: number;
}

const KEY_ROOT_MIDI: Record<string, { root: number; minor: boolean }> = {
  'C minor': { root: 60, minor: true },
  'A minor': { root: 57, minor: true },
  'D minor': { root: 62, minor: true },
  'E minor': { root: 64, minor: true },
  'G minor': { root: 67, minor: true },
  'C major': { root: 60, minor: false },
  'G major': { root: 67, minor: false },
  'F major': { root: 65, minor: false },
  'D major': { root: 62, minor: false },
  'A major': { root: 57, minor: false },
  'Eb major': { root: 63, minor: false },
  'Bb major': { root: 58, minor: false },
};

function encodeVlq(value: number): number[] {
  let v = Math.max(0, Math.floor(value));
  const bytes: number[] = [v & 0x7f];
  v >>= 7;
  while (v > 0) {
    bytes.unshift((v & 0x7f) | 0x80);
    v >>= 7;
  }
  return bytes;
}

function uint32BE(n: number): number[] {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

function uint16BE(n: number): number[] {
  return [(n >>> 8) & 0xff, n & 0xff];
}

function asciiBytes(str: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < str.length; i++) {
    out.push(str.charCodeAt(i) & 0x7f);
  }
  return out;
}

function buildTrackChunk(events: number[]): number[] {
  const endOfTrack = [0x00, 0xff, 0x2f, 0x00];
  const body = [...events, ...endOfTrack];
  return [...asciiBytes('MTrk'), ...uint32BE(body.length), ...body];
}

export function buildVocalGuideMidi(params: MidiGuideParams): Buffer {
  const bpm = Math.max(50, Math.min(220, Math.round(params.bpm || 108)));
  const ticksPerQuarter = 480;
  const usPerQuarter = Math.round(60_000_000 / bpm);
  const keySpec = KEY_ROOT_MIDI[params.musicalKey] ?? { root: 60, minor: true };
  const scale = keySpec.minor ? [0, 2, 3, 5, 7, 8, 10, 12] : [0, 2, 4, 5, 7, 9, 11, 12];
  const bars = Math.max(4, Math.min(16, params.bars ?? 8));

  // Track 0: Tempo, Time Signature (4/4), Track Name, and Chord Progression
  const track0: number[] = [];
  const nameBytes = asciiBytes((params.title || 'NTK Vocal Guide').slice(0, 48));
  track0.push(0x00, 0xff, 0x03, nameBytes.length, ...nameBytes);
  // Tempo meta event FF 51 03 tt tt tt
  track0.push(
    0x00,
    0xff,
    0x51,
    0x03,
    (usPerQuarter >>> 16) & 0xff,
    (usPerQuarter >>> 8) & 0xff,
    usPerQuarter & 0xff
  );
  // Time signature 4/4
  track0.push(0x00, 0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08);

  // Subtle pad chord track on channel 1 (root - 12 octave)
  const chordRoots = keySpec.minor ? [0, 5, 3, 4] : [0, 4, 5, 3];
  const barTicks = ticksPerQuarter * 4;
  for (let b = 0; b < bars; b++) {
    const deg = chordRoots[b % chordRoots.length];
    const r = Math.max(36, keySpec.root - 12 + scale[deg % 7]);
    const third = r + (keySpec.minor ? (deg === 0 || deg === 3 ? 3 : 4) : deg === 5 ? 3 : 4);
    const fifth = r + 7;
    const notes = [r, third, fifth];
    notes.forEach((n, idx) => {
      track0.push(...encodeVlq(idx === 0 ? 0 : 0), 0x91, n & 0x7f, 64);
    });
    notes.forEach((n, idx) => {
      track0.push(...encodeVlq(idx === 0 ? barTicks : 0), 0x81, n & 0x7f, 0);
    });
  }

  // Track 1: Singable Vocal Lead Guide Melody (Channel 0) for ACE Studio / DAW
  const track1: number[] = [];
  const leadName = asciiBytes('Lead Vocal Guide (ACE Studio)');
  track1.push(0x00, 0xff, 0x03, leadName.length, ...leadName);

  // Melodic pattern in 8th/quarter notes across bars
  const motif = [
    { deg: 0, dur: 1 },
    { deg: 2, dur: 1 },
    { deg: 4, dur: 2 },
    { deg: 3, dur: 1 },
    { deg: 2, dur: 1 },
    { deg: 1, dur: 2 },
    { deg: 2, dur: 1 },
    { deg: 4, dur: 1 },
    { deg: 5, dur: 1 },
    { deg: 4, dur: 1 },
    { deg: 3, dur: 2 },
    { deg: 0, dur: 2 },
  ];

  for (let b = 0; b < bars; b++) {
    const stepBase = (b % 4) * 3;
    let remainingBeats = 4;
    let idx = 0;
    while (remainingBeats > 0) {
      const m = motif[(stepBase + idx) % motif.length];
      const beats = Math.min(remainingBeats, m.dur);
      const durTicks = Math.round(beats * ticksPerQuarter * 0.9);
      const restTicks = beats * ticksPerQuarter - durTicks;
      const pitch = Math.min(84, Math.max(48, keySpec.root + scale[m.deg % scale.length]));
      track1.push(...encodeVlq(0), 0x90, pitch, 96);
      track1.push(...encodeVlq(durTicks), 0x80, pitch, 0);
      if (restTicks > 0) {
        // Advance delta by inserting a zero-velocity note-off or waiting on next event
        track1.push(...encodeVlq(restTicks), 0x80, pitch, 0);
      }
      remainingBeats -= beats;
      idx++;
    }
  }

  const header = [...asciiBytes('MThd'), ...uint32BE(6), ...uint16BE(1), ...uint16BE(2), ...uint16BE(ticksPerQuarter)];
  const bytes = [...header, ...buildTrackChunk(track0), ...buildTrackChunk(track1)];
  return Buffer.from(bytes);
}
