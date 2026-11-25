"""Write every report table as CSV and markdown into assets/tables/, from the existing logs and checkpoints.

Run:  uv run python -m analysis.make_tables

T1 to T4 list every sweep experiment of one algorithm with its hyperparameters and results, T5 compares
the winners with the baselines on the test seeds, T6 is generalization over the four markets, and T7 is
convergence against the rule_policy val level. Behaviour numbers reuse the cached test-seed evaluation of
analysis.make_figures (logs/behaviour.csv), so figures and tables always agree.
"""
import csv
from pathlib import Path

import numpy as np

from analysis.make_figures import (
    BASELINES, MARKETS, column, convergence_rows, convergence_summary, behaviour_rows, generalization_stats, number,
    read_log, rule_val_level, selected,
)
from analysis.select_best import ALGOS, selection_score
from training.common import read_rows
from training.experiments import EXPERIMENTS

TABLE_DIR = Path("assets/tables")
SUMMARY_PATH = Path("logs/summary.csv")
FINAL_LOSS_BATCHES = 20
HYPERPARAMETERS = {
    "dqn": ("lr", "gamma", "buffer_size", "batch_size", "eps_decay_frames", "target_update", "hard_update_interval",
            "soft_tau", "double_dqn", "loss_function", "hidden", "updates_per_batch"),
    "reinforce": ("lr", "gamma", "baseline", "entropy_coef", "frames_per_batch", "hidden"),
    "a2c": ("lr", "gamma", "gae_lambda", "entropy_coef", "critic_coef", "frames_per_batch", "normalize_advantage",
            "loss_critic_type", "hidden"),
    "ppo": ("lr", "gamma", "gae_lambda", "clip_epsilon", "ppo_epochs", "entropy_coef", "frames_per_batch",
            "minibatch_size", "hidden"),
}
T5_METRICS = (
    ("return", "test return", 2), ("net_worth", "net worth (NGN)", 0), ("invalid_rate", "invalid rate", 3),
    ("noop_rate", "no-op rate", 3), ("trust", "mean trust", 3), ("lost_per_day", "lost customers per day", 2),
    ("defaults", "defaulted debt per episode (NGN)", 0), ("high_share", "high band share", 3),
    ("credit_open_share", "credit-open share", 3),
)


def fmt(value, digits=2):
    """Format a number for a markdown cell, with thousands separators for big values and a dash when missing."""
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return "-"
    if isinstance(value, str):
        return value
    return f"{value:,.0f}" if digits == 0 else f"{value:.{digits}f}"


def pm(mean, std, digits=2):
    """Format a mean and standard deviation as one markdown cell."""
    return f"{fmt(mean, digits)} ± {fmt(std, digits)}"


def write_table(name, title, header, csv_rows, markdown_rows, note=""):
    """Write one table as assets/tables/<name>.csv (raw numbers) and <name>.md (formatted, with a title and note)."""
    TABLE_DIR.mkdir(parents=True, exist_ok=True)
    with open(TABLE_DIR / f"{name}.csv", "w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(csv_rows[0]))
        writer.writeheader()
        writer.writerows(csv_rows)
    lines = [f"# {title}", "", "| " + " | ".join(header) + " |", "|" + "---|" * len(header)]
    lines += ["| " + " | ".join(str(cell) for cell in row) + " |" for row in markdown_rows]
    if note:
        lines += ["", note]
    (TABLE_DIR / f"{name}.md").write_text("\n".join(lines) + "\n")
    print(f"wrote {TABLE_DIR / name}.csv and .md")


def summary_by_run():
    """Return logs/summary.csv rows keyed by exp_id."""
    rows, _ = read_rows(SUMMARY_PATH)
    return {row["exp_id"]: row for row in rows}


def final_training_signal(algo, exp_id):
    """Return the final TD loss (DQN, mean of the last batches) or the final policy entropy (PG, last eval point)."""
    if algo == "dqn":
        losses = column(read_log(algo, exp_id, "train"), "mean_loss")
        return float(np.nanmean(losses[~np.isnan(losses)][-FINAL_LOSS_BATCHES:]))
    return float(column(read_log(algo, exp_id, "eval"), "train_entropy")[-1])


def optional(row, key):
    """Read a summary value as a float, or None when the cell is empty."""
    value = row.get(key, "")
    return float(value) if value not in ("", None) else None


def hyperparameter_table(algo, summary, number_in_series):
    """T1 to T4: every sweep experiment of one algorithm with its changed setting, hyperparameters and results."""
    keys = HYPERPARAMETERS[algo]
    signal = "final TD loss" if algo == "dqn" else "final entropy"
    csv_rows, markdown_rows = [], []
    for experiment in EXPERIMENTS[algo]:
        exp_id = experiment["exp_id"]
        row = summary[exp_id]
        changed = ", ".join(experiment["overrides"]) or "none (baseline)"
        value = ", ".join(str(item) for item in experiment["overrides"].values()) or "-"
        results = {
            "selection_score": selection_score(algo, exp_id), "test_best_return": optional(row, "test_best_return_mean"),
            "test_net_worth": optional(row, "test_best_net_worth_mean"), signal.replace(" ", "_"): final_training_signal(algo, exp_id),
            "test_invalid_rate": optional(row, "test_best_invalid_rate_mean"),
        }
        winner = exp_id == selected()[algo]
        csv_rows.append({"exp_id": exp_id, "winner": "yes" if winner else "", "setting_changed": changed, "value": value,
                         **{key: row.get(key, "") for key in keys}, **results, "observed_behaviour": ""})
        markdown_rows.append([f"**{exp_id}**" if winner else exp_id, changed, value, *[row.get(key, "") for key in keys],
                              fmt(results["selection_score"]), fmt(results["test_best_return"]), fmt(results["test_net_worth"], 0),
                              fmt(results[signal.replace(" ", "_")], 3), fmt(results["test_invalid_rate"], 3), ""])
    header = ["exp_id", "setting changed", "value", *keys, "selection score", "test best return", "test net worth (NGN)",
              signal, "invalid rate", "Observed behaviour"]
    note = (f"Selection score: mean greedy val return over the last 5 evals (rule_policy on val: {rule_val_level():.2f}). "
            "Test columns: the val-selected best checkpoint of the seed 0 run, greedy, 20 test seeds. "
            f"{'Final TD loss: mean of the last 20 logged batches.' if algo == 'dqn' else 'Final entropy: training policy entropy at the last eval point.'} "
            "The winner is in bold.")
    write_table(f"t{number_in_series}_{algo}_hyperparameters", f"T{number_in_series}: {algo.upper()} sweep", header,
                csv_rows, markdown_rows, note)


def comparison_table():
    """T5: winners (mean and std over 3 seeds) and baselines on the 20 test seeds of the default market."""
    rows = behaviour_rows()
    csv_rows, markdown_rows = [], []
    for algo in ALGOS:
        picked = [row for row in rows if row["group"] == "winner" and row["policy"] == algo]
        values = {key: [number(row, key) for row in picked] for key, _, _ in T5_METRICS}
        csv_rows.append({"policy": algo, "exp_id": selected()[algo], "seeds": len(picked),
                         **{f"{key}_{part}": float(getattr(np, part)(values[key])) for key, _, _ in T5_METRICS for part in ("mean", "std")}})
        markdown_rows.append([f"{algo.upper()} ({selected()[algo]})",
                              *[pm(np.mean(values[key]), np.std(values[key]), digits) for key, _, digits in T5_METRICS]])
    for name in BASELINES:
        row = next(item for item in rows if item["policy"] == name)
        csv_rows.append({"policy": name, "exp_id": "", "seeds": 1,
                         **{f"{key}_{part}": (number(row, key) if part == "mean" else 0.0) for key, _, _ in T5_METRICS for part in ("mean", "std")}})
        markdown_rows.append([name, *[fmt(number(row, key), digits) for key, _, digits in T5_METRICS]])
    header = ["policy", *[label for _, label, _ in T5_METRICS]]
    note = ("Greedy play on the 20 test seeds (1000 to 1019), default market, val-selected best checkpoints. "
            "Agents: mean ± std across the 3 training seeds of each seed's 20-episode mean. Baselines: one fixed policy.")
    write_table("t5_final_comparison", "T5: Final comparison on the test seeds", header, csv_rows, markdown_rows, note)


def generalization_table():
    """T6: test return and net worth of every policy in the four markets."""
    stats = generalization_stats()
    csv_rows, markdown_rows = [], []
    for policy in list(ALGOS) + list(BASELINES):
        csv_row = {"policy": policy, "exp_id": selected().get(policy, "")}
        cells = [f"{policy.upper()} ({selected()[policy]})" if policy in ALGOS else policy]
        for market in MARKETS:
            mean, std, worth, count = stats[policy, market]
            csv_row.update({f"{market}_return_mean": mean, f"{market}_return_std": std, f"{market}_net_worth_mean": worth})
            cells.append(pm(mean, std) if count > 1 else fmt(mean))
            cells.append(fmt(worth, 0))
        csv_rows.append(csv_row)
        markdown_rows.append(cells)
    header = ["policy"] + [label for market in MARKETS for label in (f"{market} return", f"{market} net worth (NGN)")]
    note = ("From logs/generalization.csv: greedy val-selected best checkpoints on the 20 test seeds of each market. "
            "slow_market: customer arrivals x0.7. credit_culture: credit-asking share 0.40 and default probability x1.5. "
            "Agents: mean ± std across 3 training seeds; baselines: one fixed policy.")
    write_table("t6_generalization", "T6: Generalization over four markets", header, csv_rows, markdown_rows, note)


def convergence_table():
    """T7: frames each winner seed needed to reach the rule_policy val level and stay above it for 3 evals."""
    rows = convergence_rows()
    summary = convergence_summary(rows)
    csv_rows, markdown_rows = [], []
    for algo in ALGOS:
        seeds = [row["frames"] for row in rows if row["algo"] == algo]
        item = summary[algo]
        csv_rows.append({"policy": algo, "exp_id": selected()[algo], "rule_val_level": rule_val_level(),
                         **{f"seed{index}_frames": frames if frames is not None else "" for index, frames in enumerate(seeds)},
                         "reached": item["reached"], "frames_mean": item["mean"] if item["mean"] is not None else "",
                         "frames_std": item["std"] if item["std"] is not None else ""})
        markdown_rows.append([f"{algo.upper()} ({selected()[algo]})",
                              *[fmt(frames, 0) if frames is not None else "not reached" for frames in seeds],
                              f"{item['reached']}/3", pm(item["mean"], item["std"], 0) if item["mean"] is not None else "not reached"])
    header = ["policy", "seed 0 frames", "seed 1 frames", "seed 2 frames", "seeds that reached", "mean ± std (reached seeds)"]
    note = (f"Frames at the first eval where the greedy val return is at least rule_policy's val return "
            f"({rule_val_level():.2f}) and stays there for 3 consecutive evals (evals every 5,000 frames).")
    write_table("t7_convergence", "T7: Convergence against rule_policy", header, csv_rows, markdown_rows, note)


def main():
    """Write all report tables."""
    summary = summary_by_run()
    for index, algo in enumerate(ALGOS, start=1):
        hyperparameter_table(algo, summary, index)
    comparison_table()
    generalization_table()
    convergence_table()


if __name__ == "__main__":
    main()
