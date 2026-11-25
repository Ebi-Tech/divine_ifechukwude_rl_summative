"""Draw every report figure from the existing training logs and saved checkpoints, into assets/figures/.

Run:  uv run python -m analysis.make_figures

Nothing is retrained. Learning curves, losses and entropies come from logs/<algo>/*_eval.csv and
*_train.csv; the behaviour figures play the saved val-selected checkpoints greedily on the test seeds
(cached in logs/behaviour.csv); generalization comes from logs/generalization.csv.
"""
from functools import lru_cache
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter
import numpy as np

from analysis.generalization import best_checkpoint_path, checkpoint_policy, run_id
from analysis.select_best import ALGOS, SELECTION_PATH, selection_score, winners
from environment.baselines import random_policy, rule_credit_policy, rule_policy
from environment.custom_env import ACTION_NAMES, BAND_NAMES, ShopEnv
from training.common import TEST_SEEDS, VAL_SEEDS, evaluate_policy, read_rows, write_rows
from training.experiments import EXPERIMENTS

LOG_DIR = Path("logs")
FIG_DIR = Path("assets/figures")
BEHAVIOUR_PATH = LOG_DIR / "behaviour.csv"
GENERALIZATION_PATH = LOG_DIR / "generalization.csv"
DPI = 200
SEED_COPIES = (0, 1, 2)
STAY_EVALS = 3
SMOOTH_BINS = 60
PG_ALGOS = ("reinforce", "a2c", "ppo")
MARKETS = ("default", "harsh", "slow_market", "credit_culture")
HIGH_BAND = BAND_NAMES.index("high")
MAX_ENTROPY = float(np.log(len(ACTION_NAMES)))
COLORS = {"dqn": "#D55E00", "reinforce": "#E69F00", "a2c": "#009E73", "ppo": "#7E57C2",
          "rule_policy": "#6E6E6E", "rule_credit_policy": "#A8A8A8", "random_policy": "#C8C8C8"}
LABELS = {"dqn": "DQN", "reinforce": "REINFORCE", "a2c": "A2C", "ppo": "PPO", "rule_policy": "rule_policy",
          "rule_credit_policy": "rule_credit_policy", "random_policy": "random_policy"}
BASELINES = {"rule_policy": rule_policy, "rule_credit_policy": rule_credit_policy, "random_policy": random_policy}
VARIANT_STYLES = ("-", "--", ":")
BEHAVIOUR_METRICS = ("return", "net_worth", "invalid_rate", "noop_rate", "trust", "lost_per_day", "defaults",
                     "high_share", "credit_open_share")


def run_ids(exp_id):
    """Return the three seed runs of an experiment: the sweep run and its _s1 and _s2 copies."""
    return [run_id(exp_id, seed) for seed in SEED_COPIES]


@lru_cache(maxsize=1)
def selected():
    """Return the val-selected winning exp_id of each algorithm."""
    rows, _ = read_rows(SELECTION_PATH)
    return winners(rows)


def column(rows, key):
    """Return one CSV column as floats, with NaN for empty cells."""
    return np.array([float(row[key]) if row.get(key, "") not in ("", None) else np.nan for row in rows])


def read_log(algo, run, kind):
    """Read a run's eval or train CSV as a list of dict rows."""
    rows, _ = read_rows(LOG_DIR / algo / f"{run}_{kind}.csv")
    return rows


@lru_cache(maxsize=1)
def rule_val_level():
    """Return rule_policy's mean greedy return on the validation seeds, the bar every learning curve is held to."""
    return evaluate_policy(rule_policy, "default", VAL_SEEDS)["return_mean"]


def binned(frames, values, edges):
    """Average values into frame bins, so noisy per-batch logs become readable curves."""
    keep = ~np.isnan(values)
    sums = np.histogram(frames[keep], edges, weights=values[keep])[0]
    counts = np.histogram(frames[keep], edges)[0]
    with np.errstate(invalid="ignore"):
        return sums / counts


def seed_band(curves):
    """Return the mean, minimum and maximum across seed curves sampled on the same grid."""
    stack = np.vstack(curves)
    return np.nanmean(stack, axis=0), np.nanmin(stack, axis=0), np.nanmax(stack, axis=0)


def val_curves(algo, exp_id):
    """Return a common frame grid and each seed's val greedy return interpolated onto it."""
    grid = column(read_log(algo, run_ids(exp_id)[0], "eval"), "frames")
    curves = []
    for run in run_ids(exp_id):
        rows = read_log(algo, run, "eval")
        curves.append(np.interp(grid, column(rows, "frames"), column(rows, "val_return_mean")))
    return grid, curves


def train_curves(algo, runs, key):
    """Return bin centres and each run's per-batch train metric averaged into frame bins."""
    logs = [read_log(algo, run, "train") for run in runs]
    top = max(column(rows, "frames").max() for rows in logs)
    edges = np.linspace(0, top, SMOOTH_BINS + 1)
    centres = (edges[:-1] + edges[1:]) / 2
    return centres, [binned(column(rows, "frames"), column(rows, key), edges) for rows in logs]


def convergence_frames(frames, returns, level, stay=STAY_EVALS):
    """Return the frames at the first eval where val return reaches level and stays there for stay evals, or None."""
    above = returns >= level
    for index in range(len(above) - stay + 1):
        if above[index:index + stay].all():
            return float(frames[index])
    return None


def convergence_rows():
    """Return each winner's per-seed convergence frames against the rule_policy val level."""
    level = rule_val_level()
    rows = []
    for algo in ALGOS:
        exp_id = selected()[algo]
        for seed, run in zip(SEED_COPIES, run_ids(exp_id)):
            eval_rows = read_log(algo, run, "eval")
            rows.append({"algo": algo, "exp_id": exp_id, "run": run, "seed": seed, "rule_val_level": level,
                         "frames": convergence_frames(column(eval_rows, "frames"), column(eval_rows, "val_return_mean"), level)})
    return rows


def behaviour_episode(policy_fn, seed, market="default"):
    """Play one greedy test episode and return its returns, money, trust, credit, price band and action counts."""
    env = ShopEnv(market=market)
    obs, _ = env.reset(seed=seed)
    env.action_space.seed(seed)
    totals = dict.fromkeys(("return", "lost", "trust", "defaults", "invalid", "noop", "high", "credit_open", "days"), 0.0)
    counts = np.zeros(len(ACTION_NAMES))
    done = False
    while not done:
        action = int(policy_fn(obs, env))
        obs, reward, terminated, truncated, info = env.step(action)
        done = terminated or truncated
        counts[action] += 1
        totals["return"] += reward
        totals["lost"] += info["lost_customers"]
        totals["trust"] += info["trust"]
        totals["defaults"] += info["defaults"]
        totals["invalid"] += int(info["invalid_action"])
        totals["noop"] += int(info["noop"])
        totals["high"] += int(env.price_band == HIGH_BAND)
        totals["credit_open"] += int(env.credit_open)
        totals["days"] += 1
    days = totals["days"]
    return {"return": totals["return"], "net_worth": env.net_worth(), "invalid_rate": totals["invalid"] / days,
            "noop_rate": totals["noop"] / days, "trust": totals["trust"] / days, "lost_per_day": totals["lost"] / days,
            "defaults": totals["defaults"], "high_share": totals["high"] / days, "credit_open_share": totals["credit_open"] / days,
            "counts": counts}


def behaviour(policy_fn, seeds=TEST_SEEDS):
    """Return the mean of every behaviour metric over the test seeds, plus each action's share of all days."""
    episodes = [behaviour_episode(policy_fn, seed) for seed in seeds]
    result = {metric: float(np.mean([episode[metric] for episode in episodes])) for metric in BEHAVIOUR_METRICS}
    result["return_std"] = float(np.std([episode["return"] for episode in episodes]))
    counts = np.sum([episode["counts"] for episode in episodes], axis=0)
    result.update({f"freq_{name}": float(share) for name, share in zip(ACTION_NAMES, counts / counts.sum())})
    return result


def evaluate_behaviour():
    """Evaluate the winners (3 seeds each), the baselines and every PPO sweep experiment on the test seeds."""
    rows = []
    for algo in ALGOS:
        for seed, run in zip(SEED_COPIES, run_ids(selected()[algo])):
            policy_fn = checkpoint_policy(algo, best_checkpoint_path(algo, run))
            rows.append({"group": "winner", "policy": algo, "exp_id": run, "seed": seed, **behaviour(policy_fn)})
            print(f"behaviour {run}", flush=True)
    for name, policy_fn in BASELINES.items():
        rows.append({"group": "baseline", "policy": name, "exp_id": "", "seed": "", **behaviour(policy_fn)})
    for experiment in EXPERIMENTS["ppo"]:
        policy_fn = checkpoint_policy("ppo", best_checkpoint_path("ppo", experiment["exp_id"]))
        rows.append({"group": "ppo_sweep", "policy": "ppo", "exp_id": experiment["exp_id"], "seed": 0, **behaviour(policy_fn)})
        print(f"behaviour {experiment['exp_id']}", flush=True)
    return rows


def behaviour_rows():
    """Return the cached test-seed behaviour rows, evaluating and caching them in logs/behaviour.csv the first time."""
    if not BEHAVIOUR_PATH.exists():
        rows = evaluate_behaviour()
        write_rows(BEHAVIOUR_PATH, list(rows[0]), rows)
    rows, _ = read_rows(BEHAVIOUR_PATH)
    return rows


def number(row, key):
    """Read one float from a CSV row."""
    return float(row[key])


def save(figure, name):
    """Write a figure to assets/figures/ as a 200 dpi PNG and close it, with frame axes shown in thousands."""
    FIG_DIR.mkdir(parents=True, exist_ok=True)
    for axis in figure.axes:
        if axis.get_xlabel() == "Environment frames":
            axis.set_xlabel("Environment frames (thousands)")
            axis.xaxis.set_major_formatter(FuncFormatter(lambda value, _: f"{value / 1000:.0f}"))
    figure.tight_layout()
    figure.savefig(FIG_DIR / name, dpi=DPI)
    plt.close(figure)
    print(f"wrote {FIG_DIR / name}")


def rule_line(axis, level, label="rule_policy (val)"):
    """Draw the rule_policy level as a grey dashed horizontal line."""
    axis.axhline(level, color=COLORS["rule_policy"], linestyle="--", linewidth=1.6, label=label)


def figure_learning_curves():
    """F1: val greedy return against frames for the four winners, mean and min-max band over 3 seeds."""
    figure, axis = plt.subplots(figsize=(9, 5.2))
    for algo in ALGOS:
        grid, curves = val_curves(algo, selected()[algo])
        mean, low, high = seed_band(curves)
        axis.plot(grid, mean, color=COLORS[algo], linewidth=2, label=f"{LABELS[algo]} ({selected()[algo]})")
        axis.fill_between(grid, low, high, color=COLORS[algo], alpha=0.2, linewidth=0)
    rule_line(axis, rule_val_level())
    axis.set(title="Learning curves of the selected configurations (val seeds, greedy, 3 training seeds)",
             xlabel="Environment frames", ylabel="Mean val episode return")
    axis.legend(loc="lower right")
    axis.grid(alpha=0.3)
    save(figure, "f1_learning_curves.png")


def figure_dqn_objective():
    """F2: TD loss and mean Q against frames for the DQN winner, mean and min-max band over 3 seeds."""
    figure, axes = plt.subplots(1, 2, figsize=(11, 4.3))
    runs = run_ids(selected()["dqn"])
    for axis, key, label in ((axes[0], "mean_loss", "TD loss (smooth L1)"), (axes[1], "mean_q", "Mean Q value")):
        centres, curves = train_curves("dqn", runs, key)
        mean, low, high = seed_band(curves)
        axis.plot(centres, mean, color=COLORS["dqn"], linewidth=2, label=f"DQN {selected()['dqn']}, mean of 3 seeds")
        axis.fill_between(centres, low, high, color=COLORS["dqn"], alpha=0.2, linewidth=0, label="min-max over seeds")
        axis.set(title=f"DQN {label} during training", xlabel="Environment frames", ylabel=label)
        axis.grid(alpha=0.3)
        axis.legend(loc="upper left")
    save(figure, "f2_dqn_objective.png")


def figure_dqn_targets():
    """F2b: hard against soft target updates (dqn_01, dqn_10, dqn_11): val return and TD loss, seed 0."""
    variants = (("dqn_01", "hard, every 500 updates (default)"), ("dqn_10", "soft, tau 0.005"), ("dqn_11", "hard, every 100 updates"))
    figure, axes = plt.subplots(1, 2, figsize=(11, 4.3))
    for (exp_id, text), style in zip(variants, VARIANT_STYLES):
        rows = read_log("dqn", exp_id, "eval")
        axes[0].plot(column(rows, "frames"), column(rows, "val_return_mean"), color=COLORS["dqn"], linestyle=style,
                     linewidth=2, label=f"{exp_id}: {text}")
        centres, curves = train_curves("dqn", [exp_id], "mean_loss")
        axes[1].plot(centres, curves[0], color=COLORS["dqn"], linestyle=style, linewidth=2, label=f"{exp_id}: {text}")
    rule_line(axes[0], rule_val_level())
    axes[0].set(title="Val greedy return by target update rule", xlabel="Environment frames", ylabel="Mean val episode return")
    axes[1].set(title="TD loss by target update rule", xlabel="Environment frames", ylabel="TD loss (smooth L1)")
    for axis, place in zip(axes, ("lower right", "upper left")):
        axis.grid(alpha=0.3)
        axis.legend(loc=place, fontsize=9)
    axes[1].set_ylim(0, 2.9)
    save(figure, "f2b_dqn_target_updates.png")


def entropy_axis(axis, algo, runs, label, style="-", band=True):
    """Plot a policy's training entropy against frames, as a mean line with an optional seed band."""
    centres, curves = train_curves(algo, runs, "entropy")
    mean, low, high = seed_band(curves)
    axis.plot(centres, mean, color=COLORS[algo], linestyle=style, linewidth=2, label=label)
    if band:
        axis.fill_between(centres, low, high, color=COLORS[algo], alpha=0.2, linewidth=0)


def figure_entropy():
    """F3: policy entropy against frames for the PG winners, and PPO with entropy coefficient 0, 0.01 and 0.05."""
    figure, axis = plt.subplots(figsize=(9, 5))
    for algo in PG_ALGOS:
        entropy_axis(axis, algo, run_ids(selected()[algo]), f"{LABELS[algo]} ({selected()[algo]}), mean and min-max of 3 seeds")
    axis.axhline(MAX_ENTROPY, color="black", linestyle=":", linewidth=1.4, label=f"maximum entropy ln(13) = {MAX_ENTROPY:.2f}")
    axis.set(title="Policy entropy during training (selected configurations)", xlabel="Environment frames",
             ylabel="Mean policy entropy (nats)", ylim=(0, MAX_ENTROPY + 0.2))
    axis.grid(alpha=0.3)
    axis.legend(loc="lower left")
    save(figure, "f3_entropy.png")
    figure, axis = plt.subplots(figsize=(9, 5))
    for (exp_id, coef), style in zip((("ppo_07", "0"), ("ppo_01", "0.01"), ("ppo_08", "0.05")), (":", "--", "-")):
        entropy_axis(axis, "ppo", [exp_id], f"{exp_id}: entropy coefficient {coef}", style, band=False)
    axis.axhline(MAX_ENTROPY, color="black", linestyle=":", linewidth=1.4, label=f"maximum entropy ln(13) = {MAX_ENTROPY:.2f}")
    axis.set(title="PPO entropy by entropy coefficient (seed 0)", xlabel="Environment frames",
             ylabel="Mean policy entropy (nats)", ylim=(0, MAX_ENTROPY + 0.2))
    axis.grid(alpha=0.3)
    axis.legend(loc="lower left")
    save(figure, "f3b_ppo_entropy_coef.png")


def convergence_summary(rows):
    """Return per algorithm the mean and std of reached convergence frames and how many seeds reached the level."""
    summary = {}
    for algo in ALGOS:
        reached = [row["frames"] for row in rows if row["algo"] == algo and row["frames"] is not None]
        summary[algo] = {"reached": len(reached), "mean": float(np.mean(reached)) if reached else None,
                         "std": float(np.std(reached)) if reached else None}
    return summary


def figure_convergence():
    """F4: frames needed to reach the rule_policy val level and stay above it for 3 evals, mean and std over seeds."""
    summary = convergence_summary(convergence_rows())
    figure, axis = plt.subplots(figsize=(8, 4.8))
    top = max((item["mean"] + item["std"]) for item in summary.values() if item["mean"] is not None)
    for index, algo in enumerate(ALGOS):
        item = summary[algo]
        if item["mean"] is None:
            axis.bar(index, top * 0.08, color="white", edgecolor=COLORS[algo], hatch="//", linewidth=1.5)
            axis.text(index, top * 0.1, "not reached\n(0/3 seeds)", ha="center", va="bottom", fontsize=9)
            continue
        axis.bar(index, item["mean"], yerr=item["std"], capsize=6, color=COLORS[algo], edgecolor="black", linewidth=0.6)
        axis.text(index, item["mean"] + item["std"] + top * 0.02, f"{item['mean'] / 1000:.0f}k ({item['reached']}/3 seeds)",
                  ha="center", va="bottom", fontsize=9)
    axis.set_xticks(range(len(ALGOS)), [f"{LABELS[algo]}\n{selected()[algo]}" for algo in ALGOS])
    axis.set(title=f"Frames to reach rule_policy's val return ({rule_val_level():.1f}) and stay for {STAY_EVALS} evals",
             ylabel="Environment frames (mean and std over seeds that reached it)", ylim=(0, top * 1.25))
    axis.grid(axis="y", alpha=0.3)
    save(figure, "f4_convergence.png")


def figure_sweep():
    """F5: one panel per algorithm with each sweep experiment's selection score, the rule level and the winner."""
    figure, axes = plt.subplots(2, 2, figsize=(13, 8.5))
    level = rule_val_level()
    for axis, algo in zip(axes.flat, ALGOS):
        ids = [experiment["exp_id"] for experiment in EXPERIMENTS[algo]]
        scores = [selection_score(algo, exp_id) for exp_id in ids]
        winner = selected()[algo]
        bars = axis.bar(range(len(ids)), scores, color=COLORS[algo], alpha=0.45, edgecolor="none")
        best = ids.index(winner)
        bars[best].set_alpha(1.0)
        bars[best].set_edgecolor("black")
        bars[best].set_linewidth(1.8)
        bars[best].set_hatch("..")
        bars[best].set_label(f"winner {winner} ({scores[best]:.1f})")
        rule_line(axis, level, f"rule_policy val return ({level:.1f})")
        axis.set_xticks(range(len(ids)), [exp_id.split("_")[1] for exp_id in ids])
        axis.set(title=f"{LABELS[algo]} sweep", xlabel=f"Experiment ({algo}_NN)", ylabel="Selection score (val return, last 5 evals)")
        axis.grid(axis="y", alpha=0.3)
        axis.legend(loc="lower right", fontsize=9)
    save(figure, "f5_sweep_overview.png")


def generalization_stats():
    """Return mean and std of test return per policy and market from logs/generalization.csv."""
    rows, _ = read_rows(GENERALIZATION_PATH)
    stats = {}
    for policy in list(ALGOS) + list(BASELINES):
        for market in MARKETS:
            values = [number(row, "return_mean") for row in rows if row["policy"] == policy and row["market"] == market]
            worths = [number(row, "net_worth_mean") for row in rows if row["policy"] == policy and row["market"] == market]
            stats[policy, market] = (float(np.mean(values)), float(np.std(values)), float(np.mean(worths)), len(values))
    return stats


def figure_generalization():
    """F6: grouped bars of test return per market for the 4 algorithms (mean and std over seeds) and the 2 rule policies."""
    stats = generalization_stats()
    policies = list(ALGOS) + ["rule_policy", "rule_credit_policy"]
    width = 0.13
    figure, axis = plt.subplots(figsize=(12, 5.4))
    for offset, policy in enumerate(policies):
        positions = np.arange(len(MARKETS)) + (offset - (len(policies) - 1) / 2) * width
        means = [stats[policy, market][0] for market in MARKETS]
        stds = [stats[policy, market][1] for market in MARKETS]
        rule = policy.startswith("rule")
        axis.bar(positions, means, width, yerr=None if rule else stds, capsize=3, color=COLORS[policy],
                 hatch="//" if policy == "rule_credit_policy" else None, edgecolor="black" if rule else "none",
                 linewidth=0.5, label=LABELS[policy] + ("" if rule else " (mean and std, 3 seeds)"))
    axis.set_xticks(range(len(MARKETS)), MARKETS)
    axis.set(title="Generalization: test return of the val-selected agents and the rule policies per market",
             xlabel="Market variant", ylabel="Mean test episode return (20 test seeds)")
    axis.grid(axis="y", alpha=0.3)
    axis.legend(ncol=3, fontsize=9, loc="upper right")
    save(figure, "f6_generalization.png")


def heatmap_rows():
    """Return the action shares of each winner (averaged over its 3 seeds) and of rule_policy on the test seeds."""
    rows = behaviour_rows()
    names, shares = [], []
    for algo in ALGOS:
        picked = [row for row in rows if row["group"] == "winner" and row["policy"] == algo]
        names.append(f"{LABELS[algo]} ({selected()[algo]})")
        shares.append([np.mean([number(row, f"freq_{action}") for row in picked]) for action in ACTION_NAMES])
    rule = next(row for row in rows if row["policy"] == "rule_policy")
    names.append("rule_policy")
    shares.append([number(rule, f"freq_{action}") for action in ACTION_NAMES])
    return names, np.array(shares)


def figure_actions():
    """F7: action-frequency heatmap over the 13 actions for each winner and rule_policy on the test seeds."""
    names, shares = heatmap_rows()
    figure, axis = plt.subplots(figsize=(13, 4.6))
    image = axis.imshow(shares, cmap="viridis", vmin=0, vmax=max(0.5, shares.max()), aspect="auto")
    for row in range(shares.shape[0]):
        for col in range(shares.shape[1]):
            value = shares[row, col]
            axis.text(col, row, f"{value:.2f}", ha="center", va="center", fontsize=8,
                      color="white" if value < shares.max() * 0.6 else "black")
    axis.set_xticks(range(len(ACTION_NAMES)), [name.replace("indomie", "noodles").replace("_", " ") for name in ACTION_NAMES],
                    rotation=40, ha="right")
    axis.set_yticks(range(len(names)), names)
    axis.set(title="Share of days each action is chosen (greedy, 20 test seeds; agents averaged over 3 seeds)")
    figure.colorbar(image, ax=axis, label="Share of days")
    save(figure, "f7_action_heatmap.png")


def spread_labels(values, gap):
    """Return label heights near each value, pushed apart so no two labels are closer than gap."""
    order = np.argsort(values)
    placed = np.array(values, dtype=float)
    for previous, current in zip(order[:-1], order[1:]):
        placed[current] = max(placed[current], placed[previous] + gap)
    return placed


def scatter_panel(axis, rows, key, rule, xlabel, label_x):
    """Plot test return against one behaviour share for the PPO sweep, one labelled point per experiment."""
    returns = [number(row, "return") for row in rows]
    heights = spread_labels(returns, (max(returns) - min(returns)) / 26)
    for row, height in zip(rows, heights):
        winner = row["exp_id"] == selected()["ppo"]
        x, y = number(row, key), number(row, "return")
        axis.scatter(x, y, s=95 if winner else 55, color=COLORS["ppo"], edgecolor="black" if winner else "white",
                     linewidth=1.6 if winner else 0.8, zorder=3)
        text_x = label_x(x)
        axis.annotate(row["exp_id"] + (" (winner)" if winner else ""), (x, y), xytext=(text_x, height), fontsize=8.5,
                      va="center", ha="right" if text_x < x else "left",
                      arrowprops={"arrowstyle": "-", "color": "#999999", "linewidth": 0.6})
    axis.axhline(number(rule, "return"), color=COLORS["rule_policy"], linestyle="--", linewidth=1.6,
                 label=f"rule_policy test return ({number(rule, 'return'):.1f})")
    axis.set(xlabel=xlabel, ylabel="Mean test episode return (20 test seeds)", xlim=(-0.05, 1.08),
             ylim=(min(returns) - 3, max(heights) + 2.5))
    axis.grid(alpha=0.3)
    axis.legend(loc="center", fontsize=9)


def figure_high_price():
    """F8: for every PPO experiment's val-selected checkpoint, test return against high price band share and credit-open share."""
    rows = [row for row in behaviour_rows() if row["group"] == "ppo_sweep"]
    rule = next(row for row in behaviour_rows() if row["policy"] == "rule_policy")
    figure, axes = plt.subplots(1, 2, figsize=(13, 5.6), sharey=True)
    scatter_panel(axes[0], rows, "high_share", rule, "Share of days at the high price band", lambda x: x - 0.32)
    axes[0].set_title("PPO sweep: high price band share against test return")
    scatter_panel(axes[1], rows, "credit_open_share", rule, "Share of days with credit open", lambda x: x + 0.12 if x < 0.5 else x - 0.12)
    axes[1].set_title("PPO sweep: credit-open share against test return")
    save(figure, "f8_high_price_trap.png")


def main():
    """Draw all report figures."""
    plt.rcParams.update({"font.size": 10.5, "axes.titlesize": 11.5})
    figure_learning_curves()
    figure_dqn_objective()
    figure_dqn_targets()
    figure_entropy()
    figure_convergence()
    figure_sweep()
    figure_generalization()
    figure_actions()
    figure_high_price()


if __name__ == "__main__":
    main()
