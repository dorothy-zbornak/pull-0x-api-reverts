from matplotlib import pyplot as plt
from datetime import date, datetime
from data import load_data
from classify import classify_fills
import numpy as np

def count_error_types(fills):
    counts = {}
    for fill in fills:
        if fill.error == 'unknown':
            key = f'bridge'
        else:
            key = fill.error
        counts[key] = counts.get(key, 0) + 1
    return counts

def as_day_timestamp(ts):
    return int(datetime.fromisoformat(date.fromtimestamp(ts).isoformat()).timestamp())

ONE_DAY = 24 * 60 * 60
def by_days(fills):
    min_day = as_day_timestamp(min(f.timestamp for f in fills))
    max_day = as_day_timestamp(max(f.timestamp for f in fills))
    return [
        [
            f for f in fills
            if f.timestamp >= start and f.timestamp < start + ONE_DAY
        ] for start in range(min_day, max_day + ONE_DAY, ONE_DAY)
    ]

def normalize_counts(counts_by_days):
    all_keys = set()
    for counts in counts_by_days:
        all_keys |= counts.keys()
    for counts in counts_by_days:
        for k in all_keys:
            if k not in counts:
                counts[k] = 0
    return counts_by_days

fills = classify_fills(load_data())
fills_by_days = by_days(fills)
counts_by_days = normalize_counts([count_error_types(f) for f in fills_by_days])
kinds = sorted(counts_by_days[0].keys())
ys = np.transpose([[c[k] for k in kinds] for c in counts_by_days])
plt.stackplot(
    range(len(fills_by_days)),
    ys,
    labels=kinds,
)
plt.xticks(range(len(counts_by_days)), [date.fromtimestamp(f[0].timestamp).strftime('%m/%d') for f in fills_by_days])
plt.legend()
plt.axis((0, len(counts_by_days) - 1, plt.axis()[2], plt.axis()[3]))
plt.title(f'0x-api per-fill revert reason by day ({len(fills)} total)')
plt.ylabel('# of reverted fills')
plt.xlabel('day (UTC)')
plt.show()
