---
title: Natural-language query over multi-gigabyte files, for people who do not write SQL
codename: Oasis
org: Smartway Solutions
role: Chief Technology Officer & AI Consultant
period: 2025–present
summary: A cost-cutting engine that let Sales, Marketing and Operations interrogate multi-gigabyte data files in plain language, bypassing the business-intelligence queue entirely.
metrics:
  - value: "10x"
    label: compression of end-to-end processing and documentation time
    direction: down
  - value: "0"
    label: BI tickets required to answer a routine data question
    direction: down
method: >-
  Processing and documentation time measured on the client's own recurring reporting cycle, wall-clock, before and after — from raw file received to signed-off written output. The BI figure is structural rather than measured: the queue is not shortened, it is removed from the path.
stack:
  - Python
  - LLM tool-calling
  - DuckDB
  - FastAPI
principle: Deliver First
featured: true
order: 2
---

The bottleneck in most enterprise reporting is not analysis. It is the queue.

A commercial manager has a question that would take ninety seconds to answer if she could write SQL. She cannot, so she files a request. The request waits behind eleven others. Four days later she receives a spreadsheet that answers the question she asked, not the one she meant, and the cycle begins again.

Oasis removes the queue rather than shortening it. Non-technical staff query multi-gigabyte files directly, in their own language, and get an answer while the question is still relevant.

Two design decisions did most of the work.

**The model never sees the data.** It writes a query; an execution layer runs it. This keeps commercially sensitive records out of any model context, makes every answer reproducible from a query string that can be inspected and re-run, and means the system's accuracy is bounded by query correctness rather than recall — a far more tractable problem.

**Every answer ships with its query.** The user sees the question they asked, the query it became, and the result. When an answer is wrong, it is legible why it is wrong. An opaque wrong answer destroys trust in a tool permanently; a transparent one gets corrected and increases it.

The follow-on system was a custom LLM-driven documentation pipeline over the same substrate, which compressed a reporting cycle that had been measured in days.
