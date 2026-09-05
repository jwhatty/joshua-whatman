import { subscribePlayhead, type PlayheadState } from "@/lib/playhead";

/**
 * The site's sound design, synthesized — no audio files. Each scene gets a
 * room tone (filtered noise, slow LFO on the filter so it breathes), the
 * wipes drive a wind band whose loudness follows how fast the doors move,
 * and UI hovers get a tiny blip. Everything hangs off one AudioContext that
 * only exists after the user opts in, and suspends when they opt out.
 */

/** Per-scene room-tone recipe, cycled if there are more scenes than recipes. */
type BedRecipe = {
    /** Lowpass cutoff — the "colour" of the room. */
    freq: number;
    /** Bed loudness. Quiet is the whole point. */
    gain: number;
    /** LFO rate/depth wobbling the cutoff so the tone isn't a dial tone. */
    lfoRate: number;
    lfoDepth: number;
    /** Optional sine sub underneath (the contact scene's mains hum). */
    sub?: { freq: number; gain: number };
};

const BED_RECIPES: BedRecipe[] = [
    { freq: 240, gain: 0.055, lfoRate: 0.07, lfoDepth: 70 }, // hero: dark studio
    { freq: 900, gain: 0.03, lfoRate: 0.11, lfoDepth: 300 }, // work: tape hiss air
    { freq: 420, gain: 0.045, lfoRate: 0.05, lfoDepth: 150 }, // about: live room
    { freq: 180, gain: 0.06, lfoRate: 0.04, lfoDepth: 40, sub: { freq: 55, gain: 0.02 } }, // contact
];

const TICK_THROTTLE_MS = 70;

/** Master level with nothing ducking it. */
const MASTER_GAIN = 0.9;

type Bed = { gain: GainNode; level: number };

class SoundEngine {
    enabled = false;

    private ctx: AudioContext | null = null;
    private master: GainNode | null = null;
    private noiseBuffer: AudioBuffer | null = null;
    private beds: Bed[] = [];
    private wind: { gain: GainNode; filter: BiquadFilterNode } | null = null;
    private unsubscribe: (() => void) | null = null;
    private last = { incoming: -1, wipe: 0 };
    private lastTick = 0;

    /** Flip sound on/off. Must be called from a user gesture. Returns the new state. */
    toggle(): boolean {
        if (this.enabled) this.disable();
        else this.enable();
        return this.enabled;
    }

    /** Tiny hover blip. No-op while sound is off. */
    tick() {
        const ctx = this.ctx;
        if (!this.enabled || !ctx || !this.master) return;

        const now = performance.now();
        if (now - this.lastTick < TICK_THROTTLE_MS) return;
        this.lastTick = now;

        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.frequency.setValueAtTime(1800, t);
        osc.frequency.exponentialRampToValueAtTime(1200, t + 0.04);
        env.gain.setValueAtTime(0.05, t);
        env.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        osc.connect(env).connect(this.master);
        osc.start(t);
        osc.stop(t + 0.06);
    }

    /**
     * Duck the site's own bed to silence while a reel plays — the video is the
     * only source that should be audible. No-op while sound is off.
     */
    duck(on: boolean) {
        const ctx = this.ctx;
        if (!ctx || !this.master) return;

        const t = ctx.currentTime;
        this.master.gain.cancelScheduledValues(t);
        this.master.gain.setValueAtTime(this.master.gain.value, t);
        this.master.gain.setTargetAtTime(on ? 0.0001 : MASTER_GAIN, t, on ? 0.09 : 0.4);
    }

    private enable() {
        if (!this.ctx) this.buildGraph();
        this.ctx?.resume();
        this.enabled = true;
        this.unsubscribe = subscribePlayhead(this.onFrame);
    }

    private disable() {
        this.enabled = false;
        this.unsubscribe?.();
        this.unsubscribe = null;
        this.ctx?.suspend();
    }

    private buildGraph() {
        const ctx = new AudioContext();
        this.ctx = ctx;

        this.master = ctx.createGain();
        this.master.gain.value = MASTER_GAIN;
        this.master.connect(ctx.destination);

        // 2s of white noise, looped by every consumer
        const length = ctx.sampleRate * 2;
        this.noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;

        // wind for the wipes: a band of noise, silent until the doors move
        const windFilter = ctx.createBiquadFilter();
        windFilter.type = "bandpass";
        windFilter.frequency.value = 500;
        windFilter.Q.value = 0.9;
        const windGain = ctx.createGain();
        windGain.gain.value = 0;
        this.noiseSource().connect(windFilter).connect(windGain).connect(this.master);
        this.wind = { gain: windGain, filter: windFilter };
    }

    private noiseSource(): AudioBufferSourceNode {
        const source = this.ctx!.createBufferSource();
        source.buffer = this.noiseBuffer;
        source.loop = true;
        source.start();
        return source;
    }

    private buildBed(recipe: BedRecipe): Bed {
        const ctx = this.ctx!;
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = recipe.freq;

        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.value = recipe.lfoRate;
        lfoGain.gain.value = recipe.lfoDepth;
        lfo.connect(lfoGain).connect(filter.frequency);
        lfo.start();

        const gain = ctx.createGain();
        gain.gain.value = 0;
        this.noiseSource().connect(filter).connect(gain).connect(this.master!);

        if (recipe.sub) {
            const sub = ctx.createOscillator();
            const subGain = ctx.createGain();
            sub.frequency.value = recipe.sub.freq;
            subGain.gain.value = recipe.sub.gain / recipe.gain;
            sub.connect(subGain).connect(gain);
            sub.start();
        }

        return { gain, level: recipe.gain };
    }

    /** Frames only arrive while scrolling, so anything transient must decay on its own. */
    private onFrame = (state: PlayheadState) => {
        const ctx = this.ctx;
        if (!ctx || !this.wind) return;

        while (this.beds.length < state.total) {
            this.beds.push(this.buildBed(BED_RECIPES[this.beds.length % BED_RECIPES.length]));
        }

        // equal-power crossfade between the base bed and the incoming one
        const fadeOut = Math.cos((state.wipe * Math.PI) / 2);
        const fadeIn = Math.sin((state.wipe * Math.PI) / 2);
        this.beds.forEach((bed, i) => {
            let target = 0;
            if (i === state.base) target = bed.level * fadeOut;
            else if (i === state.incoming) target = bed.level * fadeIn;
            bed.gain.gain.value = target;
        });

        // wind kicks with wipe speed, then always decays to silence
        const sameWipe = state.incoming !== -1 && state.incoming === this.last.incoming;
        if (sameWipe) {
            const kick = Math.min(0.5, Math.abs(state.wipe - this.last.wipe) * 6);
            const windGain = this.wind.gain.gain;
            const now = ctx.currentTime;
            if (kick > windGain.value) {
                windGain.cancelScheduledValues(now);
                windGain.setValueAtTime(kick, now);
                windGain.setTargetAtTime(0, now, 0.28);
            }
            this.wind.filter.frequency.value = 350 + state.wipe * 1100;
        }
        this.last = { incoming: state.incoming, wipe: state.wipe };
    };
}

export const soundEngine = new SoundEngine();
