# T2: REINFORCE sweep

| exp_id | setting changed | value | lr | gamma | baseline | entropy_coef | frames_per_batch | hidden | selection score | test best return | test net worth (NGN) | final entropy | invalid rate | Observed behaviour |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| reinforce_01 | none (baseline) | - | 0.001 | 0.99 | normalize | 0.01 | 450 | [128, 128] | 46.25 | 78.84 | 1,553,307 | 2.046 | 0.104 |  |
| reinforce_02 | lr | 0.0003 | 0.0003 | 0.99 | normalize | 0.01 | 450 | [128, 128] | -27.26 | -13.94 | 946,780 | 2.152 | 0.167 |  |
| reinforce_03 | lr | 0.003 | 0.003 | 0.99 | normalize | 0.01 | 450 | [128, 128] | 31.77 | 80.96 | 1,492,608 | 2.025 | 0.002 |  |
| **reinforce_04** | gamma | 0.95 | 0.001 | 0.95 | normalize | 0.01 | 450 | [128, 128] | 64.95 | 78.13 | 1,462,876 | 1.574 | 0.002 |  |
| reinforce_05 | gamma | 0.999 | 0.001 | 0.999 | normalize | 0.01 | 450 | [128, 128] | 7.23 | 41.67 | 1,253,018 | 2.129 | 0.083 |  |
| reinforce_06 | baseline | none | 0.001 | 0.99 | none | 0.01 | 450 | [128, 128] | 21.69 | 53.59 | 1,263,605 | 1.802 | 0.003 |  |
| reinforce_07 | baseline | value | 0.001 | 0.99 | value | 0.01 | 450 | [128, 128] | 61.74 | 70.81 | 1,403,637 | 1.786 | 0.012 |  |
| reinforce_08 | entropy_coef | 0.0 | 0.001 | 0.99 | normalize | 0.0 | 450 | [128, 128] | 24.58 | 53.68 | 1,334,255 | 1.912 | 0.062 |  |
| reinforce_09 | entropy_coef | 0.05 | 0.001 | 0.99 | normalize | 0.05 | 450 | [128, 128] | 35.50 | 69.23 | 1,470,387 | 2.286 | 0.145 |  |
| reinforce_10 | frames_per_batch | 90 | 0.001 | 0.99 | normalize | 0.01 | 90 | [128, 128] | 51.12 | 66.97 | 1,376,255 | 1.984 | 0.026 |  |
| reinforce_11 | frames_per_batch | 1800 | 0.001 | 0.99 | normalize | 0.01 | 1800 | [128, 128] | -5.34 | 24.42 | 1,132,541 | 2.077 | 0.075 |  |
| reinforce_12 | hidden | [64, 64] | 0.001 | 0.99 | normalize | 0.01 | 450 | [64, 64] | -55.08 | 22.79 | 1,192,431 | 1.975 | 0.224 |  |

Selection score: mean greedy val return over the last 5 evals (rule_policy on val: 92.00). Test columns: the val-selected best checkpoint of the seed 0 run, greedy, 20 test seeds. Final entropy: training policy entropy at the last eval point. The winner is in bold.
