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

def by_affiliates(fills):
    affiliates = set([f.affiliate for f in fills])
    return {
        affiliate: [
            f for f in fills
            if f.affiliate == affiliate
        ] for affiliate in affiliates
    }

def normalize_counts(counts_by_affiliates):
    all_keys = set()
    for counts in counts_by_affiliates.values():
        all_keys |= counts.keys()
    for counts in counts_by_affiliates.values():
        for k in all_keys:
            if k not in counts:
                counts[k] = 0
    return counts_by_affiliates

BZX_CONTRACT = '0xc231a724886c8e68d5def6456bc861184cbc291a'
DEFAULT_AFFILIATE = '0x1000000000000000000000000000000000000011'
fills = classify_fills(load_data())
for f in fills:
    if f.affiliate == DEFAULT_AFFILIATE and f.caller == BZX_CONTRACT:
        f.affiliate = BZX_CONTRACT
fills_by_affiliates = by_affiliates(fills)
counts_by_affiliates = normalize_counts({k: count_error_types(v) for k, v in fills_by_affiliates.items()})
print(counts_by_affiliates)
kinds = sorted(list(counts_by_affiliates.values())[0].keys())
affiliates = sorted(list(counts_by_affiliates.keys()))
totals_by_affiliate = {a: sum(counts_by_affiliates[a].values()) for a in affiliates}
prev_ys = [0 for a in totals_by_affiliate]
for kind in kinds:
    ys = [counts_by_affiliates[a][kind] / totals_by_affiliate[a] * 100 for a in affiliates]
    plt.bar(range(len(affiliates)), ys, bottom=prev_ys, label=kind, alpha=0.5)
    prev_ys = [a + b for a, b in zip(ys, prev_ys)]
plt.xlabel('affiliates')
plt.ylabel('% of fills by revert reasaons')
plt.title(f'0x-api per-fill revert reason by affiliate')
plt.xticks(
    range(len(affiliates)),
    [f'{a[:5]}... ({sum(counts_by_affiliates[a].values())})' for a in affiliates],
    rotation=30,
    horizontalalignment='right',
)
plt.subplots_adjust(bottom=0.15)
plt.legend()
plt.show()
