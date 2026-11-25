"""Test how the val-selected agents and the baselines generalise to the harsh, slow_market and credit_culture markets.

Run:  uv run python -m analysis.generalization

For each algorithm, the best checkpoint (chosen on validation) of each of its 3 seed runs is
evaluated greedily on TEST_SEEDS in every market, next to the three baseline policies.
Results go to logs/generalization.csv, and a mean and std across seeds is printed.
"""
from pathlib import Path

import numpy as np

from analysis.select_best import ALGOS, SELECTION_PATH, winners
from environment.baselines import random_policy, rule_credit_policy, rule_policy
from training.common import TEST_SEEDS, evaluate_policy, greedy_fn_from_module, load_checkpoint, read_rows, write_rows
from training.dqn_training import build_value_net
from training.pg_training import build_logits_net

OUTPUT_PATH = Path("logs/generalization.csv")
MARKETS = ("default", "harsh", "slow_market", "credit_culture")
SEED_COPIES = (0, 1, 2)
BASELINES = {"rule_policy": rule_policy, "rule_credit_policy": rule_credit_policy, "random_policy": random_policy}
COLUMNS = (
    "policy", "exp_id", "seed", "market", "return_mean", "return_std", "net_worth_mean", "invalid_rate",
    "noop_rate", "trust", "lost_per_day", "bankruptcies",
)


def run_id(exp_id, seed):
    """Return the run id of one seed copy: the sweep id for seed 0, else the id suffixed _s<seed>."""
    return exp_id if seed == 0 else f"{exp_id}_s{seed}"


def best_checkpoint_path(algo, run):
    """Return the val-selected best checkpoint file of one run."""
    folder = Path("models") / ("dqn" if algo == "dqn" else f"pg/{algo}")
    return folder / f"{run}_best.pt"


def checkpoint_policy(algo, path):
    """Load a best checkpoint and return its greedy policy_fn."""
    if algo == "dqn":
        module, _ = load_checkpoint(path, build_value_net)
        return greedy_fn_from_module(module, "q")
    module, _ = load_checkpoint(path, build_logits_net)
    return greedy_fn_from_module(module, "logits")


def result_row(policy, exp_id, seed, market, result):
    """Turn one evaluate_policy result into a generalization.csv row."""
    return {
        "policy": policy, "exp_id": exp_id, "seed": seed, "market": market,
        "return_mean": result["return_mean"], "return_std": result["return_std"],
        "net_worth_mean": result["final_net_worth_mean"], "invalid_rate": result["invalid_rate_mean"],
        "noop_rate": result["noop_rate_mean"], "trust": result["trust_mean"],
        "lost_per_day": result["lost_per_day_mean"], "bankruptcies": result["bankruptcies"],
    }


def evaluate_agents(selected):
    """Evaluate every seed run of every selected algorithm in every market."""
    rows = []
    for algo in ALGOS:
        for seed in SEED_COPIES:
            run = run_id(selected[algo], seed)
            policy_fn = checkpoint_policy(algo, best_checkpoint_path(algo, run))
            for market in MARKETS:
                rows.append(result_row(algo, run, seed, market, evaluate_policy(policy_fn, market, TEST_SEEDS)))
            print(f"evaluated {run}", flush=True)
    return rows


def evaluate_baselines():
    """Evaluate the three baseline policies in every market."""
    return [result_row(name, "", "", market, evaluate_policy(policy_fn, market, TEST_SEEDS))
            for name, policy_fn in BASELINES.items() for market in MARKETS]


def print_table(rows):
    """Print return and net worth per policy and market, as mean and std across seeds for the agents."""
    print(f"\n{'policy':<20}" + "".join(f"{market + ' return':>22}{'net worth':>12}" for market in MARKETS))
    for policy in list(ALGOS) + list(BASELINES):
        line = f"{policy:<20}"
        for market in MARKETS:
            picked = [row for row in rows if row["policy"] == policy and row["market"] == market]
            returns = np.array([row["return_mean"] for row in picked])
            worth = np.mean([row["net_worth_mean"] for row in picked])
            text = f"{returns.mean():.2f} +- {returns.std():.2f}" if len(picked) > 1 else f"{returns.mean():.2f}"
            line += f"{text:>22}{worth:>12,.0f}"
        print(line)
    print("Agents: mean +- std across 3 training seeds of the mean test return; baselines: one policy.")


def main():
    """Evaluate the selected agents and the baselines in all markets and write logs/generalization.csv."""
    selection, _ = read_rows(SELECTION_PATH)
    selected = winners(selection)
    rows = evaluate_agents(selected) + evaluate_baselines()
    write_rows(OUTPUT_PATH, list(COLUMNS), rows)
    print_table(rows)
    print(f"\nwrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
