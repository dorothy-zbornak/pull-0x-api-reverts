import os.path as path
import json

def load_data():
    with open(path.join(path.dirname(__file__), '../output.json')) as f:
        return json.loads(f.read())
