"""Pytest checks that ShopEnv follows the Gymnasium API and the shop rules described in the spec."""
import gymnasium
import numpy as np
import pytest
from gymnasium.utils.env_checker import check_env

from environment import ENV_ID, ShopEnv
from environment.baselines import rule_policy
from environment.config import make_config
from environment.custom_env import (
    CHASE_DEBTS,
    CREDIT_OPEN,
    CREDIT_STRICT,
    HIGH_BAND,
    HOLD,
    INDOMIE,
    LOOSE_RICE,
    LOWER_BAND,
    NORMAL_BAND,
    OPEN_BAG,
    RAISE_BAND,
    RICE_BAG,
)

SEED = 7
RESTOCK_INDOMIE_SMALL = 1
FROZEN_RULE_SEED = 0
FROZEN_RULE_RETURN = 87.03042346529378
FROZEN_RULE_NET_WORTH = 1447904.2346529379
EXPECTED_INVALID_PENALTY = 1.0
ALWAYS_WALK_AWAY = (1.0, 1.0, 1.0)
ALWAYS_AFFORD_HAGGLE = (2.0, 2.0)


def make_quiet_env(seed=SEED):
    """Return a reset env with no customers, so each action's effect can be checked in isolation."""
    config = make_config()
    config["customers"]["base_mean"] = 0
    env = ShopEnv(config=config)
    env.reset(seed=seed)
    return env


def run_actions(seed, actions):
    """Play a fixed action list on a fresh env and return every observation and reward."""
    env = ShopEnv()
    obs, _ = env.reset(seed=seed)
    observations, rewards = [obs], []
    for action in actions:
        obs, reward, terminated, truncated, _ = env.step(action)
        observations.append(obs)
        rewards.append(reward)
        if terminated or truncated:
            break
    return observations, rewards


def test_check_env_passes():
    """The env passes Gymnasium's own API checker."""
    check_env(ShopEnv(), skip_render_check=True)


def test_same_seed_gives_same_episode():
    """Two runs with the same seed and actions give identical observations and rewards."""
    actions = np.random.default_rng(0).integers(0, 13, size=60).tolist()
    first_obs, first_rewards = run_actions(SEED, actions)
    second_obs, second_rewards = run_actions(SEED, actions)
    assert first_rewards == second_rewards
    for first, second in zip(first_obs, second_obs):
        np.testing.assert_array_equal(first, second)


def test_observations_bounded_and_rewards_finite():
    """Every observation stays inside the box and every reward is finite over a random episode."""
    env = ShopEnv()
    obs, _ = env.reset(seed=SEED)
    env.action_space.seed(SEED)
    assert env.observation_space.contains(obs)
    done = False
    while not done:
        obs, reward, terminated, truncated, _ = env.step(env.action_space.sample())
        assert env.observation_space.contains(obs)
        assert np.isfinite(reward)
        done = terminated or truncated


def test_restock_pays_now_and_delivers_tomorrow():
    """A restock lowers cash by its cost, sits in pending, then reaches the shelf the next day."""
    env = make_quiet_env()
    product = env.products[INDOMIE]
    batch_cost = product["small_batch"] * product["cost"]
    cash_before = env.cash
    stock_before = env.stock[INDOMIE]
    _, _, _, _, info = env.step(RESTOCK_INDOMIE_SMALL)
    assert env.pending[INDOMIE] == product["small_batch"]
    daily_costs = env.config["fixed_cost"] + info["holding_cost"]
    assert env.cash == pytest.approx(cash_before - batch_cost - daily_costs)
    env.step(HOLD)
    assert env.pending[INDOMIE] == 0
    assert env.stock[INDOMIE] == stock_before + product["small_batch"]


def test_open_bag_moves_rice_to_loose():
    """Opening a bag moves one bag from slot 2 into 36 mudu in slot 3."""
    env = make_quiet_env()
    env.stock[LOOSE_RICE] = 0.0
    bags_before = env.stock[RICE_BAG]
    loose_before = env.stock[LOOSE_RICE]
    _, _, _, _, info = env.step(OPEN_BAG)
    assert env.stock[RICE_BAG] == bags_before - 1
    assert env.stock[LOOSE_RICE] == pytest.approx(loose_before + env.config["mudu_per_bag"] - info["waste"])


def test_price_band_moves_and_stays_in_range():
    """Raising and lowering the band moves one level at a time and stops at high and low."""
    env = make_quiet_env()
    expected_bands = [(RAISE_BAND, 2), (RAISE_BAND, 2), (LOWER_BAND, 1), (LOWER_BAND, 0), (LOWER_BAND, 0)]
    for action, band in expected_bands:
        env.step(action)
        assert env.price_band == band


def test_credit_policy_switches():
    """The credit actions switch the policy open and back to strict."""
    env = make_quiet_env()
    env.step(CREDIT_OPEN)
    assert env.credit_open
    env.step(CREDIT_STRICT)
    assert not env.credit_open


def test_chase_lowers_trust():
    """Chasing debts leaves trust lower than holding would on the same day."""
    holding_env = make_quiet_env()
    chasing_env = make_quiet_env()
    holding_env.step(HOLD)
    chasing_env.step(CHASE_DEBTS)
    assert chasing_env.trust < holding_env.trust


def test_invalid_restock_is_penalised_and_changes_nothing():
    """A restock without enough cash gets exactly the invalid penalty and leaves stock as holding would."""
    holding_env = make_quiet_env()
    invalid_env = make_quiet_env()
    holding_env.cash = 0.0
    invalid_env.cash = 0.0
    _, hold_reward, _, _, _ = holding_env.step(HOLD)
    _, invalid_reward, _, _, info = invalid_env.step(RESTOCK_INDOMIE_SMALL)
    penalty = invalid_env.config["reward"]["invalid_action_penalty"]
    assert info["invalid_action"]
    assert invalid_reward == pytest.approx(hold_reward - penalty)
    np.testing.assert_array_equal(invalid_env.stock, holding_env.stock)
    assert invalid_env.pending.sum() == 0


def test_invalid_penalty_is_one():
    """The invalid action penalty is 1.0, and an invalid restock scores exactly 1.0 below holding."""
    holding_env = make_quiet_env()
    invalid_env = make_quiet_env()
    holding_env.cash = 0.0
    invalid_env.cash = 0.0
    _, hold_reward, _, _, _ = holding_env.step(HOLD)
    _, invalid_reward, _, _, _ = invalid_env.step(RESTOCK_INDOMIE_SMALL)
    assert make_config()["reward"]["invalid_action_penalty"] == EXPECTED_INVALID_PENALTY
    assert invalid_reward == pytest.approx(hold_reward - EXPECTED_INVALID_PENALTY)


def make_walkaway_env(band):
    """Return a reset env where every fixed-price buyer walks away, set to the given price band.

    Credit is never asked for and every haggler can afford the ask, so the price band changes
    nothing else about the day: both bands see the same buyers, stock and random draws.
    """
    config = make_config()
    config["pricing"]["walkaway_probs"] = ALWAYS_WALK_AWAY
    config["haggle"]["buyer_max_range"] = ALWAYS_AFFORD_HAGGLE
    config["credit"]["ask_prob"] = 0.0
    env = ShopEnv(config=config)
    env.reset(seed=SEED)
    env.price_band = band
    return env


def test_high_band_walkaways_lower_trust():
    """Fixed-price walk aways lower trust by the configured loss each at the high band, and not at the normal band."""
    high_env = make_walkaway_env(HIGH_BAND)
    normal_env = make_walkaway_env(NORMAL_BAND)
    _, _, _, _, high_info = high_env.step(HOLD)
    _, _, _, _, normal_info = normal_env.step(HOLD)
    walkaways = high_info["price_walkaways"]
    assert walkaways > 0
    assert walkaways == normal_info["price_walkaways"]
    trust = high_env.config["trust"]
    loss = high_env.config["pricing"]["price_walkaway_trust_loss"] * walkaways
    expected_gap = loss * (1 - trust["recovery_rate"])
    assert normal_env.trust - high_env.trust == pytest.approx(expected_gap)
    assert f"Lost {walkaways} buyers to high prices" in high_info["events"]
    assert not any("high prices" in event for event in normal_info["events"])


def test_noop_flag_marks_valid_actions_that_change_nothing():
    """The noop flag is set for hold, a band move past the end, the credit policy already in place and a chase with no old debt."""
    env = make_quiet_env()
    old_age = env.config["debt"]["chase_min_age"] + 1
    steps = [
        (HOLD, True),
        (RESTOCK_INDOMIE_SMALL, False),
        (RAISE_BAND, False),
        (RAISE_BAND, True),
        (LOWER_BAND, False),
        (LOWER_BAND, False),
        (LOWER_BAND, True),
        (CREDIT_STRICT, True),
        (CREDIT_OPEN, False),
        (CREDIT_OPEN, True),
        (CHASE_DEBTS, True),
    ]
    for action, expected in steps:
        _, _, _, _, info = env.step(action)
        assert info["noop"] == expected, info["action_name"]
    env.debts.append({"amount": 1000.0, "age": old_age})
    _, _, _, _, info = env.step(CHASE_DEBTS)
    assert not info["noop"]


def test_invalid_action_is_not_a_noop():
    """An invalid action is flagged invalid, not noop, so the two rates never count the same day."""
    env = make_quiet_env()
    env.cash = 0.0
    _, _, _, _, info = env.step(RESTOCK_INDOMIE_SMALL)
    assert info["invalid_action"]
    assert not info["noop"]


def test_restock_over_capacity_is_invalid_and_keeps_cash():
    """A restock that would overfill storage is invalid, places no order and spends nothing on it."""
    holding_env = make_quiet_env()
    invalid_env = make_quiet_env()
    product = invalid_env.products[INDOMIE]
    nearly_full = product["cap"] - product["small_batch"] + 1
    holding_env.stock[INDOMIE] = nearly_full
    invalid_env.stock[INDOMIE] = nearly_full
    holding_env.step(HOLD)
    _, _, _, _, info = invalid_env.step(RESTOCK_INDOMIE_SMALL)
    assert info["invalid_action"]
    assert any("Not enough space" in event for event in info["events"])
    assert invalid_env.pending.sum() == 0
    assert invalid_env.cash == pytest.approx(holding_env.cash)


def test_open_bag_over_capacity_is_invalid():
    """Opening a bag when the loose rice would overflow its storage is invalid and moves nothing."""
    env = make_quiet_env()
    env.stock[LOOSE_RICE] = env.products[LOOSE_RICE]["cap"]
    bags_before = env.stock[RICE_BAG]
    _, _, _, _, info = env.step(OPEN_BAG)
    assert info["invalid_action"]
    assert env.stock[RICE_BAG] == bags_before


def test_holding_cost_lowers_cash_without_customers():
    """With no customers, cash falls by the fixed cost plus the holding cost on the stock at cost."""
    env = make_quiet_env()
    cash_before = env.cash
    _, _, _, _, info = env.step(HOLD)
    expected_holding = env.config["holding_cost_rate"] * float(np.dot(env.stock, env.unit_costs))
    assert info["holding_cost"] > 0
    assert info["holding_cost"] == pytest.approx(expected_holding)
    assert env.cash == pytest.approx(cash_before - env.config["fixed_cost"] - expected_holding)


def test_loose_rice_shrinks_from_waste_without_customers():
    """With no customers, loose rice drops by the waste rate, rounded down to the waste step."""
    env = make_quiet_env()
    loose_before = 40.0
    env.stock[LOOSE_RICE] = loose_before
    _, _, _, _, info = env.step(HOLD)
    step = env.config["loose_rice_waste_step"]
    expected_waste = np.floor(env.config["loose_rice_waste_rate"] * loose_before / step) * step
    assert expected_waste > 0
    assert info["waste"] == pytest.approx(expected_waste)
    assert env.stock[LOOSE_RICE] == pytest.approx(loose_before - expected_waste)


def test_terminates_exactly_at_day_90_when_holding():
    """Holding every day runs the full episode and terminates on day 90, never truncating."""
    env = ShopEnv()
    env.reset(seed=SEED)
    episode_days = env.config["calendar"]["episode_days"]
    for day in range(1, episode_days + 1):
        _, _, terminated, truncated, info = env.step(HOLD)
        assert not truncated
        assert info["day"] == day
        assert terminated == (day == episode_days)
        assert not info["bankrupt"]
        assert info["end_reason"] == ("day_90" if day == episode_days else None)


def test_negative_cash_terminates_as_bankrupt():
    """Cash below zero after the fixed cost ends the episode as terminated, flagged as bankruptcy."""
    env = ShopEnv()
    env.reset(seed=SEED)
    env.cash = -1_000_000.0
    _, _, terminated, truncated, info = env.step(HOLD)
    assert terminated
    assert not truncated
    assert info["bankrupt"]
    assert info["end_reason"] == "bankrupt"
    assert any(event.startswith("Bankrupt") for event in info["events"])


def test_rule_policy_seed_0_is_frozen():
    """rule_policy on seed 0 gives exactly the frozen return and net worth, so any change to the dynamics shows up."""
    env = ShopEnv()
    obs, _ = env.reset(seed=FROZEN_RULE_SEED)
    total_return = 0.0
    done = False
    while not done:
        obs, reward, terminated, truncated, _ = env.step(rule_policy(obs, env))
        total_return += reward
        done = terminated or truncated
    assert total_return == FROZEN_RULE_RETURN
    assert env.net_worth() == FROZEN_RULE_NET_WORTH


def test_gymnasium_make_works():
    """The registered id builds a working env through gymnasium.make."""
    env = gymnasium.make(ENV_ID)
    obs, _ = env.reset(seed=SEED)
    assert env.observation_space.contains(obs)
    obs, _, _, _, _ = env.step(HOLD)
    assert env.observation_space.contains(obs)


@pytest.mark.parametrize("market", ["harsh", "price_scale", "slow_market", "credit_culture"])
def test_market_variants_build_and_run(market):
    """Every market variant builds through gymnasium.make and runs a full random episode."""
    env = gymnasium.make(ENV_ID, market=market)
    obs, _ = env.reset(seed=SEED)
    env.action_space.seed(SEED)
    done = False
    while not done:
        obs, reward, terminated, truncated, _ = env.step(env.action_space.sample())
        assert env.observation_space.contains(obs)
        assert np.isfinite(reward)
        done = terminated or truncated
    assert env.unwrapped.config["market"] == market
