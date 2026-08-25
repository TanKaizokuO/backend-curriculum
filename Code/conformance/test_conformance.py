"""Python and TypeScript answer the same corpus. This is the test that
says so, instead of leaving it to whoever last edited both files by hand.
"""

import pytest

from scenarios import FLOWS


@pytest.mark.parametrize("flow_name", sorted(FLOWS.keys()))
def test_track_answers_match(recordings, flow_name):
    python_observations = recordings["python"][flow_name]
    ts_observations = recordings["typescript"][flow_name]

    assert len(python_observations) == len(ts_observations), (
        f"{flow_name}: Python made {len(python_observations)} observations, "
        f"TypeScript made {len(ts_observations)} — the flow itself diverged."
    )

    for step, (python_step, ts_step) in enumerate(zip(python_observations, ts_observations)):
        assert python_step == ts_step, f"{flow_name}, step {step}: {python_step} != {ts_step}"
