# T4: PPO sweep

| exp_id | setting changed | value | lr | gamma | gae_lambda | clip_epsilon | ppo_epochs | entropy_coef | frames_per_batch | minibatch_size | hidden | selection score | test best return | test net worth (NGN) | final entropy | invalid rate | Observed behaviour |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ppo_01 | none (baseline) | - | 0.0003 | 0.99 | 0.95 | 0.2 | 4 | 0.01 | 900 | 128 | [128, 128] | 88.39 | 90.59 | 1,540,155 | 1.127 | 0.000 |  |
| ppo_02 | lr | 0.0001 | 0.0001 | 0.99 | 0.95 | 0.2 | 4 | 0.01 | 900 | 128 | [128, 128] | 84.63 | 86.12 | 1,501,010 | 1.422 | 0.002 |  |
| ppo_03 | lr | 0.001 | 0.001 | 0.99 | 0.95 | 0.2 | 4 | 0.01 | 900 | 128 | [128, 128] | 117.85 | 116.68 | 1,822,038 | 1.020 | 0.023 |  |
| ppo_04 | gamma | 0.999 | 0.0003 | 0.999 | 0.95 | 0.2 | 4 | 0.01 | 900 | 128 | [128, 128] | 115.21 | 119.81 | 1,843,874 | 1.039 | 0.008 |  |
| ppo_05 | clip_epsilon | 0.1 | 0.0003 | 0.99 | 0.95 | 0.1 | 4 | 0.01 | 900 | 128 | [128, 128] | 110.58 | 110.63 | 1,745,410 | 1.262 | 0.006 |  |
| ppo_06 | clip_epsilon | 0.3 | 0.0003 | 0.99 | 0.95 | 0.3 | 4 | 0.01 | 900 | 128 | [128, 128] | 87.86 | 89.69 | 1,533,679 | 1.056 | 0.001 |  |
| ppo_07 | entropy_coef | 0.0 | 0.0003 | 0.99 | 0.95 | 0.2 | 4 | 0.0 | 900 | 128 | [128, 128] | 87.67 | 87.08 | 1,507,622 | 0.934 | 0.001 |  |
| **ppo_08** | entropy_coef | 0.05 | 0.0003 | 0.99 | 0.95 | 0.2 | 4 | 0.05 | 900 | 128 | [128, 128] | 119.17 | 119.16 | 1,838,654 | 1.716 | 0.015 |  |
| ppo_09 | ppo_epochs | 10 | 0.0003 | 0.99 | 0.95 | 0.2 | 10 | 0.01 | 900 | 128 | [128, 128] | 118.89 | 120.95 | 1,848,388 | 1.062 | 0.001 |  |
| ppo_10 | frames_per_batch | 2700 | 0.0003 | 0.99 | 0.95 | 0.2 | 4 | 0.01 | 2700 | 128 | [128, 128] | 112.62 | 118.46 | 1,822,311 | 1.377 | 0.004 |  |
| ppo_11 | gae_lambda | 0.8 | 0.0003 | 0.99 | 0.8 | 0.2 | 4 | 0.01 | 900 | 128 | [128, 128] | 88.29 | 90.30 | 1,536,981 | 1.123 | 0.001 |  |
| ppo_12 | minibatch_size | 512 | 0.0003 | 0.99 | 0.95 | 0.2 | 4 | 0.01 | 900 | 512 | [128, 128] | 83.87 | 86.34 | 1,502,540 | 1.265 | 0.001 |  |

Selection score: mean greedy val return over the last 5 evals (rule_policy on val: 92.00). Test columns: the val-selected best checkpoint of the seed 0 run, greedy, 20 test seeds. Final entropy: training policy entropy at the last eval point. The winner is in bold.
