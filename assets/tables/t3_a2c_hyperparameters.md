# T3: A2C sweep

| exp_id | setting changed | value | lr | gamma | gae_lambda | entropy_coef | critic_coef | frames_per_batch | normalize_advantage | loss_critic_type | hidden | selection score | test best return | test net worth (NGN) | final entropy | invalid rate | Observed behaviour |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| a2c_01 | none (baseline) | - | 0.0007 | 0.99 | 1.0 | 0.01 | 0.5 | 90 | False | smooth_l1 | [128, 128] | 87.00 | 98.38 | 1,650,771 | 1.217 | 0.021 |  |
| a2c_02 | lr | 0.0002 | 0.0002 | 0.99 | 1.0 | 0.01 | 0.5 | 90 | False | smooth_l1 | [128, 128] | 25.90 | 38.00 | 1,139,904 | 2.039 | 0.003 |  |
| **a2c_03** | lr | 0.002 | 0.002 | 0.99 | 1.0 | 0.01 | 0.5 | 90 | False | smooth_l1 | [128, 128] | 100.69 | 99.41 | 1,660,410 | 0.500 | 0.022 |  |
| a2c_04 | gamma | 0.999 | 0.0007 | 0.999 | 1.0 | 0.01 | 0.5 | 90 | False | smooth_l1 | [128, 128] | 62.21 | 72.10 | 1,472,724 | 1.425 | 0.059 |  |
| a2c_05 | gae_lambda | 0.95 | 0.0007 | 0.99 | 0.95 | 0.01 | 0.5 | 90 | False | smooth_l1 | [128, 128] | 87.33 | 90.16 | 1,537,910 | 1.041 | 0.002 |  |
| a2c_06 | gae_lambda | 0.0 | 0.0007 | 0.99 | 0.0 | 0.01 | 0.5 | 90 | False | smooth_l1 | [128, 128] | 78.97 | 82.70 | 1,498,532 | 1.440 | 0.040 |  |
| a2c_07 | entropy_coef | 0.0 | 0.0007 | 0.99 | 1.0 | 0.0 | 0.5 | 90 | False | smooth_l1 | [128, 128] | 51.83 | 85.23 | 1,500,076 | 1.372 | 0.007 |  |
| a2c_08 | entropy_coef | 0.05 | 0.0007 | 0.99 | 1.0 | 0.05 | 0.5 | 90 | False | smooth_l1 | [128, 128] | 86.93 | 88.48 | 1,519,279 | 1.384 | 0.001 |  |
| a2c_09 | critic_coef | 1.0 | 0.0007 | 0.99 | 1.0 | 0.01 | 1.0 | 90 | False | smooth_l1 | [128, 128] | 83.23 | 90.93 | 1,602,333 | 1.489 | 0.046 |  |
| a2c_10 | frames_per_batch | 450 | 0.0007 | 0.99 | 1.0 | 0.01 | 0.5 | 450 | False | smooth_l1 | [128, 128] | 37.19 | 49.84 | 1,301,288 | 2.085 | 0.052 |  |
| a2c_11 | normalize_advantage | True | 0.0007 | 0.99 | 1.0 | 0.01 | 0.5 | 90 | True | smooth_l1 | [128, 128] | 80.05 | 87.37 | 1,518,513 | 1.456 | 0.012 |  |
| a2c_12 | loss_critic_type | l2 | 0.0007 | 0.99 | 1.0 | 0.01 | 0.5 | 90 | False | l2 | [128, 128] | 55.84 | 100.52 | 1,661,272 | 1.244 | 0.013 |  |

Selection score: mean greedy val return over the last 5 evals (rule_policy on val: 92.00). Test columns: the val-selected best checkpoint of the seed 0 run, greedy, 20 test seeds. Final entropy: training policy entropy at the last eval point. The winner is in bold.
