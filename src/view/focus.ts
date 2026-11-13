import type { Dir, InputHub, Intent, Source } from '../core/input';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Tout ce qu'on peut sélectionner avec les flèches puis activer avec OK (ou toucher). */
export interface Focusable {
  bounds(): Rect;
  isEnabled(): boolean;
  activate(): void;
  /** Réplique lue quand la sélection arrive dessus (nom du bouton : l'enfant ne lit pas). */
  label?: string;
  onFocus?(): void;
  onBlur?(): void;
}

/** Un ensemble d'éléments sélectionnables (un écran, une fenêtre au-dessus du jeu…). */
export class FocusLayer {
  items: Focusable[] = [];
  current: Focusable | null = null;
  /** Chiffres tapés au clavier (facultatif) : transmis à l'écran actif. */
  onDigit?: (digit: number) => void;
  onErase?: () => void;

  constructor(public name: string) {}

  add(...items: Focusable[]): void {
    for (const it of items) if (!this.items.includes(it)) this.items.push(it);
  }

  remove(...items: Focusable[]): void {
    this.items = this.items.filter((i) => !items.includes(i));
    if (this.current && items.includes(this.current)) this.current = null;
  }

  clear(): void {
    this.items = [];
    this.current = null;
  }

  enabledItems(): Focusable[] {
    return this.items.filter((i) => i.isEnabled());
  }
}

const center = (r: Rect) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

/** Choisit le voisin le plus proche dans la direction demandée. */
export function nearest(from: Rect, candidates: { item: Focusable; rect: Rect }[], dir: Dir): Focusable | null {
  const c = center(from);
  let best: Focusable | null = null;
  let bestScore = Infinity;
  for (const { item, rect } of candidates) {
    const d = center(rect);
    const dx = d.x - c.x;
    const dy = d.y - c.y;
    const primary = dir === 'left' ? -dx : dir === 'right' ? dx : dir === 'up' ? -dy : dy;
    const secondary = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
    if (primary <= 8) continue;
    const score = primary + secondary * 2.2;
    if (score < bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return best;
}

/**
 * Sélection au clavier, à la télécommande et à la manette. Une pile de calques :
 * seul celui du dessus reçoit les flèches (une fenêtre au-dessus masque le jeu).
 */
export class FocusManager {
  layers: FocusLayer[] = [];
  private changeListeners: ((f: Focusable | null) => void)[] = [];
  /** Sons et lecture des noms, fournis au démarrage (évite une dépendance circulaire). */
  hooks: { moved?: () => void; speak?: (label: string) => void; pressed?: () => void } = {};

  constructor(input: InputHub) {
    input.on((intent, source) => this.handle(intent, source));
  }

  get top(): FocusLayer | null {
    return this.layers[this.layers.length - 1] ?? null;
  }

  get current(): Focusable | null {
    return this.top?.current ?? null;
  }

  push(layer: FocusLayer): FocusLayer {
    this.layers = this.layers.filter((l) => l !== layer);
    this.layers.push(layer);
    this.notify();
    return layer;
  }

  pop(layer: FocusLayer): void {
    this.layers = this.layers.filter((l) => l !== layer);
    this.notify();
  }

  onChange(fn: (f: Focusable | null) => void): void {
    this.changeListeners.push(fn);
  }

  /** Place la sélection sur un élément (sans le lire si `silent`). */
  focus(item: Focusable | null, opts: { silent?: boolean } = {}): void {
    const layer = this.layerOf(item) ?? this.top;
    if (!layer || layer.current === item) return;
    layer.current?.onBlur?.();
    layer.current = item;
    item?.onFocus?.();
    if (item?.label && !opts.silent) this.hooks.speak?.(item.label);
    this.notify();
  }

  /** Toucher / cliquer : sélectionne et active. */
  press(item: Focusable): void {
    if (!item.isEnabled() || !this.isReachable(item)) return;
    this.focus(item, { silent: true });
    this.hooks.pressed?.();
    item.activate();
  }

  /** Un élément n'est actif que s'il appartient au calque du dessus. */
  isReachable(item: Focusable): boolean {
    return this.top?.items.includes(item) ?? false;
  }

  handle(intent: Intent, _source: Source): void {
    const layer = this.top;
    if (!layer) return;
    switch (intent.type) {
      case 'nav':
        this.move(layer, intent.dir);
        break;
      case 'ok': {
        const cur = layer.current && layer.current.isEnabled() ? layer.current : null;
        if (cur) {
          this.hooks.pressed?.();
          cur.activate();
        } else this.ensureFocus(layer);
        break;
      }
      case 'digit':
        layer.onDigit?.(intent.digit);
        break;
      case 'erase':
        layer.onErase?.();
        break;
      default:
        break;
    }
  }

  /** Si rien n'est sélectionné (ou plus disponible), sélectionne le premier élément actif. */
  ensureFocus(layer: FocusLayer | null = this.top, silent = true): void {
    if (!layer) return;
    if (layer.current && layer.current.isEnabled() && layer.items.includes(layer.current)) return;
    const first = layer.enabledItems()[0] ?? null;
    if (first) this.focus(first, { silent });
  }

  private move(layer: FocusLayer, dir: Dir): void {
    const cur = layer.current;
    if (!cur || !cur.isEnabled() || !layer.items.includes(cur)) {
      this.ensureFocus(layer, false);
      return;
    }
    const candidates = layer
      .enabledItems()
      .filter((i) => i !== cur)
      .map((item) => ({ item, rect: item.bounds() }));
    const next = nearest(cur.bounds(), candidates, dir);
    if (next) {
      this.focus(next);
      this.hooks.moved?.();
    }
  }

  private layerOf(item: Focusable | null): FocusLayer | null {
    if (!item) return null;
    return [...this.layers].reverse().find((l) => l.items.includes(item)) ?? null;
  }

  private notify(): void {
    for (const fn of this.changeListeners) fn(this.current);
  }
}
