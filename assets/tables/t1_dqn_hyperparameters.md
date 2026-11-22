# T1: DQN sweep

| exp_id | setting changed | value | lr | gamma | buffer_size | batch_size | eps_decay_frames | target_update | hard_update_interval | soft_tau | double_dqn | loss_function | hidden | updates_per_batch | selection score | test best return | test net worth (NGN) | final TD loss | invalid rate | Observed behaviour |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| dqn_01 | none (baseline) | - | 0.001 | 0.99 | 50000 | 64 | 20000 | hard | 500 | 0.005 | False | smooth_l1 | [128, 128] | 10 | 106.66 | 108.10 | 1,716,477 | 0.618 | 0.001 |  |
| dqn_02 | lr | 0.0003 | 0.0003 | 0.99 | 50000 | 64 | 20000 | hard | 500 | 0.005 | False | smooth_l1 | [128, 128] | 10 | 89.65 | 93.94 | 1,575,312 | 0.538 | 0.000 |  |
| dqn_03 | lr | 0.003 | 0.003 | 0.99 | 50000 | 64 | 20000 | hard | 500 | 0.005 | False | smooth_l1 | [128, 128] | 10 | 101.23 | 107.52 | 1,723,383 | 0.790 | 0.000 |  |
| dqn_04 | gamma | 0.95 | 0.001 | 0.95 | 50000 | 64 | 20000 | hard | 500 | 0.005 | False | smooth_l1 | [128, 128] | 10 | 106.07 | 109.37 | 1,731,258 | 0.317 | 0.001 |  |
| **dqn_05** | gamma | 0.999 | 0.001 | 0.999 | 50000 | 64 | 20000 | hard | 500 | 0.005 | False | smooth_l1 | [128, 128] | 10 | 114.66 | 115.42 | 1,819,970 | 1.128 | 0.032 |  |
| dqn_06 | buffer_size | 10000 | 0.001 | 0.99 | 10000 | 64 | 20000 | hard | 500 | 0.005 | False | smooth_l1 | [128, 128] | 10 | 99.54 | 107.23 | 1,715,658 | 0.695 | 0.008 |  |
| dqn_07 | batch_size | 128 | 0.001 | 0.99 | 50000 | 128 | 20000 | hard | 500 | 0.005 | False | smooth_l1 | [128, 128] | 10 | 107.57 | 110.27 | 1,750,209 | 0.509 | 0.014 |  |
| dqn_08 | eps_decay_frames | 60000 | 0.001 | 0.99 | 50000 | 64 | 60000 | hard | 500 | 0.005 | False | smooth_l1 | [128, 128] | 10 | 105.01 | 112.56 | 1,767,601 | 0.614 | 0.005 |  |
| dqn_09 | eps_decay_frames | 5000 | 0.001 | 0.99 | 50000 | 64 | 5000 | hard | 500 | 0.005 | False | smooth_l1 | [128, 128] | 10 | 108.37 | 114.81 | 1,799,106 | 0.683 | 0.012 |  |
| dqn_10 | target_update, soft_tau | soft, 0.005 | 0.001 | 0.99 | 50000 | 64 | 20000 | soft | 500 | 0.005 | False | smooth_l1 | [128, 128] | 10 | 114.51 | 116.32 | 1,821,959 | 1.173 | 0.007 |  |
| dqn_11 | target_update, hard_update_interval | hard, 100 | 0.001 | 0.99 | 50000 | 64 | 20000 | hard | 100 | 0.005 | False | smooth_l1 | [128, 128] | 10 | 96.46 | 116.57 | 1,802,039 | 1.909 | 0.002 |  |
| dqn_12 | double_dqn | True | 0.001 | 0.99 | 50000 | 64 | 20000 | hard | 500 | 0.005 | True | smooth_l1 | [128, 128] | 10 | 104.35 | 108.72 | 1,724,982 | 0.522 | 0.003 |  |
| dqn_13 | loss_function | l2 | 0.001 | 0.99 | 50000 | 64 | 20000 | hard | 500 | 0.005 | False | l2 | [128, 128] | 10 | 103.15 | 108.52 | 1,726,402 | 0.904 | 0.008 |  |
| dqn_14 | hidden | [64, 64] | 0.001 | 0.99 | 50000 | 64 | 20000 | hard | 500 | 0.005 | False | smooth_l1 | [64, 64] | 10 | 106.14 | 109.24 | 1,733,673 | 0.565 | 0.007 |  |
| dqn_15 | updates_per_batch | 2 | 0.001 | 0.99 | 50000 | 64 | 20000 | hard | 500 | 0.005 | False | smooth_l1 | [128, 128] | 2 | 86.55 | 96.59 | 1,607,470 | 0.233 | 0.002 |  |

Selection score: mean greedy val return over the last 5 evals (rule_policy on val: 92.00). Test columns: the val-selected best checkpoint of the seed 0 run, greedy, 20 test seeds. Final TD loss: mean of the last 20 logged batches. The winner is in bold.
