# T6: Generalization over four markets

| policy | default return | default net worth (NGN) | harsh return | harsh net worth (NGN) | slow_market return | slow_market net worth (NGN) | credit_culture return | credit_culture net worth (NGN) |
|---|---|---|---|---|---|---|---|---|
| DQN (dqn_05) | 114.10 ± 1.24 | 1,793,872 | 85.77 ± 0.94 | 1,505,889 | 75.80 ± 1.07 | 1,407,699 | 98.22 ± 4.81 | 1,636,761 |
| REINFORCE (reinforce_04) | 76.93 ± 0.92 | 1,456,629 | 62.97 ± 6.36 | 1,318,801 | 53.38 ± 8.20 | 1,231,815 | 58.11 ± 6.07 | 1,281,280 |
| A2C (a2c_03) | 91.47 ± 5.72 | 1,564,753 | 72.77 ± 2.38 | 1,397,672 | 57.97 ± 4.09 | 1,275,475 | 61.80 ± 5.88 | 1,311,362 |
| PPO (ppo_08) | 114.86 ± 4.60 | 1,793,990 | 86.89 ± 1.90 | 1,516,649 | 74.62 ± 4.19 | 1,395,646 | 92.28 ± 14.44 | 1,590,659 |
| rule_policy | 92.14 | 1,576,626 | 77.72 | 1,419,131 | 69.18 | 1,330,797 | 68.53 | 1,326,912 |
| rule_credit_policy | 92.78 | 1,635,945 | 82.31 | 1,492,803 | 78.63 | 1,441,208 | 65.29 | 1,394,599 |
| random_policy | -0.32 | 866,371 | -2.58 | 814,713 | -3.98 | 797,285 | -8.77 | 782,342 |

From logs/generalization.csv: greedy val-selected best checkpoints on the 20 test seeds of each market. slow_market: customer arrivals x0.7. credit_culture: credit-asking share 0.40 and default probability x1.5. Agents: mean ± std across 3 training seeds; baselines: one fixed policy.
