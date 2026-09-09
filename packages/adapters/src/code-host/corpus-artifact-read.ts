import type { ArtifactSnapshot, CorpusRepositoryReader } from './github.ts';

// Adapter-private construction identities only. This stores no grants, caller
// decisions, bodies, branch heads or cross-request evidence. The native reader
// separately owns the exact immutable inventory proof accepted by its closure.
const ports = new WeakMap<Function, {
  inventory: Function;
  read: (inventory: unknown, path: string, revision: string) => Promise<ArtifactSnapshot>;
}>();

export function registerCorpusArtifactRead(reader: CorpusRepositoryReader,
  read: (inventory: unknown, path: string, revision: string) => Promise<ArtifactSnapshot>): void {
  ports.set(reader.readArtifact, { inventory: reader.readScopeInventory, read });
}

export function readCorpusArtifact(reader: CorpusRepositoryReader, inventory: unknown, path: string, revision: string) {
  const method = reader.readArtifact, known = ports.get(method);
  // Unknown, wrapped or replaced ports keep the ordinary independently verified
  // commit/tree/blob path. A known port must validate its own exact inventory.
  if (known && known.inventory === reader.readScopeInventory) return known.read(inventory, path, revision);
  return Reflect.apply(method, reader, [path, revision]);
}
