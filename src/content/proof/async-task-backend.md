---
title: An async backend holding 10,000 concurrent daily tasks at 99.9% uptime
org: Confidential
role: AI Engineer
period: 2022–2023
summary: A Celery and Redis task backend that reliably absorbed upwards of ten thousand concurrent daily task requests, giving the AI services above it somewhere safe to fail.
metrics:
  - value: "10,000"
    label: concurrent daily task requests handled
    direction: up
  - value: "99.9%"
    label: uptime
    direction: up
method: Task volume and availability taken from production monitoring over sustained operation, not from a synthetic load test. Uptime counts the task backend's own availability to accept and eventually complete work.
stack:
  - Celery
  - Redis
  - Python
  - Docker
principle: Architect First
order: 7
---

This is the least glamorous system on this page and the one without which none of the others would have survived contact with production.

Model inference is slow, variable, and fails in ways HTTP was never designed to express. A request that takes forty seconds and might fail is not a request; it is a job. Teams that discover this late end up with timeouts in the user's browser, retries that duplicate work, and a support burden that has nothing to do with model quality.

Putting a real task queue underneath the AI layer changes the failure model entirely. Work is accepted, durably recorded, and completed — or retried — independently of whether anyone is still watching. A model outage becomes a delay rather than a data loss.

The 99.9% figure describes the queue, not the models above it. That distinction is the whole point: the models were often unavailable, and the system was not.

Architecture is what determines whether a bad afternoon for a model provider is an incident or a slightly slower Tuesday.
