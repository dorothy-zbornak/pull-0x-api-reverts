from matplotlib import pyplot as plt
from datetime import date, datetime
from data import load_data
from classify import classify_fills
import numpy as np

def count_error_types(fills):
    counts = {}
    for fill in fills:
        if fill.error == 'unknown' and fill.kind != 'native':
            key = f'bridge'
        else:
            key = fill.error
        counts[key] = counts.get(key, 0) + 1
    return counts

def by_fn(fills):
    fns = set([f.fn for f in fills])
    return {
        fn: [
            f for f in fills if f.fn == fn
        ] for fn in fns
    }

def normalize_counts(counts_by_fns):
    all_keys = set()
    for counts in counts_by_fns.values():
        all_keys |= counts.keys()
    for counts in counts_by_fns.values():
        for k in all_keys:
            if k not in counts:
                counts[k] = 0
    return counts_by_fns

fills = classify_fills(load_data())
fills_by_fn = by_fn(fills)
counts_by_fns = normalize_counts({k: count_error_types(v) for k, v in fills_by_fn.items()})
print(counts_by_fns)
kinds = sorted(list(counts_by_fns.values())[0].keys())
fns = sorted(list(counts_by_fns.keys()))
totals_by_fn = {a: sum(counts_by_fns[a].values()) for a in fns}
prev_ys = [0 for a in totals_by_fn]
for kind in kinds:
    ys = [counts_by_fns[a][kind] / totals_by_fn[a] * 100 for a in fns]
    plt.bar(range(len(fns)), ys, bottom=prev_ys, label=kind, alpha=0.5)
    prev_ys = [a + b for a, b in zip(ys, prev_ys)]
plt.xlabel('market function')
plt.ylabel('% of fills by revert reasons')
plt.title(f'0x-api per-fill revert reason by market function')
plt.xticks(
    range(len(fns)),
    [f'{k} ({sum(counts_by_fns[k].values())})' for k in fns],
    rotation=10,
    horizontalalignment='center',
    size=8,
)
plt.subplots_adjust(bottom=0.15)
plt.legend()
plt.show()
