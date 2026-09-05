import { principalSchema } from '@steer/tool-registry';

/** Display projection only. Never a session credential or authorization input. */
export const sessionViewSchema = principalSchema.pick({ subject: true, organizationId: true, hats: true, expiresAt: true });
