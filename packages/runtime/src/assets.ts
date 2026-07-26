import type { QualityTier } from "./quality.js";

export interface AssetDescriptor {
  readonly id: string;
  readonly pageByTier: Readonly<Record<QualityTier, string>>;
  readonly estimatedBytesByTier?: Partial<Record<QualityTier, number>>;
}

export interface LoadedAssetPage<Resource> {
  readonly resource: Resource;
  readonly byteLength: number;
}

export interface AssetBackend<Resource> {
  loadPage(pageId: string, tier: QualityTier): Promise<LoadedAssetPage<Resource>>;
  disposePage(resource: Resource): void;
}

export interface AssetLease<Resource> {
  readonly assetId: string;
  readonly pageId: string;
  readonly tier: QualityTier;
  readonly resource: Resource;
  release(): void;
}

export interface AssetManagerStatus {
  readonly tier: QualityTier;
  readonly registeredAssets: number;
  readonly loadedPages: number;
  readonly referencedPages: number;
  readonly estimatedBytes: number;
  readonly pendingLoads: number;
}

interface PageRecord<Resource> {
  readonly key: string;
  readonly pageId: string;
  readonly tier: QualityTier;
  readonly resource: Resource;
  refs: number;
  lastUsed: number;
  byteLength: number;
}

export class AdaptiveAssetManager<Resource> {
  readonly #backend: AssetBackend<Resource>;
  readonly #assets = new Map<string, AssetDescriptor>();
  readonly #pages = new Map<string, PageRecord<Resource>>();
  readonly #pending = new Map<string, Promise<PageRecord<Resource>>>();
  #tier: QualityTier;
  #now: () => number;

  constructor(
    backend: AssetBackend<Resource>,
    tier: QualityTier,
    now: () => number = () => performance.now()
  ) {
    this.#backend = backend;
    this.#tier = tier;
    this.#now = now;
  }

  register(descriptor: AssetDescriptor): void {
    if (this.#assets.has(descriptor.id)) {
      throw new Error(`Asset ${descriptor.id} is already registered`);
    }
    this.#assets.set(descriptor.id, descriptor);
  }

  unregister(assetId: string): boolean {
    return this.#assets.delete(assetId);
  }

  setTier(tier: QualityTier): void {
    this.#tier = tier;
  }

  async acquire(assetId: string): Promise<AssetLease<Resource>> {
    const descriptor = this.#assets.get(assetId);
    if (descriptor === undefined) {
      throw new Error(`Unknown asset ${assetId}`);
    }
    const tier = this.#tier;
    const pageId = descriptor.pageByTier[tier];
    const key = pageKey(tier, pageId);
    let record = this.#pages.get(key);
    if (record === undefined) {
      record = await this.#loadPage(key, pageId, tier);
    }
    record.refs += 1;
    record.lastUsed = this.#now();
    let released = false;
    return Object.freeze({
      assetId,
      pageId,
      tier,
      resource: record.resource,
      release: () => {
        if (released) {
          return;
        }
        released = true;
        record.refs = Math.max(0, record.refs - 1);
        record.lastUsed = this.#now();
      }
    });
  }

  evict(options: { readonly maxIdleMs: number; readonly byteBudget: number }): number {
    const now = this.#now();
    let bytes = [...this.#pages.values()].reduce(
      (total, page) => total + page.byteLength,
      0
    );
    const candidates = [...this.#pages.values()]
      .filter((page) => page.refs === 0)
      .sort((left, right) => {
        const tierPenalty = Number(left.tier === this.#tier) - Number(right.tier === this.#tier);
        return tierPenalty || left.lastUsed - right.lastUsed || left.key.localeCompare(right.key);
      });
    let evicted = 0;
    for (const page of candidates) {
      const idle = now - page.lastUsed;
      if (idle < options.maxIdleMs && bytes <= options.byteBudget) {
        continue;
      }
      this.#backend.disposePage(page.resource);
      this.#pages.delete(page.key);
      bytes -= page.byteLength;
      evicted += 1;
    }
    return evicted;
  }

  dispose(): void {
    for (const page of this.#pages.values()) {
      this.#backend.disposePage(page.resource);
    }
    this.#pages.clear();
    this.#pending.clear();
  }

  status(): AssetManagerStatus {
    const pages = [...this.#pages.values()];
    return Object.freeze({
      tier: this.#tier,
      registeredAssets: this.#assets.size,
      loadedPages: pages.length,
      referencedPages: pages.filter((page) => page.refs > 0).length,
      estimatedBytes: pages.reduce((total, page) => total + page.byteLength, 0),
      pendingLoads: this.#pending.size
    });
  }

  async #loadPage(
    key: string,
    pageId: string,
    tier: QualityTier
  ): Promise<PageRecord<Resource>> {
    const existing = this.#pending.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const promise = this.#backend.loadPage(pageId, tier).then((loaded) => {
      if (!Number.isSafeInteger(loaded.byteLength) || loaded.byteLength < 0) {
        this.#backend.disposePage(loaded.resource);
        throw new RangeError(`Asset page ${pageId} reported an invalid byte length`);
      }
      const record: PageRecord<Resource> = {
        key,
        pageId,
        tier,
        resource: loaded.resource,
        refs: 0,
        lastUsed: this.#now(),
        byteLength: loaded.byteLength
      };
      this.#pages.set(key, record);
      return record;
    });
    this.#pending.set(key, promise);
    try {
      return await promise;
    } finally {
      this.#pending.delete(key);
    }
  }
}

export class ObjectUrlRegistry {
  readonly #urls = new Map<string, { url: string; refs: number }>();

  acquire(id: string, blob: Blob): { readonly url: string; release(): void } {
    let record = this.#urls.get(id);
    if (record === undefined) {
      record = { url: URL.createObjectURL(blob), refs: 0 };
      this.#urls.set(id, record);
    }
    record.refs += 1;
    let released = false;
    return Object.freeze({
      url: record.url,
      release: () => {
        if (released) {
          return;
        }
        released = true;
        const current = this.#urls.get(id);
        if (current === undefined) {
          return;
        }
        current.refs -= 1;
        if (current.refs === 0) {
          URL.revokeObjectURL(current.url);
          this.#urls.delete(id);
        }
      }
    });
  }

  dispose(): void {
    for (const record of this.#urls.values()) {
      URL.revokeObjectURL(record.url);
    }
    this.#urls.clear();
  }
}

function pageKey(tier: QualityTier, pageId: string): string {
  return `${tier}\u0000${pageId}`;
}
