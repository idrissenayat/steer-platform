# Specification

1. Workflow input is exactly organization ID, operation UUID and input digest.
   Workflow identity excludes the input digest so revision drift cannot create
   another execution for the same operation. The trusted client rejects both
   concurrent starts and duplicate closed identities; it adds no workflow retry.
2. `developIntent` invokes Architect first and invokes Test Agent only after an
   exact validated `succeeded` result. Clarification, supersession, uncertainty or
   busy state ends this attempt. No conversational continuation or retry signal
   is accepted by this workflow; revised input needs a separately authorized,
   linked operation, not workflow reset or a fresh identity for the old input.
3. Each role activity has one attempt, a two-minute execution limit, three-minute
   overall scheduling limit and ten-second heartbeat timeout. Worker heartbeats
   contain no payload. Cancellation propagates and awaits activity acknowledgement;
   the adapter stops admission and aborts the runtime. Late dependent work cannot
   publish success. Cancellation does not guarantee a provider never received work.
4. The activity binds one trusted runtime and exact target. Foreign target/role,
   overlap, invalid cancellation and closed admission deny before runtime access.
   The runtime remains responsible for actual current records/source/model/budget
   checks and dispatch/checkpoint uniqueness. The caller owns binding that runtime
   to the same target and closing its model, pools and connection.
5. Activity results and workflow query/results contain only fixed status labels,
   role, operation/input reference, result UUID/digest and false authority flags.
   Brief, Spec, Exam, source, questions, model prompts, credentials and grant bodies
   stay outside history. Errors are sanitized. Input validation cannot prevent an
   arbitrary direct Temporal client from submitting its own private history input;
   production cluster access and API authorization remain required.
6. `developmentProgress` describes the workflow's recorded point-in-time progress,
   not current access rights or proof the source is still latest. The future API
   must reauthorize and read actual SQL records before exposing private output.
7. Dedicated worker construction is explicit and uninstalled. No API registration,
   real migration, service startup, runtime GitHub save, new dependency or paid call.
   Existing workflows retain their behavior. Failed activity acknowledgement or
   worker death is not automatically retried; authorized reconciliation remains
   distinct from SQL checkpoint reuse and deterministic history replay.
