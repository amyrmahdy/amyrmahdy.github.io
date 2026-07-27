---
title: ELT pipelines at 99% data integrity, and 70% of manual validation removed
org: Freelance
role: Data Scientist
period: 2019–2022
summary: Apache NiFi and Airbyte ingestion pipelines with machine-learning validation models, which held data integrity at 99% while automating away the majority of manual validation hours.
metrics:
  - value: "99%"
    label: data integrity rate across ingested records
    direction: up
  - value: "70%"
    label: of manual data validation hours automated away
    direction: down
method: Integrity measured as the share of ingested records passing schema, range and referential checks at destination. The validation figure compares logged human hours spent on validation before and after the anomaly models were trusted to auto-clear clean batches.
stack:
  - Apache NiFi
  - Airbyte
  - Scikit-Learn
  - Python
principle: Architect First
order: 8
---

Three years of this work is the reason the rest of the page exists.

Nobody builds a career on ELT pipelines, and no enterprise buyer has ever been impressed by one. But every failed AI programme I have since been asked to rescue failed here — not at the model, at the boundary where data enters the system and nobody owns whether it is correct.

The pattern repeats with unusual consistency. A company invests heavily in modelling, gets disappointing results, and concludes it needs a better model. It does not. It needs to know that the field labelled `created_at` means the same thing in all four source systems, and right now it does not.

Automating validation is not a matter of writing more rules. Rules are how validation starts and how it eventually collapses, because every real dataset produces exceptions faster than anyone can encode them. Anomaly models generalise where rules cannot: they clear the overwhelming majority of clean batches automatically and escalate the genuinely strange ones to a human, which is the only part worth a human's attention.

That is the whole shape of useful automation — not replacing the judgement, but ensuring judgement is only spent where it is scarce.

Most enterprise AI programmes fail in this layer. They start at the model. The model is the last thing you choose.
