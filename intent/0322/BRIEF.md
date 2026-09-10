# 0322 — Owned current assessment during final save review

Consolidate repeated current assessment reads inside each read-only final review.
Reuse the existing exact-construction scope projection, keeping its native
records/key lease open through dependent validation and closing it before the
outer source/draft freshness checks. Ordinary and wrapped readers keep their
full path. Each preview and each side of persistence still owns a separate phase.

Base: `d5871cb6a1f8ec6a693fb91e569f17d7e6460ccb`. Partial C22 only. No model
spend, real runtime GitHub save, activation, deployment or signature. Progress
remains 68% (17/25) until a complete acceptance checkpoint is verified.
