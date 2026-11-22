// Browser-native speech synthesis (TTS), dialogue role-play runner,
// local MediaRecorder voice recording, and optional live SpeechRecognition captions.

import { Injectable, signal } from '@angular/core';
import type { DialogueTurn } from '../models';

export interface ActiveDialogueTurn {
  date: string;
  index: number;
  waitingForYou: boolean;
  resume: (() => void) | null;
}

interface SpeechRecLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

const PREFERRED_VOICE_PATTERNS = [
  /google us english/i,
  /natural.*united states/i,
  /aria|jenny|guy|davis|samantha|alex|ava|allison|nicky/i,
  /enhanced/i,
];

@Injectable({ providedIn: 'root' })
export class SpeechService {
  readonly activeTurn = signal<ActiveDialogueTurn | null>(null);

  private dialogueToken = 0;
  private activeRec: {
    recorder: MediaRecorder;
    stream: MediaStream;
    chunks: Blob[];
    startedAt: number;
    mimeType: string;
  } | null = null;
  private activeSpeech: SpeechRecLike | null = null;

  canSpeak(): boolean {
    return typeof window !== 'undefined'
      && 'speechSynthesis' in window
      && typeof SpeechSynthesisUtterance !== 'undefined';
  }

  listEnUsVoices(): SpeechSynthesisVoice[] {
    if (!this.canSpeak()) return [];
    let voices: SpeechSynthesisVoice[] = [];
    try {
      voices = window.speechSynthesis.getVoices() || [];
    } catch {
      return [];
    }
    const enUs = voices.filter(v => /^en[-_]US$/i.test(v.lang));
    const pool = enUs.length ? enUs : voices.filter(v => /^en/i.test(v.lang));
    return [...pool].sort((a, b) => {
      const score = (v: SpeechSynthesisVoice) => {
        const idx = PREFERRED_VOICE_PATTERNS.findIndex(re => re.test(v.name));
        return (idx === -1 ? 99 : idx) + (/^en[-_]US$/i.test(v.lang) ? 0 : 100);
      };
      return score(a) - score(b) || a.name.localeCompare(b.name);
    });
  }

  stopSpeaking(): void {
    this.dialogueToken += 1;
    this.activeTurn.set(null);
    if (!this.canSpeak()) return;
    try { window.speechSynthesis.cancel(); } catch { }
  }

  speak(
    text: string,
    { voiceName = null, rate = 1.0, onEnd = null }: { voiceName?: string | null; rate?: number; onEnd?: (() => void) | null } = {},
  ): boolean {
    if (!this.canSpeak() || !text) {
      onEnd?.();
      return false;
    }
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text));
      const voices = this.listEnUsVoices();
      const chosen = (voiceName && voices.find(v => v.name === voiceName)) || voices[0] || null;
      if (chosen) u.voice = chosen;
      u.lang = chosen?.lang || 'en-US';
      u.rate = Math.max(0.65, Math.min(1.4, Number(rate) || 1.0));
      let finished = false;
      const done = () => {
        if (!finished) {
          finished = true;
          onEnd?.();
        }
      };
      u.onend = done;
      u.onerror = done;
      window.speechSynthesis.speak(u);
      return true;
    } catch {
      onEnd?.();
      return false;
    }
  }

  playDialogue(
    date: string,
    turns: DialogueTurn[],
    { voiceName = null, rate = 1.0, rolePlay = false }: { voiceName?: string | null; rate?: number; rolePlay?: boolean } = {},
  ): void {
    this.stopSpeaking();
    const token = ++this.dialogueToken;
    let index = 0;

    const step = () => {
      if (token !== this.dialogueToken) return;
      if (index >= turns.length) {
        this.activeTurn.set(null);
        return;
      }
      const turn = turns[index];
      const isYou = turn.speaker === 'You';
      this.activeTurn.set({ date, index, waitingForYou: false, resume: null });

      if (rolePlay && isYou) {
        this.activeTurn.set({
          date,
          index,
          waitingForYou: true,
          resume: () => {
            if (token !== this.dialogueToken) return;
            index += 1;
            step();
          },
        });
        return;
      }

      const advance = () => {
        if (token !== this.dialogueToken) return;
        index += 1;
        setTimeout(step, 320);
      };

      if (!this.canSpeak() || !this.listEnUsVoices().length) {
        setTimeout(advance, 500);
        return;
      }

      this.speak(turn.text, { voiceName, rate, onEnd: advance });
    };

    step();
  }

  /* ---------- Voice Recorder ---------- */

  canRecord(): boolean {
    return typeof navigator !== 'undefined'
      && Boolean(navigator.mediaDevices?.getUserMedia)
      && typeof MediaRecorder !== 'undefined';
  }

  private pickMimeType(): string {
    if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
    return candidates.find(t => MediaRecorder.isTypeSupported(t)) || '';
  }

  async startRecording(): Promise<boolean> {
    if (!this.canRecord()) throw new Error('Audio recording is not supported in this browser.');
    if (this.activeRec) await this.stopRecording().catch(() => { });
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = this.pickMimeType();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    const chunks: Blob[] = [];
    const startedAt = Date.now();
    recorder.ondataavailable = e => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    recorder.start(250);
    this.activeRec = {
      recorder,
      stream,
      chunks,
      startedAt,
      mimeType: recorder.mimeType || mimeType || 'audio/webm',
    };
    return true;
  }

  stopRecording(): Promise<{ blob: Blob; mimeType: string; durationSec: number } | null> {
    return new Promise((resolve, reject) => {
      if (!this.activeRec) {
        resolve(null);
        return;
      }
      const { recorder, stream, chunks, startedAt, mimeType } = this.activeRec;
      this.activeRec = null;
      const release = () => {
        try { stream.getTracks().forEach(t => t.stop()); } catch { }
      };
      if (recorder.state === 'inactive') {
        release();
        const durationSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
        resolve({ blob: new Blob(chunks, { type: mimeType }), mimeType, durationSec });
        return;
      }
      recorder.onstop = () => {
        release();
        const durationSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
        resolve({ blob: new Blob(chunks, { type: mimeType }), mimeType, durationSec });
      };
      recorder.onerror = e => {
        release();
        reject((e as unknown as { error?: Error })?.error || new Error('Recording failed.'));
      };
      try {
        recorder.stop();
      } catch (err) {
        release();
        reject(err);
      }
    });
  }

  /* ---------- Live Speech-to-Text ---------- */

  private getRecognitionCtor(): (new () => SpeechRecLike) | null {
    if (typeof window === 'undefined') return null;
    const w = window as unknown as Record<string, unknown>;
    return (w['SpeechRecognition'] || w['webkitSpeechRecognition'] || null) as (new () => SpeechRecLike) | null;
  }

  canDictate(): boolean {
    return Boolean(this.getRecognitionCtor());
  }

  startDictation({
    onResult,
    onError,
    onEnd,
  }: {
    onResult?: (res: { finalText: string; interimText: string }) => void;
    onError?: (err: string) => void;
    onEnd?: () => void;
  } = {}): boolean {
    const Ctor = this.getRecognitionCtor();
    if (!Ctor) throw new Error('Live speech recognition is not supported in this browser.');
    this.stopDictation();
    const rec = new Ctor();
    rec.lang = 'en-US';
    rec.continuous = true;
    rec.interimResults = true;
    let finalText = '';
    rec.onresult = event => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) finalText += `${res[0].transcript.trim()} `;
        else interim += res[0].transcript;
      }
      onResult?.({ finalText: finalText.trim(), interimText: interim.trim() });
    };
    rec.onerror = e => onError?.(e?.error || 'speech-error');
    rec.onend = () => {
      if (this.activeSpeech === rec) this.activeSpeech = null;
      onEnd?.();
    };
    rec.start();
    this.activeSpeech = rec;
    return true;
  }

  stopDictation(): void {
    if (!this.activeSpeech) return;
    const rec = this.activeSpeech;
    this.activeSpeech = null;
    try { rec.stop(); } catch { }
  }
}
