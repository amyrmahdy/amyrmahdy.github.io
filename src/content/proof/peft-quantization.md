---
title: Cutting monthly cloud GPU spend by 60% with PEFT and quantization
org: VASL
role: Head of AI
period: 2023–2024
summary: Applied parameter-efficient fine-tuning and aggressive model quantization to move production inference onto constrained hardware, removing the majority of a recurring cloud GPU bill without a quality regression.
metrics:
  - value: "60%"
    label: reduction in monthly cloud GPU expenditure
    direction: down
method: Comparison of consecutive monthly cloud invoices before and after migration, at equal or greater production request volume. Output quality was held constant by requiring the quantized models to pass the same eval suite as the full-precision baselines before cutover.
stack:
  - PyTorch
  - PEFT / LoRA
  - Quantization
  - Cloud GPU infrastructure
principle: Deliver First
order: 4
---

A large recurring GPU bill is usually not a hardware problem. It is an architecture decision that nobody revisited.

Teams reach for the largest model that clears the bar, ship it, and then treat the resulting monthly invoice as a fixed cost of doing AI. It is not fixed. It is the price of never having asked how much of that model the workload actually needs.

Parameter-efficient fine-tuning changes the economics of specialisation: instead of a full fine-tune per task, a small set of adapter weights rides on a shared base. Quantization then changes the economics of serving, letting models that nominally require substantial accelerators run on constrained local hardware.

The part that matters is the order of operations. **The eval suite came first.** Quantization always looks free until you measure it, and the failure mode is quiet — a model that is 3% worse in ways nobody notices for two months, at which point the regression is entangled with a dozen other changes and cannot be attributed.

By requiring the compressed models to clear the same bar as the full-precision baselines *before* cutover, the cost reduction became a decision rather than a gamble. That discipline is the Minimum Quality Floor, and it is what makes aggressive optimisation survivable rather than reckless.

A 60% cut is not frugality. It is the headroom that made a 300% increase in deployment frequency affordable.
