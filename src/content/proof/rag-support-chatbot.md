---
title: A hybrid-retrieval RAG assistant that removed half the human support load
org: Confidential
role: AI Engineer
period: 2022–2023
summary: A multi-layered retrieval-augmented assistant with hybrid semantic and lexical routing, which halved inbound support tickets requiring a human and materially improved retrieval precision.
metrics:
  - value: "50%"
    label: reduction in human support tickets
    direction: down
  - value: "35%"
    label: improvement in retrieval precision
    direction: up
method: Ticket volume compared over equivalent periods before and after rollout at comparable product usage, counting only tickets that reached a human. Retrieval precision measured on a held-out set of real support queries with manually labelled relevant documents.
stack:
  - FastAPI
  - LangChain
  - MinIO
  - Hybrid semantic + lexical retrieval
principle: Deliver First
order: 6
---

Most support chatbots fail for one reason: they answer confidently from documents that do not contain the answer.

The fix is not a better model. It is better retrieval, and specifically it is refusing to pretend that one retrieval strategy fits every query.

Semantic search is excellent at *"my invoice looks wrong"* and poor at *"error PGE-4417"*. Lexical search is the exact inverse. A support corpus contains both kinds of question in roughly equal measure, so a system committed to either one is wrong about half the time in a way its own confidence scores do not reveal.

Hybrid routing sends each query down the path suited to it and merges the results, which is where the 35% precision improvement came from. The 50% ticket reduction came from something less technical: **the assistant was permitted to say it did not know.**

An assistant that escalates cleanly when retrieval is weak earns the right to answer when retrieval is strong. One that always answers trains users to distrust it within a week, after which deflection goes to zero regardless of how good the underlying model is.

The ceiling on a support assistant is not intelligence. It is calibration.
