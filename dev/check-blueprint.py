"""Checks that the blueprint parses and every !input it uses is declared.

  python3 dev/check-blueprint.py   # needs PyYAML
"""
import sys
from pathlib import Path

import yaml

PATH = Path(__file__).resolve().parent.parent / "blueprints" / "ha_click_to_call.yaml"


class Input(str):
    pass


class Loader(yaml.SafeLoader):
    pass


Loader.add_constructor("!input", lambda loader, node: Input(loader.construct_scalar(node)))


def declared(inputs):
    # Sections (an "input" key of their own) nest the real inputs one level down.
    for key, value in inputs.items():
        if isinstance(value, dict) and "input" in value:
            yield from declared(value["input"])
        else:
            yield key


def used(node):
    if isinstance(node, Input):
        yield str(node)
    elif isinstance(node, dict):
        for value in node.values():
            yield from used(value)
    elif isinstance(node, list):
        for value in node:
            yield from used(value)


doc = yaml.load(PATH.read_text(), Loader=Loader)
meta = doc.get("blueprint", {})
errors = [f"blueprint.{key} is missing" for key in ("name", "domain", "input", "source_url") if key not in meta]
errors += [f"{key} is missing" for key in ("triggers", "actions") if key not in doc]
known = set(declared(meta.get("input", {})))
errors += [f"!input {name} isn't declared" for name in sorted(set(used(doc)) - known)]

for error in errors:
    print(f"{PATH.name}: {error}", file=sys.stderr)
if errors:
    sys.exit(1)
print(f"{PATH.name}: OK ({len(known)} inputs)")
