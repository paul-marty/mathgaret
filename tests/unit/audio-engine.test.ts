import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine, type BrowserAudioSession } from '../../src/audio/AudioEngine';

function audioWithContext(state: AudioContextState | 'interrupted', session?: BrowserAudioSession) {
  const audio = new AudioEngine(session);
  const context = {
    state,
    currentTime: 4,
    resume: vi.fn(async () => { context.state = 'running'; }),
    suspend: vi.fn(async () => { context.state = 'suspended'; }),
  };
  audio.ctx = context as unknown as AudioContext;
  return { audio, context };
}

afterEach(() => vi.useRealTimers());

describe('reprise du moteur audio', () => {
  it('relance un contexte interrompu par Safari au prochain geste', () => {
    const { audio, context } = audioWithContext('interrupted');
    audio.unlock();
    expect(context.resume).toHaveBeenCalledOnce();
    expect(audio.running).toBe(true);
  });

  it('retente la reprise au premier plan si le navigateur reste interrompu', async () => {
    vi.useFakeTimers();
    const { audio, context } = audioWithContext('interrupted');
    context.resume.mockRejectedValueOnce(new Error('Interruption en cours'));
    audio.resume();
    await vi.runAllTimersAsync();
    expect(context.resume).toHaveBeenCalledTimes(2);
    expect(audio.running).toBe(true);
  });

  it('ne suspend pas un contexte actif si la reprise est lente', async () => {
    vi.useFakeTimers();
    const { audio, context } = audioWithContext('running');
    audio.resume();
    await vi.runAllTimersAsync();
    expect(context.suspend).not.toHaveBeenCalled();
    expect(context.resume).toHaveBeenCalledOnce();
    expect(audio.running).toBe(true);
  });

  it('laisse jouer un contexte dont l’horloge avance normalement', async () => {
    vi.useFakeTimers();
    const { audio, context } = audioWithContext('suspended');
    audio.resume();
    context.currentTime += 0.2;
    await vi.runAllTimersAsync();
    expect(context.suspend).not.toHaveBeenCalled();
    expect(context.resume).toHaveBeenCalledOnce();
  });

  it('annule le rattrapage si le jeu repasse en arrière-plan', async () => {
    vi.useFakeTimers();
    const { audio, context } = audioWithContext('running');
    audio.resume();
    audio.pause();
    audio.unlock();
    await vi.runAllTimersAsync();
    expect(context.resume).toHaveBeenCalledOnce();
    expect(context.state).toBe('suspended');
  });

  it('rétablit la catégorie de lecture au retour même si Safari annonce déjà une lecture', async () => {
    vi.useFakeTimers();
    const session: BrowserAudioSession = { type: 'playback' };
    const { audio, context } = audioWithContext('running', session);
    audio.pause();
    expect(session.type).toBe('auto');

    context.state = 'running';
    audio.resume();
    await vi.runAllTimersAsync();
    expect(session.type).toBe('playback');
    expect(context.suspend).toHaveBeenCalledOnce();
    expect(context.resume).toHaveBeenCalledOnce();
  });
});
