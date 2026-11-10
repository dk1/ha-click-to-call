"""Renders the blueprint's templates against sample webhook requests.

Uses Jinja's sandbox with Home Assistant's `match` test and `regex_replace` filter, and
`multidict` for form data, as Home Assistant does. It mirrors Home Assistant's template
engine closely enough for these templates; the real engine was checked by hand too.

  pip install pyyaml jinja2 multidict && python -m unittest dev/test_blueprint.py
"""
import ast
import re
import unittest
from pathlib import Path

import yaml
from jinja2.sandbox import ImmutableSandboxedEnvironment
from multidict import MultiDict, MultiDictProxy


class Loader(yaml.SafeLoader):
    pass


Loader.add_constructor("!input", lambda loader, node: None)
BLUEPRINT = yaml.load((Path(__file__).parent.parent / "blueprints" / "ha_click_to_call.yaml").read_text(), Loader=Loader)

env = ImmutableSandboxedEnvironment()
env.tests["match"] = lambda value, pattern: bool(re.match(pattern, str(value)))
env.filters["regex_replace"] = lambda value, find, replace="": re.sub(find, replace, str(value))


def ha_value(text):
    """Home Assistant turns a rendered variable that looks like a Python literal into that type."""
    try:
        return ast.literal_eval(text)
    except (ValueError, SyntaxError):
        return text


def run(trigger):
    """Render the variables in order, then the condition and the notification message."""
    values = {"trigger": trigger}
    for name in ("tel_uri", "dialing"):
        values[name] = ha_value(env.from_string(BLUEPRINT["variables"][name]).render(**values))
    passes = env.from_string(BLUEPRINT["conditions"][0]["value_template"]).render(**values) == "True"
    message = env.from_string(BLUEPRINT["actions"][0]["message"]).render(**values)
    return values["tel_uri"], passes, message


form = lambda **fields: {"data": MultiDictProxy(MultiDict(fields))}


class Blueprint(unittest.TestCase):
    def test_form_with_label(self):
        self.assertEqual(run(form(number="9059874466", label="(905) 987-4466")),
                         ("tel:9059874466", True, "Dialing (905) 987-4466"))

    def test_plus_one_number_with_local_label(self):
        self.assertEqual(run(form(number="+14165550199", label="(416) 555-0199")),
                         ("tel:+14165550199", True, "Dialing (416) 555-0199"))

    def test_number_stays_text(self):
        # A bare "+1416…" variable would become an integer; the tel: prefix keeps it a string.
        tel_uri, _, _ = run(form(number="+14165550199"))
        self.assertIsInstance(tel_uri, str)

    def test_json_from_earlier_versions(self):
        self.assertEqual(run({"json": {"number": "+14165550199"}}), ("tel:+14165550199", True, "Dialing +14165550199"))

    def test_label_that_isnt_the_number_falls_back_to_digits(self):
        for label in ["(416) 555-0199", "<b>hi</b> 9059874466", "987-4466", "Call us!"]:
            with self.subTest(label=label):
                self.assertEqual(run(form(number="9059874466", label=label))[2], "Dialing 9059874466")

    def test_short_codes_and_junk_fail_the_condition(self):
        for trigger in [form(number="911"), form(number="112"), form(), {"json": [1, 2]}, form(number="1" * 16),
                        form(number="905-987-4466")]:
            with self.subTest(trigger=trigger):
                self.assertFalse(run(trigger)[1])


if __name__ == "__main__":
    unittest.main()
