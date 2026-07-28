---
title: A six-step multi-agent pipeline that classified soil 85% faster than the manual process
org: Confidential
role: Head of AI
period: 2023–2024
summary: Fully automated USCS geotechnical soil classification from raw borehole data using a six-step multi-agent pipeline with MCP-based tool integration, replacing a slow and inconsistent manual reading process.
metrics:
  - value: "85%"
    label: reduction in processing time per borehole log
    direction: down
method: Wall-clock time from raw borehole log received to a signed classification, sampled across the same log set processed manually and by the pipeline. Correctness was gated against expert-classified ground truth before the time figure was accepted as meaningful.
stack:
  - Multi-agent orchestration
  - MCP
  - Python
  - FastAPI
principle: Architect First
order: 3
---

Geotechnical soil classification under the Unified Soil Classification System is exactly the kind of work that looks like it should already be automated and is not. It is rule-governed but not simple: a borehole log arrives as semi-structured field data, and reaching a classification means applying a decision procedure with branches, thresholds, and judgement calls about ambiguous samples.

The naive approach — hand the whole log to a large model and ask for a classification — fails in a specific and instructive way. It is right most of the time, wrong occasionally, and gives no signal about which is which. In geotechnical work, a confidently wrong classification is worse than no classification, because something gets built on it.

The pipeline breaks the procedure into six discrete steps, each with one responsibility and a checkable output. Extraction is separated from normalisation, normalisation from threshold evaluation, threshold evaluation from classification, and classification from justification. MCP-based tool integration gives each step deterministic access to the calculations it needs rather than asking a model to do arithmetic.

The result is that when the pipeline is wrong, it is wrong at an identifiable step, and that step can be fixed. Speed was the headline, but auditability was the reason it was allowed into production.

This is the shape of most useful agentic work: not one model doing a whole job, but a decomposition where every boundary is a place you can put a test.
