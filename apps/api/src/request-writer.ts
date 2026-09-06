import type { ManagedBriefWriter, ToolServices } from '@steer/tool-registry';
import type { VerifiedIdentityContext } from '@steer/adapters/identity';

/** Trusted composition only. No request body, role header or gate claim is accepted. */
export type SessionBriefWriterFactory = (authenticate: () => Promise<VerifiedIdentityContext | null>) => ManagedBriefWriter;
export type RequestBriefWriterFactory = (request: Request) => ManagedBriefWriter;

export function requestWriterServices(services: ToolServices | undefined, factory: RequestBriefWriterFactory | undefined, request: Request): ToolServices | undefined {
  if (factory === undefined) return services;
  // Reject ambiguous authority composition instead of choosing an injected fallback.
  if (typeof factory !== 'function' || services?.briefWriter || services?.briefWriterFactory) throw new Error('Invalid request writer composition.');
  return { ...services, briefWriterFactory: () => factory(request) };
}
