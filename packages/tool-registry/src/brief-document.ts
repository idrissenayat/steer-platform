import { briefSectionNames } from '@steer/domain/brief-document';
import { z } from 'zod';

const offset = z.number().int().min(0).max(512 * 1024);
const line = z.number().int().min(1).max(16384);
const sectionName = z.enum(briefSectionNames);
/** Structural data, not interpreted author/approval facts; renderers must escape content. */
export const briefDocumentSchema = z.strictObject({
  format: z.literal('steer-brief/read-v1'), title: z.string().min(1).max(512).nullable(),
  preamble: z.string().max(512 * 1024),
  sections: z.array(z.strictObject({ heading: z.string().max(512), knownAs: sectionName.nullable(),
    start: offset, bodyStart: offset, end: offset, line, markdown: z.string().max(512 * 1024) })).max(128),
  issues: z.array(z.strictObject({ code: z.enum(['missing-title', 'multiple-titles', 'missing-section', 'duplicate-section', 'empty-section', 'unclosed-fence']),
    section: sectionName.optional(), line: line.optional() })).max(267),
});
