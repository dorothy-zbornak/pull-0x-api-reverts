from matplotlib import pyplot as plt
from datetime import date, datetime
from data import load_data
from classify import classify_fills
import numpy as np

def count_categories(fills):
    counts = {}
    for fill in fills:
        if fill.error == 'oog':
            counts[fill.kind] = counts.get(fill.kind, 0) + 1
    return counts

fills = classify_fills(load_data())
counts = count_categories(fills)
kinds = sorted(counts.keys())
totals = sum(counts.values())
prev_y = 0
for kind in kinds:
    y = counts[kind] / totals * 100
    plt.bar([0], [y], bottom=[prev_y], label=kind, alpha=0.5)
    prev_y += y
plt.ylabel('% of oog fills by order kind')
plt.title(f'0x-api OOG order kinds ({totals})')
plt.xticks([],[])
plt.subplots_adjust(bottom=0.15)
plt.legend()
plt.show()
