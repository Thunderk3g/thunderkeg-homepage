"""A small LRU for branches."""

from __future__ import annotations

from collections import OrderedDict
from typing import Generic, Iterable, TypeVar

K = TypeVar("K")
V = TypeVar("V")


class LRU(Generic[K, V]):
    def __init__(self, capacity: int = 64) -> None:
        self.capacity = max(1, capacity)
        self._items: OrderedDict[K, V] = OrderedDict()

    def get(self, key: K) -> V | None:
        item = self._items.get(key)
        if item is not None:
            self._items.move_to_end(key)
        return item

    def peek(self, key: K) -> V | None:
        return self._items.get(key)

    def put(self, key: K, value: V, keep: Iterable[K] = ()) -> list[V]:
        """Insert, and return what was evicted. Keys in `keep` are never evicted."""
        self._items[key] = value
        self._items.move_to_end(key)
        evicted: list[V] = []
        protected = set(keep) | {key}
        while len(self._items) > self.capacity:
            victim = next((k for k in self._items if k not in protected), None)
            if victim is None:
                break
            evicted.append(self._items.pop(victim))
        return evicted

    def clear(self) -> None:
        self._items.clear()

    def __len__(self) -> int:
        return len(self._items)

    def __contains__(self, key: K) -> bool:
        return key in self._items
