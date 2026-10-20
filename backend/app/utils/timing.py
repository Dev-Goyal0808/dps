"""Monotonic timers for workflow metrics."""

from __future__ import annotations

import time
from dataclasses import dataclass, field


@dataclass
class PhaseTimer:
    _started: dict[str, float] = field(default_factory=dict)
    durations: dict[str, float] = field(default_factory=dict)

    def start(self, phase: str) -> None:
        self._started[phase] = time.perf_counter()

    def stop(self, phase: str) -> float:
        started = self._started.pop(phase)
        duration = time.perf_counter() - started
        self.durations[phase] = duration
        return duration

    def measure(self, phase: str) -> "TimerContext":
        return TimerContext(self, phase)


class TimerContext:
    def __init__(self, timer: PhaseTimer, phase: str) -> None:
        self.timer = timer
        self.phase = phase

    def __enter__(self) -> "TimerContext":
        self.timer.start(self.phase)
        return self

    def __exit__(self, *_: object) -> None:
        self.timer.stop(self.phase)
