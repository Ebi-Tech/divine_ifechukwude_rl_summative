# T7: Convergence against rule_policy

| policy | seed 0 frames | seed 1 frames | seed 2 frames | seeds that reached | mean ± std (reached seeds) |
|---|---|---|---|---|---|
| DQN (dqn_05) | 80,010 | 75,060 | 55,080 | 3/3 | 70,050 ± 10,777 |
| REINFORCE (reinforce_04) | not reached | not reached | not reached | 0/3 | not reached |
| A2C (a2c_03) | 105,030 | not reached | not reached | 1/3 | 105,030 ± 0 |
| PPO (ppo_08) | 120,600 | 125,100 | 95,400 | 3/3 | 113,700 ± 13,070 |

Frames at the first eval where the greedy val return is at least rule_policy's val return (92.00) and stays there for 3 consecutive evals (evals every 5,000 frames).
