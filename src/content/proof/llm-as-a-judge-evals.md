---
title: An LLM-as-a-Judge eval framework that tripled deployment frequency
org: Confidential
role: Head of AI
period: 2023–2024
summary: Instituted continuous automated evaluation of model outputs, replacing ad-hoc manual review as the release gate and increasing how often the team could safely ship.
metrics:
  - value: "300%"
    label: increase in model deployment frequency
    direction: up
method: Count of production model deployments per unit time, before and after the eval framework became the release gate, over comparable periods. The framework's own judgements were periodically checked against human review to confirm the gate had not drifted.
stack:
  - LLM-as-a-Judge
  - CI/CD
  - Python
principle: Harvestable by Design
featured: true
order: 5
---

Teams do not ship AI slowly because they are careless. They ship slowly because they are frightened, and they are frightened because they cannot tell whether a change made things better.

Without evals, every release is a judgement call made by whoever is most senior and most available. That person becomes the bottleneck, and — because being the person who approved the bad release is unpleasant — the rational move is always to approve fewer releases. Caution compounds into paralysis.

An eval suite moves the judgement from a person to an artifact. Once the question "is this better?" has a mechanical answer, shipping stops being an act of courage.

Three things made it hold:

**The evals were written before the improvements.** An eval authored after a change tends to encode that the change was good.

**Disagreements with human review were treated as bugs in the eval, not noise.** A judge that is quietly wrong is worse than no judge, because it launders bad releases through a process that looks rigorous.

**The suite was a shared asset, not a project artifact.** Every engagement contributed cases back to it, which is what makes it Harvestable by Design — the evals compound while the individual deliveries do not.

The 300% is a second-order effect. Nobody set out to deploy more often; they set out to stop guessing, and frequency was what fell out of it.
