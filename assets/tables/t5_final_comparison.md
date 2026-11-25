# T5: Final comparison on the test seeds

| policy | test return | net worth (NGN) | invalid rate | no-op rate | mean trust | lost customers per day | defaulted debt per episode (NGN) | high band share | credit-open share |
|---|---|---|---|---|---|---|---|---|---|
| DQN (dqn_05) | 114.10 ± 1.24 | 1,793,872 ± 20,417 | 0.014 ± 0.013 | 0.162 ± 0.046 | 0.612 ± 0.004 | 0.42 ± 0.17 | 94,247 ± 5,067 | 0.769 ± 0.078 | 0.865 ± 0.048 |
| REINFORCE (reinforce_04) | 76.93 ± 0.92 | 1,456,629 ± 13,437 | 0.027 ± 0.034 | 0.130 ± 0.145 | 0.328 ± 0.019 | 1.66 ± 0.88 | 0 ± 0 | 0.806 ± 0.265 | 0.000 ± 0.000 |
| A2C (a2c_03) | 91.47 ± 5.72 | 1,564,753 ± 68,874 | 0.008 ± 0.010 | 0.104 ± 0.097 | 0.391 ± 0.068 | 0.54 ± 0.20 | 0 ± 0 | 0.589 ± 0.427 | 0.000 ± 0.000 |
| PPO (ppo_08) | 114.86 ± 4.60 | 1,793,990 ± 46,134 | 0.012 ± 0.002 | 0.081 ± 0.076 | 0.562 ± 0.036 | 0.08 ± 0.03 | 68,689 ± 49,627 | 0.667 ± 0.471 | 0.625 ± 0.442 |
| rule_policy | 92.14 | 1,576,626 | 0.000 | 0.318 | 0.466 | 1.25 | 0 | 0.000 | 0.000 |
| rule_credit_policy | 92.78 | 1,635,945 | 0.000 | 0.064 | 0.714 | 4.19 | 81,299 | 0.000 | 1.000 |
| random_policy | -0.32 | 866,371 | 0.096 | 0.206 | 0.315 | 8.35 | 16,200 | 0.242 | 0.496 |

Greedy play on the 20 test seeds (1000 to 1019), default market, val-selected best checkpoints. Agents: mean ± std across the 3 training seeds of each seed's 20-episode mean. Baselines: one fixed policy.
