import {createScopeReviewObservationStore} from './scope-review-observations.ts';
import {scopeCheckpointReferenceSchema,type ScopeCheckpointReference} from './scope-review-operations.ts';
import {scopeOriginalHash as hash} from './scope-original-contracts.ts';
import {DraftStorageError} from './draft-envelope.ts';

/** Trusted disabled composition. The mandatory observation verifier still must
 * be the pinned SDK codec, and records/source/key authority must be real before
 * activation. This callback neither sends a model request nor grants clearance. */
export function createScopeReviewCheckpointVerifier(
  pools:Parameters<typeof createScopeReviewObservationStore>[0],
  configuration:Parameters<typeof createScopeReviewObservationStore>[1],
  dependencies:Parameters<typeof createScopeReviewObservationStore>[2],
):(reference:Readonly<ScopeCheckpointReference>)=>Promise<void>{
  return async raw=>{
    const store=createScopeReviewObservationStore(pools,configuration,dependencies);
    try{
      const reference=scopeCheckpointReferenceSchema.parse(raw);
      const saved=await store.read({reviewId:reference.binding.operationId,preparationDigest:reference.preparationDigest,
        batchId:reference.binding.stepId,stage:'response'});
      if(saved.observation.stage!=='response'||saved.requiresOutcomeResolution||!saved.checkpoint
        ||saved.payloadDigest!==reference.resultDigest||hash(saved.checkpoint)!==hash(reference))throw new DraftStorageError();
    }catch{throw new DraftStorageError();}finally{store.close();}
  };
}
