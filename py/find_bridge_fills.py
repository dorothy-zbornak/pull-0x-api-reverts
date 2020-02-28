from data import load_data
from classify import classify_fills
import json

fills = [f for f in classify_fills(load_data()) if f.kind != 'native']
for fill in fills:
    print(json.dumps(fill.__dict__))
