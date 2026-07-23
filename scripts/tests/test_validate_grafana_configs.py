#!/usr/bin/env python3
"""
Unit tests for validate-grafana-configs.py

Usage:
    pip3 install pyyaml
    python3 -m unittest scripts/tests/test_validate_grafana_configs.py -v
"""

import io
import json
import os
import sys
import tempfile
import unittest
from unittest.mock import patch

# Load the module using importlib (hyphens in filename prevent a direct import)
_SCRIPT_PATH = os.path.join(os.path.dirname(__file__), "..", "validate-grafana-configs.py")

import importlib.util
_spec = importlib.util.spec_from_file_location("validate_grafana_configs", _SCRIPT_PATH)
vgc = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(vgc)


class TestValidateYaml(unittest.TestCase):
    """Tests for the validate_yaml() function."""

    def setUp(self):
        self.temp_files = []

    def tearDown(self):
        for f in self.temp_files:
            try:
                os.unlink(f)
            except OSError:
                pass

    def _make_file(self, content: str, suffix: str = ".yml") -> str:
        """Create a temp file with the given content and return its path."""
        fd, path = tempfile.mkstemp(suffix=suffix, text=True)
        with os.fdopen(fd, "w") as f:
            f.write(content)
        self.temp_files.append(path)
        return path

    def test_valid_yaml(self):
        """Well-formed YAML should return True."""
        path = self._make_file("key: value\nlist:\n  - item1\n  - item2\n")
        self.assertTrue(vgc.validate_yaml(path))

    def test_valid_yaml_empty(self):
        """Empty YAML (None/null) should return True."""
        path = self._make_file("")
        self.assertTrue(vgc.validate_yaml(path))

    def test_invalid_yaml_syntax(self):
        """Malformed YAML (unclosed flow sequence) should return False."""
        path = self._make_file("[unclosed\n")
        self.assertFalse(vgc.validate_yaml(path))

    def test_invalid_yaml_unclosed_flow(self):
        """YAML with unclosed flow mapping should return False."""
        path = self._make_file("{unbalanced\n")
        self.assertFalse(vgc.validate_yaml(path))

    def test_invalid_yaml_tab_error(self):
        """YAML with tabs instead of spaces should return False."""
        path = self._make_file("key:\n\tvalue\n")
        self.assertFalse(vgc.validate_yaml(path))

    def test_missing_file(self):
        """Non-existent file should return False (graceful error)."""
        self.assertFalse(vgc.validate_yaml("/tmp/nonexistent_file_xyz.yml"))


class TestValidateDashboardJson(unittest.TestCase):
    """Tests for the validate_dashboard_json() function."""

    def setUp(self):
        self.temp_files = []

    def tearDown(self):
        for f in self.temp_files:
            try:
                os.unlink(f)
            except OSError:
                pass

    def _make_json(self, data: dict) -> str:
        """Create a temp JSON file with the given dict and return its path."""
        fd, path = tempfile.mkstemp(suffix=".json", text=True)
        with os.fdopen(fd, "w") as f:
            json.dump(data, f)
        self.temp_files.append(path)
        return path

    def _make_raw(self, content: str) -> str:
        """Create a temp file with raw string content."""
        fd, path = tempfile.mkstemp(suffix=".json", text=True)
        with os.fdopen(fd, "w") as f:
            f.write(content)
        self.temp_files.append(path)
        return path

    def test_valid_dashboard(self):
        """A complete Grafana dashboard should return True."""
        dash = {
            "title": "My Dashboard",
            "panels": [
                {
                    "id": 1,
                    "title": "CPU Usage",
                    "type": "stat",
                    "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0},
                }
            ],
            "schemaVersion": 38,
            "timezone": "utc",
        }
        self.assertTrue(vgc.validate_dashboard_json(self._make_json(dash)))

    def test_valid_dashboard_multi_panel(self):
        """Dashboard with multiple panels should return True."""
        dash = {
            "title": "Multi Panel",
            "panels": [
                {"id": 1, "title": "A", "type": "stat", "gridPos": {"h": 4, "w": 6, "x": 0, "y": 0}},
                {"id": 2, "title": "B", "type": "timeseries", "gridPos": {"h": 4, "w": 6, "x": 6, "y": 0}},
                {"id": 3, "title": "C", "type": "table", "gridPos": {"h": 8, "w": 12, "x": 0, "y": 4}},
            ],
            "schemaVersion": 38,
            "timezone": "utc",
        }
        self.assertTrue(vgc.validate_dashboard_json(self._make_json(dash)))

    def test_valid_dashboard_nested_panels(self):
        """Dashboard with collapsible section (nested panels) should return True."""
        dash = {
            "title": "Nested",
            "panels": [
                {
                    "id": 10,
                    "title": "Section 1",
                    "type": "row",
                    "collapsed": True,
                    "gridPos": {"h": 1, "w": 24, "x": 0, "y": 0},
                    "panels": [
                        {"id": 11, "title": "Child A", "type": "stat", "gridPos": {"h": 6, "w": 12, "x": 0, "y": 1}},
                        {"id": 12, "title": "Child B", "type": "gauge", "gridPos": {"h": 6, "w": 12, "x": 12, "y": 1}},
                    ],
                }
            ],
            "schemaVersion": 38,
            "timezone": "local",
        }
        self.assertTrue(vgc.validate_dashboard_json(self._make_json(dash)))

    def test_missing_title(self):
        """Dashboard missing 'title' should return False."""
        dash = {"panels": [], "schemaVersion": 38, "timezone": "utc"}
        self.assertFalse(vgc.validate_dashboard_json(self._make_json(dash)))

    def test_empty_title(self):
        """Dashboard with empty title string should return False."""
        dash = {"title": "  ", "panels": [{"id": 1, "title": "P", "type": "stat", "gridPos": {}}], "schemaVersion": 38, "timezone": "utc"}
        self.assertFalse(vgc.validate_dashboard_json(self._make_json(dash)))

    def test_missing_panels(self):
        """Dashboard missing 'panels' should return False."""
        dash = {"title": "No Panels", "schemaVersion": 38, "timezone": "utc"}
        self.assertFalse(vgc.validate_dashboard_json(self._make_json(dash)))

    def test_panels_not_array(self):
        """Dashboard with non-array 'panels' should return False."""
        dash = {"title": "Bad Panels", "panels": "not an array", "schemaVersion": 38, "timezone": "utc"}
        self.assertFalse(vgc.validate_dashboard_json(self._make_json(dash)))

    def test_empty_panels(self):
        """Dashboard with empty panels array should return False."""
        dash = {"title": "Empty", "panels": [], "schemaVersion": 38, "timezone": "utc"}
        self.assertFalse(vgc.validate_dashboard_json(self._make_json(dash)))

    def test_missing_schema_version(self):
        """Dashboard missing schemaVersion is flagged (recommended but still an error)."""
        dash = {"title": "OK", "panels": [{"id": 1, "title": "P", "type": "stat", "gridPos": {}}], "timezone": "utc"}
        # The script reports missing recommended fields as errors -> returns False
        self.assertFalse(vgc.validate_dashboard_json(self._make_json(dash)))

    def test_missing_timezone(self):
        """Dashboard missing timezone is flagged (recommended but still an error)."""
        dash = {"title": "OK", "panels": [{"id": 1, "title": "P", "type": "stat", "gridPos": {}}], "schemaVersion": 38}
        # The script reports missing recommended fields as errors -> returns False
        self.assertFalse(vgc.validate_dashboard_json(self._make_json(dash)))

    def test_panel_missing_title(self):
        """Panel without title should return False."""
        dash = {
            "title": "Test",
            "panels": [{"id": 1, "type": "stat", "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0}}],
            "schemaVersion": 38,
            "timezone": "utc",
        }
        self.assertFalse(vgc.validate_dashboard_json(self._make_json(dash)))

    def test_panel_empty_title(self):
        """Panel with whitespace-only title should return False."""
        dash = {
            "title": "Test",
            "panels": [{"id": 1, "title": "   ", "type": "stat", "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0}}],
            "schemaVersion": 38,
            "timezone": "utc",
        }
        self.assertFalse(vgc.validate_dashboard_json(self._make_json(dash)))

    def test_panel_missing_gridpos(self):
        """Panel without gridPos should return False."""
        dash = {
            "title": "Test",
            "panels": [{"id": 1, "title": "No Grid", "type": "stat"}],
            "schemaVersion": 38,
            "timezone": "utc",
        }
        self.assertFalse(vgc.validate_dashboard_json(self._make_json(dash)))

    def test_panel_missing_type(self):
        """Panel without type should return False."""
        dash = {
            "title": "Test",
            "panels": [{"id": 1, "title": "No Type", "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0}}],
            "schemaVersion": 38,
            "timezone": "utc",
        }
        self.assertFalse(vgc.validate_dashboard_json(self._make_json(dash)))

    def test_gridpos_missing_fields(self):
        """gridPos missing h, w, x, y should return False."""
        dash = {
            "title": "Grid Test",
            "panels": [{"id": 1, "title": "P", "type": "stat", "gridPos": {}}],
            "schemaVersion": 38,
            "timezone": "utc",
        }
        self.assertFalse(vgc.validate_dashboard_json(self._make_json(dash)))

    def test_gridpos_not_a_dict(self):
        """gridPos that is not an object should return False."""
        dash = {
            "title": "Grid Test",
            "panels": [{"id": 1, "title": "P", "type": "stat", "gridPos": "string"}],
            "schemaVersion": 38,
            "timezone": "utc",
        }
        self.assertFalse(vgc.validate_dashboard_json(self._make_json(dash)))

    def test_gridpos_h_zero(self):
        """gridPos.h = 0 should return False (must be >= 1)."""
        dash = {
            "title": "Grid Test",
            "panels": [{"id": 1, "title": "P", "type": "stat", "gridPos": {"h": 0, "w": 12, "x": 0, "y": 0}}],
            "schemaVersion": 38,
            "timezone": "utc",
        }
        self.assertFalse(vgc.validate_dashboard_json(self._make_json(dash)))

    def test_gridpos_h_negative(self):
        """gridPos.h = -1 should return False."""
        dash = {
            "title": "Grid Test",
            "panels": [{"id": 1, "title": "P", "type": "stat", "gridPos": {"h": -1, "w": 12, "x": 0, "y": 0}}],
            "schemaVersion": 38,
            "timezone": "utc",
        }
        self.assertFalse(vgc.validate_dashboard_json(self._make_json(dash)))

    def test_gridpos_w_zero(self):
        """gridPos.w = 0 should return False (must be >= 1)."""
        dash = {
            "title": "Grid Test",
            "panels": [{"id": 1, "title": "P", "type": "stat", "gridPos": {"h": 8, "w": 0, "x": 0, "y": 0}}],
            "schemaVersion": 38,
            "timezone": "utc",
        }
        self.assertFalse(vgc.validate_dashboard_json(self._make_json(dash)))

    def test_gridpos_x_negative(self):
        """gridPos.x = -1 should return False (must be >= 0)."""
        dash = {
            "title": "Grid Test",
            "panels": [{"id": 1, "title": "P", "type": "stat", "gridPos": {"h": 8, "w": 12, "x": -1, "y": 0}}],
            "schemaVersion": 38,
            "timezone": "utc",
        }
        self.assertFalse(vgc.validate_dashboard_json(self._make_json(dash)))

    def test_gridpos_y_negative(self):
        """gridPos.y = -1 should return False (must be >= 0)."""
        dash = {
            "title": "Grid Test",
            "panels": [{"id": 1, "title": "P", "type": "stat", "gridPos": {"h": 8, "w": 12, "x": 0, "y": -1}}],
            "schemaVersion": 38,
            "timezone": "utc",
        }
        self.assertFalse(vgc.validate_dashboard_json(self._make_json(dash)))

    def test_gridpos_zero_x_and_y_valid(self):
        """gridPos.x = 0, y = 0 are valid starting positions."""
        dash = {
            "title": "Grid Test",
            "panels": [{"id": 1, "title": "P", "type": "stat", "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0}}],
            "schemaVersion": 38,
            "timezone": "utc",
        }
        self.assertTrue(vgc.validate_dashboard_json(self._make_json(dash)))

    def test_gridpos_float_values(self):
        """gridPos with float values should return False (must be int)."""
        dash = {
            "title": "Grid Test",
            "panels": [{"id": 1, "title": "P", "type": "stat", "gridPos": {"h": 8.5, "w": 12, "x": 0, "y": 0}}],
            "schemaVersion": 38,
            "timezone": "utc",
        }
        self.assertFalse(vgc.validate_dashboard_json(self._make_json(dash)))

    def test_gridpos_bool_values(self):
        """gridPos with bool values should return False (bool is subclass of int)."""
        dash = {
            "title": "Grid Test",
            "panels": [{"id": 1, "title": "P", "type": "stat", "gridPos": {"h": True, "w": 12, "x": 0, "y": 0}}],
            "schemaVersion": 38,
            "timezone": "utc",
        }
        self.assertFalse(vgc.validate_dashboard_json(self._make_json(dash)))

    def test_gridpos_nested_panel_missing_h(self):
        """Nested panel gridPos missing 'h' should return False."""
        dash = {
            "title": "Nested",
            "panels": [
                {
                    "id": 10,
                    "title": "Section",
                    "type": "row",
                    "gridPos": {"h": 1, "w": 24, "x": 0, "y": 0},
                    "panels": [
                        {"id": 11, "title": "Child", "type": "stat", "gridPos": {"w": 12, "x": 0, "y": 1}},
                    ],
                }
            ],
            "schemaVersion": 38,
            "timezone": "utc",
        }
        self.assertFalse(vgc.validate_dashboard_json(self._make_json(dash)))

    def test_panel_type_unknown(self):
        """Panel with unknown type should return False."""
        dash = {
            "title": "Type Test",
            "panels": [{"id": 1, "title": "P", "type": "MyCustomViz", "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0}}],
            "schemaVersion": 38,
            "timezone": "utc",
        }
        self.assertFalse(vgc.validate_dashboard_json(self._make_json(dash)))

    def test_panel_type_not_a_string(self):
        """Panel with non-string type should return False."""
        dash = {
            "title": "Type Test",
            "panels": [{"id": 1, "title": "P", "type": 123, "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0}}],
            "schemaVersion": 38,
            "timezone": "utc",
        }
        self.assertFalse(vgc.validate_dashboard_json(self._make_json(dash)))

    def test_panel_type_all_valid(self):
        """All known panel types should be accepted."""
        for ptype in ["stat", "timeseries", "table", "gauge", "bargauge", "piechart",
                      "text", "heatmap", "logs", "traces", "canvas", "geomap",
                      "alertlist", "row", "dashlist"]:
            dash = {
                "title": f"Type {ptype}",
                "panels": [{"id": 1, "title": "P", "type": ptype, "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0}}],
                "schemaVersion": 38,
                "timezone": "utc",
            }
        self.assertTrue(
            vgc.validate_dashboard_json(self._make_json(dash)),
            f"Panel type {ptype!r} should be valid",
        )

    def test_schema_version_negative(self):
        """schemaVersion = -1 should return False."""
        dash = {
            "title": "Test",
            "panels": [{"id": 1, "title": "P", "type": "stat", "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0}}],
            "schemaVersion": -1,
            "timezone": "utc",
        }
        self.assertFalse(vgc.validate_dashboard_json(self._make_json(dash)))

    def test_schema_version_zero(self):
        """schemaVersion = 0 should return False."""
        dash = {
            "title": "Test",
            "panels": [{"id": 1, "title": "P", "type": "stat", "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0}}],
            "schemaVersion": 0,
            "timezone": "utc",
        }
        self.assertFalse(vgc.validate_dashboard_json(self._make_json(dash)))

    def test_schema_version_not_int(self):
        """schemaVersion = "38" (string) should return False."""
        dash = {
            "title": "Test",
            "panels": [{"id": 1, "title": "P", "type": "stat", "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0}}],
            "schemaVersion": "38",
            "timezone": "utc",
        }
        self.assertFalse(vgc.validate_dashboard_json(self._make_json(dash)))

    def test_schema_version_bool(self):
        """schemaVersion = True should return False (bool is not int)."""
        dash = {
            "title": "Test",
            "panels": [{"id": 1, "title": "P", "type": "stat", "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0}}],
            "schemaVersion": True,
            "timezone": "utc",
        }
        self.assertFalse(vgc.validate_dashboard_json(self._make_json(dash)))

    def test_schema_version_positive_valid(self):
        """schemaVersion = 38 should be valid."""
        dash = {
            "title": "Test",
            "panels": [{"id": 1, "title": "P", "type": "stat", "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0}}],
            "schemaVersion": 38,
            "timezone": "utc",
        }
        self.assertTrue(vgc.validate_dashboard_json(self._make_json(dash)))

    def test_timezone_invalid(self):
        """Invalid timezone string should return False."""
        dash = {
            "title": "Test",
            "panels": [{"id": 1, "title": "P", "type": "stat", "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0}}],
            "schemaVersion": 38,
            "timezone": "NotARealTimezone",
        }
        self.assertFalse(vgc.validate_dashboard_json(self._make_json(dash)))

    def test_timezone_not_a_string(self):
        """Non-string timezone should return False."""
        dash = {
            "title": "Test",
            "panels": [{"id": 1, "title": "P", "type": "stat", "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0}}],
            "schemaVersion": 38,
            "timezone": 123,
        }
        self.assertFalse(vgc.validate_dashboard_json(self._make_json(dash)))

    def test_timezone_special_values(self):
        """Grafana special timezone values should be valid."""
        for tz in ["utc", "browser", "local"]:
            dash = {
                "title": "Test",
                "panels": [{"id": 1, "title": "P", "type": "stat", "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0}}],
                "schemaVersion": 38,
                "timezone": tz,
            }
            self.assertTrue(
                vgc.validate_dashboard_json(self._make_json(dash)),
                f"Timezone {tz!r} should be valid",
            )

    def test_timezone_iana_values(self):
        """Common IANA timezones should be valid."""
        for tz in ["America/New_York", "Europe/London", "Asia/Kolkata",
                   "Asia/Tokyo", "Australia/Sydney", "Pacific/Auckland",
                   "Africa/Johannesburg", "America/Sao_Paulo"]:
            dash = {
                "title": "Test",
                "panels": [{"id": 1, "title": "P", "type": "stat", "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0}}],
                "schemaVersion": 38,
                "timezone": tz,
            }
            self.assertTrue(
                vgc.validate_dashboard_json(self._make_json(dash)),
                f"IANA timezone {tz!r} should be valid",
            )

    def test_nested_panel_type_unknown(self):
        """Nested panel with unknown type should return False."""
        dash = {
            "title": "Nested",
            "panels": [
                {
                    "id": 10,
                    "title": "Section",
                    "type": "row",
                    "gridPos": {"h": 1, "w": 24, "x": 0, "y": 0},
                    "panels": [
                        {"id": 11, "title": "Child", "type": "totally_invalid", "gridPos": {"h": 6, "w": 12, "x": 0, "y": 1}},
                    ],
                }
            ],
            "schemaVersion": 38,
            "timezone": "utc",
        }
        self.assertFalse(vgc.validate_dashboard_json(self._make_json(dash)))

    def test_nested_panel_missing_title(self):
        """Nested panel within collapsible section missing title should return False."""
        dash = {
            "title": "Nested",
            "panels": [
                {
                    "id": 10,
                    "title": "Section",
                    "type": "row",
                    "gridPos": {"h": 1, "w": 24, "x": 0, "y": 0},
                    "panels": [
                        {"id": 11, "type": "stat", "gridPos": {"h": 6, "w": 12, "x": 0, "y": 1}},
                    ],
                }
            ],
            "schemaVersion": 38,
            "timezone": "utc",
        }
        self.assertFalse(vgc.validate_dashboard_json(self._make_json(dash)))

    def test_nested_panel_empty_title(self):
        """Nested panel with whitespace-only title should return False."""
        dash = {
            "title": "Nested",
            "panels": [
                {
                    "id": 10,
                    "title": "Section",
                    "type": "row",
                    "gridPos": {"h": 1, "w": 24, "x": 0, "y": 0},
                    "panels": [
                        {"id": 11, "title": "  ", "type": "stat", "gridPos": {"h": 6, "w": 12, "x": 0, "y": 1}},
                    ],
                }
            ],
            "schemaVersion": 38,
            "timezone": "utc",
        }
        self.assertFalse(vgc.validate_dashboard_json(self._make_json(dash)))

    def test_invalid_json_syntax(self):
        """File with invalid JSON should return False."""
        path = self._make_raw('{"title": "Bad", "panels": [}')
        self.assertFalse(vgc.validate_dashboard_json(path))

    def test_invalid_json_trailing_comma(self):
        """File with trailing comma (invalid JSON) should return False."""
        path = self._make_raw('{"title": "Bad", "panels": [],}')
        self.assertFalse(vgc.validate_dashboard_json(path))


class TestMainFunction(unittest.TestCase):
    """Tests for the main() function."""

    def setUp(self):
        self.temp_files = []

    def tearDown(self):
        for f in self.temp_files:
            try:
                os.unlink(f)
            except OSError:
                pass

    def _make_yaml(self, content: str) -> str:
        fd, path = tempfile.mkstemp(suffix=".yml", text=True)
        with os.fdopen(fd, "w") as f:
            f.write(content)
        self.temp_files.append(path)
        return path

    def _make_json(self, data: dict) -> str:
        fd, path = tempfile.mkstemp(suffix=".json", text=True)
        with os.fdopen(fd, "w") as f:
            json.dump(data, f)
        self.temp_files.append(path)
        return path

    def test_no_args(self):
        """main() with no arguments should return 1."""
        with patch.object(sys, "argv", ["validate-grafana-configs.py"]):
            self.assertEqual(vgc.main(), 1)

    def test_valid_yaml_file(self):
        """main() with a single valid YAML file should return 0."""
        path = self._make_yaml("key: value\n")
        with patch.object(sys, "argv", ["prog", path]):
            self.assertEqual(vgc.main(), 0)

    def test_valid_json_file(self):
        """main() with a single valid dashboard JSON should return 0."""
        dash = {
            "title": "Test",
            "panels": [{"id": 1, "title": "P", "type": "stat", "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0}}],
            "schemaVersion": 38,
            "timezone": "utc",
        }
        path = self._make_json(dash)
        with patch.object(sys, "argv", ["prog", path]):
            self.assertEqual(vgc.main(), 0)

    def test_multiple_valid_files(self):
        """main() with multiple valid files should return 0."""
        yml = self._make_yaml("key: value\n")
        dash = {
            "title": "Multi",
            "panels": [{"id": 1, "title": "P", "type": "table", "gridPos": {"h": 4, "w": 6, "x": 0, "y": 0}}],
            "schemaVersion": 38,
            "timezone": "utc",
        }
        jsn = self._make_json(dash)
        with patch.object(sys, "argv", ["prog", yml, jsn]):
            self.assertEqual(vgc.main(), 0)

    def test_invalid_yaml_file(self):
        """main() with an invalid YAML file should return 1."""
        path = self._make_yaml("[unclosed\n")
        with patch.object(sys, "argv", ["prog", path]):
            self.assertEqual(vgc.main(), 1)

    def test_invalid_json_file(self):
        """main() with an invalid dashboard JSON should return 1."""
        dash = {"title": "Bad"}
        path = self._make_json(dash)
        with patch.object(sys, "argv", ["prog", path]):
            self.assertEqual(vgc.main(), 1)

    def test_mixed_valid_invalid(self):
        """main() with a mix of valid and invalid files should return 1."""
        valid = self._make_yaml("key: value\n")
        invalid = self._make_yaml("{unclosed\n")
        with patch.object(sys, "argv", ["prog", valid, invalid]):
            self.assertEqual(vgc.main(), 1)

    def test_unknown_extension(self):
        """main() with unknown extension should skip it and return 0."""
        fd, path = tempfile.mkstemp(suffix=".txt", text=True)
        with os.fdopen(fd, "w") as f:
            f.write("plain text")
        self.temp_files.append(path)
        with patch.object(sys, "argv", ["prog", path]):
            self.assertEqual(vgc.main(), 0)

    def test_unknown_extension_with_valid_file(self):
        """main() with unknown extension alongside a valid file should return 0."""
        yml = self._make_yaml("key: value\n")
        fd, path = tempfile.mkstemp(suffix=".log", text=True)
        with os.fdopen(fd, "w") as f:
            f.write("log data")
        self.temp_files.append(path)
        with patch.object(sys, "argv", ["prog", yml, path]):
            self.assertEqual(vgc.main(), 0)

    def test_no_cross_file_flag_on_valid_file(self):
        """main() with --no-cross-file and a valid datasource should return 0."""
        yml = (
            "apiVersion: 1\n"
            "datasources:\n"
            "  - name: Test\n"
            "    uid: test-ds\n"
            "    type: prometheus\n"
            "    access: proxy\n"
            "    url: http://test:9090\n"
        )
        path = self._make_yaml(yml)
        with patch.object(sys, "argv", ["prog", "--no-cross-file", path]):
            self.assertEqual(vgc.main(), 0)

    def test_no_cross_file_skips_cross_refs(self):
        """main() with --no-cross-file should skip cross-validation even when
        notification policies reference a receiver not in contact points."""
        # A notification policy that references a non-existent receiver
        policy = (
            "apiVersion: 1\n"
            "policies:\n"
            "  - receiver: NonExistentReceiver\n"
            "    group_by: [alertname]\n"
        )
        policy_path = self._make_yaml(policy)
        # Without --no-cross-file, this would fail cross-validation.
        # With --no-cross-file, it should pass individual validation.
        with patch.object(sys, "argv", ["prog", "--no-cross-file", policy_path]):
            self.assertEqual(vgc.main(), 0)

    def test_no_cross_file_flag_position_independent(self):
        """--no-cross-file should work regardless of position (before or after files)."""
        yml = (
            "apiVersion: 1\n"
            "datasources:\n"
            "  - name: Test\n"
            "    uid: test-ds\n"
            "    type: prometheus\n"
            "    access: proxy\n"
            "    url: http://test:9090\n"
        )
        path = self._make_yaml(yml)
        # Flag after file
        with patch.object(sys, "argv", ["prog", path, "--no-cross-file"]):
            self.assertEqual(vgc.main(), 0)

    def test_no_cross_file_with_invalid_file(self):
        """main() with --no-cross-file should still fail on invalid YAML."""
        path = self._make_yaml("[unclosed\n")
        with patch.object(sys, "argv", ["prog", "--no-cross-file", path]):
            self.assertEqual(vgc.main(), 1)

    def test_main_passing_argv_directly(self):
        """main() should accept argv as a parameter (not just sys.argv)."""
        yml = (
            "apiVersion: 1\n"
            "datasources:\n"
            "  - name: Test\n"
            "    uid: test-ds\n"
            "    type: prometheus\n"
            "    access: proxy\n"
            "    url: http://test:9090\n"
        )
        path = self._make_yaml(yml)
        # Pass argv directly instead of patching sys.argv
        result = vgc.main([path])
        self.assertEqual(result, 0)

    def test_main_argv_with_no_cross_file(self):
        """main() should accept argv with --no-cross-file directly."""
        yml = (
            "apiVersion: 1\n"
            "datasources:\n"
            "  - name: Test\n"
            "    uid: test-ds\n"
            "    type: prometheus\n"
            "    access: proxy\n"
            "    url: http://test:9090\n"
        )
        path = self._make_yaml(yml)
        result = vgc.main(["--no-cross-file", path])
        self.assertEqual(result, 0)


class TestValidateDatasourceYaml(unittest.TestCase):
    """Tests for the validate_datasource_yaml() function."""

    def setUp(self):
        self.temp_files = []

    def tearDown(self):
        for f in self.temp_files:
            try:
                os.unlink(f)
            except OSError:
                pass

    def _make_yaml(self, content: str) -> str:
        fd, path = tempfile.mkstemp(suffix=".yml", text=True)
        with os.fdopen(fd, "w") as f:
            f.write(content)
        self.temp_files.append(path)
        return path

    def _valid_datasource_yaml(self) -> str:
        """Create a temp file with a valid Prometheus datasource config."""
        return self._make_yaml(
            "apiVersion: 1\n"
            "datasources:\n"
            "  - name: Prometheus\n"
            "    uid: prometheus\n"
            "    type: prometheus\n"
            "    access: proxy\n"
            "    url: http://prometheus:9090\n"
            "    isDefault: true\n"
            "    editable: false\n"
            "    jsonData:\n"
            "      timeInterval: 15s\n"
            "      queryTimeout: 30s\n"
            "      httpMethod: POST\n"
        )

    def test_valid_prometheus_datasource(self):
        """A valid Prometheus datasource should return True."""
        path = self._valid_datasource_yaml()
        self.assertTrue(vgc.validate_datasource_yaml(path))

    def test_valid_multi_datasource(self):
        """Multiple datasources should all be valid."""
        yml = (
            "apiVersion: 1\n"
            "datasources:\n"
            "  - name: Prometheus\n"
            "    uid: prometheus\n"
            "    type: prometheus\n"
            "    access: proxy\n"
            "    url: http://prometheus:9090\n"
            "  - name: Loki\n"
            "    uid: loki\n"
            "    type: loki\n"
            "    access: proxy\n"
            "    url: http://loki:3100\n"
        )
        self.assertTrue(vgc.validate_datasource_yaml(self._make_yaml(yml)))

    def test_missing_api_version(self):
        """Missing apiVersion should return False."""
        yml = (
            "datasources:\n"
            "  - name: Test\n"
            "    type: prometheus\n"
            "    access: proxy\n"
            "    url: http://test:9090\n"
        )
        self.assertFalse(vgc.validate_datasource_yaml(self._make_yaml(yml)))

    def test_wrong_api_version(self):
        """apiVersion != 1 should return False."""
        yml = (
            "apiVersion: 2\n"
            "datasources:\n"
            "  - name: Test\n"
            "    type: prometheus\n"
            "    access: proxy\n"
            "    url: http://test:9090\n"
        )
        self.assertFalse(vgc.validate_datasource_yaml(self._make_yaml(yml)))

    def test_missing_datasources_key(self):
        """Missing 'datasources' key should return False."""
        yml = "apiVersion: 1\n"
        self.assertFalse(vgc.validate_datasource_yaml(self._make_yaml(yml)))

    def test_datasources_not_array(self):
        """Non-array datasources should return False."""
        yml = (
            "apiVersion: 1\n"
            "datasources: not-an-array\n"
        )
        self.assertFalse(vgc.validate_datasource_yaml(self._make_yaml(yml)))

    def test_empty_datasources(self):
        """Empty datasources array should return False."""
        yml = (
            "apiVersion: 1\n"
            "datasources:\n"
        )
        self.assertFalse(vgc.validate_datasource_yaml(self._make_yaml(yml)))

    def test_datasource_not_a_dict(self):
        """Datasource entry that is not a dict should return False."""
        yml = (
            "apiVersion: 1\n"
            "datasources:\n"
            "  - just a string\n"
        )
        self.assertFalse(vgc.validate_datasource_yaml(self._make_yaml(yml)))

    def test_missing_required_fields(self):
        """Datasource missing name, type, access, url should return False."""
        yml = (
            "apiVersion: 1\n"
            "datasources:\n"
            "  - uid: missing-fields\n"
        )
        self.assertFalse(vgc.validate_datasource_yaml(self._make_yaml(yml)))

    def test_missing_uid(self):
        """Missing uid warns (recommended) but does NOT fail validation."""
        yml = (
            "apiVersion: 1\n"
            "datasources:\n"
            "  - name: No UID\n"
            "    type: prometheus\n"
            "    access: proxy\n"
            "    url: http://test:9090\n"
        )
        self.assertFalse(vgc.validate_datasource_yaml(self._make_yaml(yml)))

    def test_unknown_datasource_type(self):
        """Unknown datasource type should return False."""
        yml = (
            "apiVersion: 1\n"
            "datasources:\n"
            "  - name: Fake\n"
            "    uid: fake\n"
            "    type: my-custom-db\n"
            "    access: proxy\n"
            "    url: http://fake:8080\n"
        )
        self.assertFalse(vgc.validate_datasource_yaml(self._make_yaml(yml)))

    def test_datasource_type_not_a_string(self):
        """Non-string datasource type should return False."""
        yml = (
            "apiVersion: 1\n"
            "datasources:\n"
            "  - name: Bad\n"
            "    uid: bad\n"
            "    type: 123\n"
            "    access: proxy\n"
            "    url: http://bad:9090\n"
        )
        self.assertFalse(vgc.validate_datasource_yaml(self._make_yaml(yml)))

    def test_invalid_access_mode(self):
        """Invalid access mode should return False."""
        yml = (
            "apiVersion: 1\n"
            "datasources:\n"
            "  - name: Test\n"
            "    uid: test\n"
            "    type: prometheus\n"
            "    access: invalid\n"
            "    url: http://test:9090\n"
        )
        self.assertFalse(vgc.validate_datasource_yaml(self._make_yaml(yml)))

    def test_access_not_a_string(self):
        """Non-string access mode should return False."""
        yml = (
            "apiVersion: 1\n"
            "datasources:\n"
            "  - name: Test\n"
            "    uid: test\n"
            "    type: prometheus\n"
            "    access: true\n"
            "    url: http://test:9090\n"
        )
        self.assertFalse(vgc.validate_datasource_yaml(self._make_yaml(yml)))

    def test_valid_access_modes(self):
        """proxy, direct, and browser access modes should all be valid."""
        for mode in ["proxy", "direct", "browser"]:
            yml = (
                "apiVersion: 1\n"
                "datasources:\n"
                f"  - name: Test {mode}\n"
                f"    uid: test-{mode}\n"
                "    type: prometheus\n"
                f"    access: {mode}\n"
                "    url: http://test:9090\n"
            )
            self.assertTrue(
                vgc.validate_datasource_yaml(self._make_yaml(yml)),
                f"Access mode {mode!r} should be valid",
            )

    def test_url_empty_string(self):
        """Empty url should return False."""
        yml = (
            "apiVersion: 1\n"
            "datasources:\n"
            "  - name: Test\n"
            "    uid: test\n"
            "    type: prometheus\n"
            "    access: proxy\n"
            "    url: \"\"\n"
        )
        self.assertFalse(vgc.validate_datasource_yaml(self._make_yaml(yml)))

    def test_isdefault_bool_valid(self):
        """isDefault: true should be valid."""
        yml = (
            "apiVersion: 1\n"
            "datasources:\n"
            "  - name: Default\n"
            "    uid: default\n"
            "    type: prometheus\n"
            "    access: proxy\n"
            "    url: http://test:9090\n"
            "    isDefault: true\n"
        )
        self.assertTrue(vgc.validate_datasource_yaml(self._make_yaml(yml)))

    def test_isdefault_not_bool(self):
        """Non-bool isDefault should return False."""
        yml = (
            "apiVersion: 1\n"
            "datasources:\n"
            "  - name: Default\n"
            "    uid: default\n"
            "    type: prometheus\n"
            "    access: proxy\n"
            "    url: http://test:9090\n"
            "    isDefault: \"yes\"\n"
        )
        self.assertFalse(vgc.validate_datasource_yaml(self._make_yaml(yml)))

    def test_editable_not_bool(self):
        """Non-bool editable should return False."""
        yml = (
            "apiVersion: 1\n"
            "datasources:\n"
            "  - name: Test\n"
            "    uid: test\n"
            "    type: prometheus\n"
            "    access: proxy\n"
            "    url: http://test:9090\n"
            "    editable: \"no\"\n"
        )
        self.assertFalse(vgc.validate_datasource_yaml(self._make_yaml(yml)))

    def test_jsonData_not_a_dict(self):
        """Non-dict jsonData should return False."""
        yml = (
            "apiVersion: 1\n"
            "datasources:\n"
            "  - name: Test\n"
            "    uid: test\n"
            "    type: prometheus\n"
            "    access: proxy\n"
            "    url: http://test:9090\n"
            "    jsonData: \"string\"\n"
        )
        self.assertFalse(vgc.validate_datasource_yaml(self._make_yaml(yml)))

    def test_jsonData_valid_object(self):
        """A valid jsonData object should pass."""
        yml = (
            "apiVersion: 1\n"
            "datasources:\n"
            "  - name: Prometheus\n"
            "    uid: prometheus\n"
            "    type: prometheus\n"
            "    access: proxy\n"
            "    url: http://prometheus:9090\n"
            "    jsonData:\n"
            "      timeInterval: 15s\n"
            "      queryTimeout: 30s\n"
        )
        self.assertTrue(vgc.validate_datasource_yaml(self._make_yaml(yml)))

    def test_missing_file(self):
        """Non-existent file should return False (graceful error)."""
        self.assertFalse(vgc.validate_datasource_yaml("/tmp/nonexistent_datasource.yml"))

    def test_invalid_yaml_syntax(self):
        """File with invalid YAML syntax should return False."""
        path = self._make_yaml("[unclosed\n")
        self.assertFalse(vgc.validate_datasource_yaml(path))


class TestValidateDashboardProviderYaml(unittest.TestCase):
    """Tests for the validate_dashboard_provider_yaml() function."""

    def setUp(self):
        self.temp_files = []

    def tearDown(self):
        for f in self.temp_files:
            try:
                os.unlink(f)
            except OSError:
                pass

    def _make_yaml(self, content: str) -> str:
        fd, path = tempfile.mkstemp(suffix=".yml", text=True)
        with os.fdopen(fd, "w") as f:
            f.write(content)
        self.temp_files.append(path)
        return path

    def _valid_provider_yaml(self) -> str:
        """Create a temp file with a valid dashboard provider config."""
        return self._make_yaml(
            "apiVersion: 1\n"
            "providers:\n"
            "  - name: Toroloom\n"
            "    orgId: 1\n"
            "    type: file\n"
            "    disableDeletion: false\n"
            "    updateIntervalSeconds: 60\n"
            "    allowUiUpdates: true\n"
            "    options:\n"
            "      path: /var/lib/grafana/dashboards\n"
            "      foldersFromFilesStructure: false\n"
        )

    def test_valid_dashboard_provider(self):
        """A valid dashboard provider should return True."""
        self.assertTrue(vgc.validate_dashboard_provider_yaml(self._valid_provider_yaml()))

    def test_valid_multi_provider(self):
        """Multiple providers should all be valid."""
        yml = (
            "apiVersion: 1\n"
            "providers:\n"
            "  - name: Toroloom\n"
            "    type: file\n"
            "    options:\n"
            "      path: /dashboards/a\n"
            "  - name: Custom\n"
            "    type: file\n"
            "    options:\n"
            "      path: /dashboards/b\n"
        )
        self.assertTrue(vgc.validate_dashboard_provider_yaml(self._make_yaml(yml)))

    def test_missing_api_version(self):
        """Missing apiVersion should return False."""
        yml = (
            "providers:\n"
            "  - name: Test\n"
            "    type: file\n"
            "    options:\n"
            "      path: /test\n"
        )
        self.assertFalse(vgc.validate_dashboard_provider_yaml(self._make_yaml(yml)))

    def test_wrong_api_version(self):
        """apiVersion != 1 should return False."""
        yml = (
            "apiVersion: 2\n"
            "providers:\n"
            "  - name: Test\n"
            "    type: file\n"
            "    options:\n"
            "      path: /test\n"
        )
        self.assertFalse(vgc.validate_dashboard_provider_yaml(self._make_yaml(yml)))

    def test_missing_providers_key(self):
        """Missing 'providers' key should return False."""
        yml = "apiVersion: 1\n"
        self.assertFalse(vgc.validate_dashboard_provider_yaml(self._make_yaml(yml)))

    def test_providers_not_array(self):
        """Non-array providers should return False."""
        yml = (
            "apiVersion: 1\n"
            "providers: not-an-array\n"
        )
        self.assertFalse(vgc.validate_dashboard_provider_yaml(self._make_yaml(yml)))

    def test_empty_providers(self):
        """Empty providers array should return False."""
        yml = (
            "apiVersion: 1\n"
            "providers:\n"
        )
        self.assertFalse(vgc.validate_dashboard_provider_yaml(self._make_yaml(yml)))

    def test_provider_not_a_dict(self):
        """Provider entry that is not a dict should return False."""
        yml = (
            "apiVersion: 1\n"
            "providers:\n"
            "  - just a string\n"
        )
        self.assertFalse(vgc.validate_dashboard_provider_yaml(self._make_yaml(yml)))

    def test_missing_name(self):
        """Provider missing name should return False."""
        yml = (
            "apiVersion: 1\n"
            "providers:\n"
            "  - type: file\n"
            "    options:\n"
            "      path: /test\n"
        )
        self.assertFalse(vgc.validate_dashboard_provider_yaml(self._make_yaml(yml)))

    def test_unknown_provider_type(self):
        """Unknown provider type should return False."""
        yml = (
            "apiVersion: 1\n"
            "providers:\n"
            "  - name: Test\n"
            "    type: grafana\n"
            "    options:\n"
            "      path: /test\n"
        )
        self.assertFalse(vgc.validate_dashboard_provider_yaml(self._make_yaml(yml)))

    def test_provider_type_not_a_string(self):
        """Non-string provider type should return False."""
        yml = (
            "apiVersion: 1\n"
            "providers:\n"
            "  - name: Bad\n"
            "    type: 123\n"
            "    options:\n"
            "      path: /test\n"
        )
        self.assertFalse(vgc.validate_dashboard_provider_yaml(self._make_yaml(yml)))

    def test_orgId_not_int(self):
        """Non-integer orgId should return False."""
        yml = (
            "apiVersion: 1\n"
            "providers:\n"
            "  - name: Test\n"
            "    orgId: \"one\"\n"
            "    type: file\n"
            "    options:\n"
            "      path: /test\n"
        )
        self.assertFalse(vgc.validate_dashboard_provider_yaml(self._make_yaml(yml)))

    def test_orgId_zero(self):
        """orgId = 0 should return False (must be >= 1)."""
        yml = (
            "apiVersion: 1\n"
            "providers:\n"
            "  - name: Test\n"
            "    orgId: 0\n"
            "    type: file\n"
            "    options:\n"
            "      path: /test\n"
        )
        self.assertFalse(vgc.validate_dashboard_provider_yaml(self._make_yaml(yml)))

    def test_disableDeletion_not_bool(self):
        """Non-bool disableDeletion should return False."""
        yml = (
            "apiVersion: 1\n"
            "providers:\n"
            "  - name: Test\n"
            "    disableDeletion: 1\n"
            "    type: file\n"
            "    options:\n"
            "      path: /test\n"
        )
        self.assertFalse(vgc.validate_dashboard_provider_yaml(self._make_yaml(yml)))

    def test_updateIntervalSeconds_not_int(self):
        """Non-integer updateIntervalSeconds should return False."""
        yml = (
            "apiVersion: 1\n"
            "providers:\n"
            "  - name: Test\n"
            "    updateIntervalSeconds: \"fast\"\n"
            "    type: file\n"
            "    options:\n"
            "      path: /test\n"
        )
        self.assertFalse(vgc.validate_dashboard_provider_yaml(self._make_yaml(yml)))

    def test_allowUiUpdates_not_bool(self):
        """Non-bool allowUiUpdates should return False."""
        yml = (
            "apiVersion: 1\n"
            "providers:\n"
            "  - name: Test\n"
            "    allowUiUpdates: 1\n"
            "    type: file\n"
            "    options:\n"
            "      path: /test\n"
        )
        self.assertFalse(vgc.validate_dashboard_provider_yaml(self._make_yaml(yml)))

    def test_options_missing_path(self):
        """options missing path should return False."""
        yml = (
            "apiVersion: 1\n"
            "providers:\n"
            "  - name: Test\n"
            "    type: file\n"
            "    options:\n"
            "      foldersFromFilesStructure: false\n"
        )
        self.assertFalse(vgc.validate_dashboard_provider_yaml(self._make_yaml(yml)))

    def test_options_path_empty(self):
        """options.path empty should return False."""
        yml = (
            "apiVersion: 1\n"
            "providers:\n"
            "  - name: Test\n"
            "    type: file\n"
            "    options:\n"
            "      path: \"\"\n"
        )
        self.assertFalse(vgc.validate_dashboard_provider_yaml(self._make_yaml(yml)))

    def test_options_not_a_dict(self):
        """Non-dict options should return False."""
        yml = (
            "apiVersion: 1\n"
            "providers:\n"
            "  - name: Test\n"
            "    type: file\n"
            "    options: \"string\"\n"
        )
        self.assertFalse(vgc.validate_dashboard_provider_yaml(self._make_yaml(yml)))

    def test_foldersFromFilesStructure_not_bool(self):
        """Non-bool foldersFromFilesStructure should return False."""
        yml = (
            "apiVersion: 1\n"
            "providers:\n"
            "  - name: Test\n"
            "    type: file\n"
            "    options:\n"
            "      path: /test\n"
            "      foldersFromFilesStructure: \"hello\"\n"
        )
        self.assertFalse(vgc.validate_dashboard_provider_yaml(self._make_yaml(yml)))

    def test_missing_file(self):
        """Non-existent file should return False (graceful error)."""
        self.assertFalse(vgc.validate_dashboard_provider_yaml("/tmp/nonexistent_provider.yml"))

    def test_invalid_yaml_syntax(self):
        """File with invalid YAML syntax should return False."""
        path = self._make_yaml("[unclosed\n")
        self.assertFalse(vgc.validate_dashboard_provider_yaml(path))


class TestValidateContactPointsYaml(unittest.TestCase):
    """Tests for the validate_contact_points_yaml() function."""

    def setUp(self):
        self.temp_files = []

    def tearDown(self):
        for f in self.temp_files:
            try:
                os.unlink(f)
            except OSError:
                pass

    def _make_yaml(self, content: str) -> str:
        fd, path = tempfile.mkstemp(suffix=".yml", text=True)
        with os.fdopen(fd, "w") as f:
            f.write(content)
        self.temp_files.append(path)
        return path

    def _valid_contact_points_yaml(self) -> str:
        """Create a temp file with valid Slack + PagerDuty contact points."""
        return self._make_yaml(
            "apiVersion: 1\n"
            "contactPoints:\n"
            "  - orgId: 1\n"
            "    name: Slack Alerts\n"
            "    receivers:\n"
            "      - uid: slack-main\n"
            "        type: slack\n"
            "        settings:\n"
            "          url: https://hooks.slack.com/services/T00/B00/xxx\n"
            "          title: Alert\n"
            "          text: Description\n"
            "        disableResolveMessage: false\n"
            "  - orgId: 1\n"
            "    name: PagerDuty Alerts\n"
            "    receivers:\n"
            "      - uid: pd-main\n"
            "        type: pagerduty\n"
            "        settings:\n"
            "          integrationKey: abc123def456\n"
            "          severity: critical\n"
        )

    def test_valid_contact_points(self):
        """Valid Slack + PagerDuty contact points should return True."""
        self.assertTrue(vgc.validate_contact_points_yaml(self._valid_contact_points_yaml()))

    def test_valid_single_contact_point(self):
        """A single contact point should be valid."""
        yml = (
            "apiVersion: 1\n"
            "contactPoints:\n"
            "  - name: Email Alerts\n"
            "    receivers:\n"
            "      - uid: email-main\n"
            "        type: email\n"
            "        settings:\n"
            "          addresses: admin@example.com\n"
        )
        self.assertTrue(vgc.validate_contact_points_yaml(self._make_yaml(yml)))

    def test_missing_api_version(self):
        """Missing apiVersion should return False."""
        yml = (
            "contactPoints:\n"
            "  - name: Test\n"
            "    receivers:\n"
            "      - uid: test\n"
            "        type: slack\n"
            "        settings:\n"
            "          url: http://hook\n"
        )
        self.assertFalse(vgc.validate_contact_points_yaml(self._make_yaml(yml)))

    def test_missing_contactpoints_key(self):
        """Missing 'contactPoints' key should return False."""
        yml = "apiVersion: 1\n"
        self.assertFalse(vgc.validate_contact_points_yaml(self._make_yaml(yml)))

    def test_contactpoints_not_array(self):
        """Non-array contactPoints should return False."""
        yml = (
            "apiVersion: 1\n"
            "contactPoints: not-an-array\n"
        )
        self.assertFalse(vgc.validate_contact_points_yaml(self._make_yaml(yml)))

    def test_empty_contactpoints(self):
        """Empty contactPoints array should return False."""
        yml = (
            "apiVersion: 1\n"
            "contactPoints:\n"
        )
        self.assertFalse(vgc.validate_contact_points_yaml(self._make_yaml(yml)))

    def test_cp_not_a_dict(self):
        """Contact point that is not a dict should return False."""
        yml = (
            "apiVersion: 1\n"
            "contactPoints:\n"
            "  - just a string\n"
        )
        self.assertFalse(vgc.validate_contact_points_yaml(self._make_yaml(yml)))

    def test_missing_name(self):
        """Contact point missing name should return False."""
        yml = (
            "apiVersion: 1\n"
            "contactPoints:\n"
            "  - orgId: 1\n"
            "    receivers:\n"
            "      - uid: test\n"
            "        type: slack\n"
            "        settings:\n"
            "          url: http://hook\n"
        )
        self.assertFalse(vgc.validate_contact_points_yaml(self._make_yaml(yml)))

    def test_missing_receivers(self):
        """Contact point missing receivers should return False."""
        yml = (
            "apiVersion: 1\n"
            "contactPoints:\n"
            "  - name: Test\n"
        )
        self.assertFalse(vgc.validate_contact_points_yaml(self._make_yaml(yml)))

    def test_receivers_not_array(self):
        """Non-array receivers should return False."""
        yml = (
            "apiVersion: 1\n"
            "contactPoints:\n"
            "  - name: Test\n"
            "    receivers: not-array\n"
        )
        self.assertFalse(vgc.validate_contact_points_yaml(self._make_yaml(yml)))

    def test_empty_receivers(self):
        """Empty receivers array should return False."""
        yml = (
            "apiVersion: 1\n"
            "contactPoints:\n"
            "  - name: Test\n"
            "    receivers:\n"
        )
        self.assertFalse(vgc.validate_contact_points_yaml(self._make_yaml(yml)))

    def test_receiver_not_a_dict(self):
        """Receiver that is not a dict should return False."""
        yml = (
            "apiVersion: 1\n"
            "contactPoints:\n"
            "  - name: Test\n"
            "    receivers:\n"
            "      - just a string\n"
        )
        self.assertFalse(vgc.validate_contact_points_yaml(self._make_yaml(yml)))

    def test_receiver_missing_uid(self):
        """Receiver missing uid should return False."""
        yml = (
            "apiVersion: 1\n"
            "contactPoints:\n"
            "  - name: Test\n"
            "    receivers:\n"
            "      - type: slack\n"
            "        settings:\n"
            "          url: http://hook\n"
        )
        self.assertFalse(vgc.validate_contact_points_yaml(self._make_yaml(yml)))

    def test_receiver_missing_type(self):
        """Receiver missing type should return False."""
        yml = (
            "apiVersion: 1\n"
            "contactPoints:\n"
            "  - name: Test\n"
            "    receivers:\n"
            "      - uid: test\n"
            "        settings:\n"
            "          url: http://hook\n"
        )
        self.assertFalse(vgc.validate_contact_points_yaml(self._make_yaml(yml)))

    def test_unknown_receiver_type(self):
        """Unknown receiver type should return False."""
        yml = (
            "apiVersion: 1\n"
            "contactPoints:\n"
            "  - name: Test\n"
            "    receivers:\n"
            "      - uid: test\n"
            "        type: my-custom-notifier\n"
            "        settings:\n"
            "          url: http://hook\n"
        )
        self.assertFalse(vgc.validate_contact_points_yaml(self._make_yaml(yml)))

    def test_receiver_type_not_string(self):
        """Non-string receiver type should return False."""
        yml = (
            "apiVersion: 1\n"
            "contactPoints:\n"
            "  - name: Test\n"
            "    receivers:\n"
            "      - uid: test\n"
            "        type: 123\n"
            "        settings:\n"
            "          url: http://hook\n"
        )
        self.assertFalse(vgc.validate_contact_points_yaml(self._make_yaml(yml)))

    def test_slack_missing_url(self):
        """Slack receiver missing url should return False."""
        yml = (
            "apiVersion: 1\n"
            "contactPoints:\n"
            "  - name: Slack Test\n"
            "    receivers:\n"
            "      - uid: slack-test\n"
            "        type: slack\n"
            "        settings:\n"
            "          title: Alert\n"
        )
        self.assertFalse(vgc.validate_contact_points_yaml(self._make_yaml(yml)))

    def test_slack_url_empty(self):
        """Slack receiver with empty url should return False."""
        yml = (
            "apiVersion: 1\n"
            "contactPoints:\n"
            "  - name: Slack Test\n"
            "    receivers:\n"
            "      - uid: slack-test\n"
            "        type: slack\n"
            "        settings:\n"
            "          url: \"\"\n"
        )
        self.assertFalse(vgc.validate_contact_points_yaml(self._make_yaml(yml)))

    def test_pagerduty_missing_integration_key(self):
        """PagerDuty receiver missing integrationKey should return False."""
        yml = (
            "apiVersion: 1\n"
            "contactPoints:\n"
            "  - name: PD Test\n"
            "    receivers:\n"
            "      - uid: pd-test\n"
            "        type: pagerduty\n"
            "        settings:\n"
            "          severity: critical\n"
        )
        self.assertFalse(vgc.validate_contact_points_yaml(self._make_yaml(yml)))

    def test_pagerduty_key_empty(self):
        """PagerDuty receiver with empty integrationKey should return False."""
        yml = (
            "apiVersion: 1\n"
            "contactPoints:\n"
            "  - name: PD Test\n"
            "    receivers:\n"
            "      - uid: pd-test\n"
            "        type: pagerduty\n"
            "        settings:\n"
            "          integrationKey: \"\"\n"
        )
        self.assertFalse(vgc.validate_contact_points_yaml(self._make_yaml(yml)))

    def test_webhook_missing_url(self):
        """Webhook receiver missing url should return False."""
        yml = (
            "apiVersion: 1\n"
            "contactPoints:\n"
            "  - name: Webhook Test\n"
            "    receivers:\n"
            "      - uid: wh-test\n"
            "        type: webhook\n"
            "        settings:\n"
            "          httpMethod: POST\n"
        )
        self.assertFalse(vgc.validate_contact_points_yaml(self._make_yaml(yml)))

    def test_slack_missing_settings(self):
        """Slack receiver with no 'settings' key should return False."""
        yml = (
            "apiVersion: 1\n"
            "contactPoints:\n"
            "  - name: Slack Test\n"
            "    receivers:\n"
            "      - uid: slack-test\n"
            "        type: slack\n"
        )
        self.assertFalse(vgc.validate_contact_points_yaml(self._make_yaml(yml)))

    def test_pagerduty_missing_settings(self):
        """PagerDuty receiver with no 'settings' key should return False."""
        yml = (
            "apiVersion: 1\n"
            "contactPoints:\n"
            "  - name: PD Test\n"
            "    receivers:\n"
            "      - uid: pd-test\n"
            "        type: pagerduty\n"
        )
        self.assertFalse(vgc.validate_contact_points_yaml(self._make_yaml(yml)))

    def test_webhook_missing_settings(self):
        """Webhook receiver with no 'settings' key should return False."""
        yml = (
            "apiVersion: 1\n"
            "contactPoints:\n"
            "  - name: Webhook Test\n"
            "    receivers:\n"
            "      - uid: wh-test\n"
            "        type: webhook\n"
        )
        self.assertFalse(vgc.validate_contact_points_yaml(self._make_yaml(yml)))

    def test_email_receiver_ok_without_settings(self):
        """Email receiver without settings key should still be valid (no settings check required)."""
        yml = (
            "apiVersion: 1\n"
            "contactPoints:\n"
            "  - name: Email Test\n"
            "    receivers:\n"
            "      - uid: email-test\n"
            "        type: email\n"
        )
        # Email is not in settings_required_types, so missing settings is not an error
        # But without addresses, settings is still optional for email
        self.assertTrue(vgc.validate_contact_points_yaml(self._make_yaml(yml)))

    def test_settings_not_a_dict(self):
        """Receiver with non-dict settings should return False."""
        yml = (
            "apiVersion: 1\n"
            "contactPoints:\n"
            "  - name: Test\n"
            "    receivers:\n"
            "      - uid: test\n"
            "        type: slack\n"
            "        settings: \"string\"\n"
        )
        self.assertFalse(vgc.validate_contact_points_yaml(self._make_yaml(yml)))

    def test_disableResolveMessage_not_bool(self):
        """Non-bool disableResolveMessage should return False."""
        yml = (
            "apiVersion: 1\n"
            "contactPoints:\n"
            "  - name: Test\n"
            "    receivers:\n"
            "      - uid: test\n"
            "        type: slack\n"
            "        settings:\n"
            "          url: http://hook\n"
            "        disableResolveMessage: 1\n"
        )
        self.assertFalse(vgc.validate_contact_points_yaml(self._make_yaml(yml)))

    def test_orgId_not_int(self):
        """Non-integer orgId should return False."""
        yml = (
            "apiVersion: 1\n"
            "contactPoints:\n"
            "  - name: Test\n"
            "    orgId: \"one\"\n"
            "    receivers:\n"
            "      - uid: test\n"
            "        type: slack\n"
            "        settings:\n"
            "          url: http://hook\n"
        )
        self.assertFalse(vgc.validate_contact_points_yaml(self._make_yaml(yml)))

    def test_missing_file(self):
        """Non-existent file should return False (graceful error)."""
        self.assertFalse(vgc.validate_contact_points_yaml("/tmp/nonexistent_contact_points.yml"))

    def test_invalid_yaml_syntax(self):
        """File with invalid YAML syntax should return False."""
        path = self._make_yaml("[unclosed\n")
        self.assertFalse(vgc.validate_contact_points_yaml(path))


class TestValidateNotificationPoliciesYaml(unittest.TestCase):
    """Tests for the validate_notification_policies_yaml() function."""

    def setUp(self):
        self.temp_files = []

    def tearDown(self):
        for f in self.temp_files:
            try:
                os.unlink(f)
            except OSError:
                pass

    def _make_yaml(self, content: str) -> str:
        fd, path = tempfile.mkstemp(suffix=".yml", text=True)
        with os.fdopen(fd, "w") as f:
            f.write(content)
        self.temp_files.append(path)
        return path

    def _valid_policy_yaml(self) -> str:
        """Create a temp file with a valid notification policy (matching the real notification_policies.yml)."""
        return self._make_yaml(
            "apiVersion: 1\n"
            "policies:\n"
            "  - orgId: 1\n"
            "    receiver: Slack WebSocket Alerts\n"
            "    group_by:\n"
            "      - alertname\n"
            "      - severity\n"
            "      - service\n"
            "    group_wait: 30s\n"
            "    group_interval: 5m\n"
            "    repeat_interval: 4h\n"
            "    routes:\n"
            "      - receiver: PagerDuty WebSocket Alerts\n"
            "        object_matchers:\n"
            "          - ['severity', '=', 'critical']\n"
            "        continue: true\n"
            "        group_wait: 15s\n"
            "        group_interval: 2m\n"
            "        repeat_interval: 1h\n"
        )

    def test_valid_policy(self):
        """A valid notification policy with receiver, group_by, timers, and nested route should return True."""
        self.assertTrue(vgc.validate_notification_policies_yaml(self._valid_policy_yaml()))

    def test_valid_policy_no_routes(self):
        """A top-level policy without routes should be valid."""
        yml = (
            "apiVersion: 1\n"
            "policies:\n"
            "  - receiver: Simple Alerts\n"
            "    group_by:\n"
            "      - alertname\n"
            "    group_wait: 30s\n"
            "    group_interval: 5m\n"
            "    repeat_interval: 4h\n"
        )
        self.assertTrue(vgc.validate_notification_policies_yaml(self._make_yaml(yml)))

    def test_valid_policy_with_matchers(self):
        """Policy using legacy string matchers should be valid."""
        yml = (
            "apiVersion: 1\n"
            "policies:\n"
            "  - receiver: Test\n"
            "    matchers:\n"
            "      - severity=critical\n"
            "      - service!=test\n"
        )
        self.assertTrue(vgc.validate_notification_policies_yaml(self._make_yaml(yml)))

    def test_missing_api_version(self):
        """Missing apiVersion should return False."""
        yml = (
            "policies:\n"
            "  - receiver: Test\n"
        )
        self.assertFalse(vgc.validate_notification_policies_yaml(self._make_yaml(yml)))

    def test_wrong_api_version(self):
        """apiVersion != 1 should return False."""
        yml = (
            "apiVersion: 2\n"
            "policies:\n"
            "  - receiver: Test\n"
        )
        self.assertFalse(vgc.validate_notification_policies_yaml(self._make_yaml(yml)))

    def test_missing_policies_key(self):
        """Missing 'policies' key should return False."""
        yml = "apiVersion: 1\n"
        self.assertFalse(vgc.validate_notification_policies_yaml(self._make_yaml(yml)))

    def test_policies_not_array(self):
        """Non-array policies should return False."""
        yml = (
            "apiVersion: 1\n"
            "policies: not-an-array\n"
        )
        self.assertFalse(vgc.validate_notification_policies_yaml(self._make_yaml(yml)))

    def test_empty_policies(self):
        """Empty policies array should return False."""
        yml = (
            "apiVersion: 1\n"
            "policies:\n"
        )
        self.assertFalse(vgc.validate_notification_policies_yaml(self._make_yaml(yml)))

    def test_policy_not_a_dict(self):
        """Policy entry that is not a dict should return False."""
        yml = (
            "apiVersion: 1\n"
            "policies:\n"
            "  - just a string\n"
        )
        self.assertFalse(vgc.validate_notification_policies_yaml(self._make_yaml(yml)))

    def test_missing_receiver(self):
        """Policy missing receiver should return False."""
        yml = (
            "apiVersion: 1\n"
            "policies:\n"
            "  - orgId: 1\n"
            "    group_by:\n"
            "      - alertname\n"
        )
        self.assertFalse(vgc.validate_notification_policies_yaml(self._make_yaml(yml)))

    def test_receiver_empty_string(self):
        """Policy with empty receiver should return False."""
        yml = (
            "apiVersion: 1\n"
            "policies:\n"
            "  - receiver: \"\"\n"
        )
        self.assertFalse(vgc.validate_notification_policies_yaml(self._make_yaml(yml)))

    def test_receiver_not_string(self):
        """Policy with non-string receiver should return False."""
        yml = (
            "apiVersion: 1\n"
            "policies:\n"
            "  - receiver: 123\n"
        )
        self.assertFalse(vgc.validate_notification_policies_yaml(self._make_yaml(yml)))

    def test_orgId_not_int(self):
        """Non-integer orgId should return False."""
        yml = (
            "apiVersion: 1\n"
            "policies:\n"
            "  - receiver: Test\n"
            "    orgId: \"one\"\n"
        )
        self.assertFalse(vgc.validate_notification_policies_yaml(self._make_yaml(yml)))

    def test_group_by_not_array(self):
        """Non-array group_by should return False."""
        yml = (
            "apiVersion: 1\n"
            "policies:\n"
            "  - receiver: Test\n"
            "    group_by: not-an-array\n"
        )
        self.assertFalse(vgc.validate_notification_policies_yaml(self._make_yaml(yml)))

    def test_group_by_element_not_string(self):
        """group_by element that is not a string should return False."""
        yml = (
            "apiVersion: 1\n"
            "policies:\n"
            "  - receiver: Test\n"
            "    group_by:\n"
            "      - alertname\n"
            "      - 123\n"
        )
        self.assertFalse(vgc.validate_notification_policies_yaml(self._make_yaml(yml)))

    def test_duration_not_string(self):
        """Duration field as non-string should return False."""
        yml = (
            "apiVersion: 1\n"
            "policies:\n"
            "  - receiver: Test\n"
            "    group_wait: 30\n"
        )
        self.assertFalse(vgc.validate_notification_policies_yaml(self._make_yaml(yml)))

    def test_duration_empty(self):
        """Empty duration string should return False."""
        yml = (
            "apiVersion: 1\n"
            "policies:\n"
            "  - receiver: Test\n"
            "    group_wait: \"\"\n"
        )
        self.assertFalse(vgc.validate_notification_policies_yaml(self._make_yaml(yml)))

    def test_duration_bad_format(self):
        """Malformed duration string should return False."""
        yml = (
            "apiVersion: 1\n"
            "policies:\n"
            "  - receiver: Test\n"
            "    group_interval: five-minutes\n"
        )
        self.assertFalse(vgc.validate_notification_policies_yaml(self._make_yaml(yml)))

    def test_duration_valid_all_units(self):
        """All valid duration units should pass."""
        for dur in ("30s", "5m", "4h", "1d", "2w"):
            yml = (
                "apiVersion: 1\n"
                "policies:\n"
                "  - receiver: Test\n"
                f"    repeat_interval: {dur}\n"
            )
            self.assertTrue(
                vgc.validate_notification_policies_yaml(self._make_yaml(yml)),
                f"Duration {dur!r} should be valid",
            )

    def test_continue_not_bool(self):
        """Non-bool continue should return False."""
        yml = (
            "apiVersion: 1\n"
            "policies:\n"
            "  - receiver: Test\n"
            "    continue: \"yes\"\n"
        )
        self.assertFalse(vgc.validate_notification_policies_yaml(self._make_yaml(yml)))

    def test_object_matchers_not_array(self):
        """Non-array object_matchers should return False."""
        yml = (
            "apiVersion: 1\n"
            "policies:\n"
            "  - receiver: Test\n"
            "    object_matchers: not-array\n"
        )
        self.assertFalse(vgc.validate_notification_policies_yaml(self._make_yaml(yml)))

    def test_object_matcher_not_array(self):
        """object_matchers element must be an array."""
        yml = (
            "apiVersion: 1\n"
            "policies:\n"
            "  - receiver: Test\n"
            "    object_matchers:\n"
            "      - not-an-array\n"
        )
        self.assertFalse(vgc.validate_notification_policies_yaml(self._make_yaml(yml)))

    def test_object_matcher_wrong_length(self):
        """object_matchers element must have exactly 3 items."""
        yml = (
            "apiVersion: 1\n"
            "policies:\n"
            "  - receiver: Test\n"
            "    object_matchers:\n"
            "      - ['severity', '=', 'critical', 'extra']\n"
        )
        self.assertFalse(vgc.validate_notification_policies_yaml(self._make_yaml(yml)))

    def test_object_matcher_bad_operator(self):
        """Invalid operator in object_matchers should return False."""
        yml = (
            "apiVersion: 1\n"
            "policies:\n"
            "  - receiver: Test\n"
            "    object_matchers:\n"
            "      - ['severity', '>', 'critical']\n"
        )
        self.assertFalse(vgc.validate_notification_policies_yaml(self._make_yaml(yml)))

    def test_object_matcher_key_not_string(self):
        """object_matchers key must be a string."""
        yml = (
            "apiVersion: 1\n"
            "policies:\n"
            "  - receiver: Test\n"
            "    object_matchers:\n"
            "      - [123, '=', 'critical']\n"
        )
        self.assertFalse(vgc.validate_notification_policies_yaml(self._make_yaml(yml)))

    def test_object_matcher_value_not_string(self):
        """object_matchers value must be a string."""
        yml = (
            "apiVersion: 1\n"
            "policies:\n"
            "  - receiver: Test\n"
            "    object_matchers:\n"
            "      - ['severity', '=', 123]\n"
        )
        self.assertFalse(vgc.validate_notification_policies_yaml(self._make_yaml(yml)))

    def test_matchers_not_array(self):
        """Non-array matchers (legacy string format) should return False."""
        yml = (
            "apiVersion: 1\n"
            "policies:\n"
            "  - receiver: Test\n"
            "    matchers: not-array\n"
        )
        self.assertFalse(vgc.validate_notification_policies_yaml(self._make_yaml(yml)))

    def test_matcher_bad_format(self):
        """Legacy matcher string with bad format should return False."""
        yml = (
            "apiVersion: 1\n"
            "policies:\n"
            "  - receiver: Test\n"
            "    matchers:\n"
            "      - invalid!format\n"
        )
        self.assertFalse(vgc.validate_notification_policies_yaml(self._make_yaml(yml)))

    def test_routes_not_array(self):
        """Non-array routes should return False."""
        yml = (
            "apiVersion: 1\n"
            "policies:\n"
            "  - receiver: Test\n"
            "    routes: not-array\n"
        )
        self.assertFalse(vgc.validate_notification_policies_yaml(self._make_yaml(yml)))

    def test_route_not_a_dict(self):
        """Route entry that is not a dict should return False."""
        yml = (
            "apiVersion: 1\n"
            "policies:\n"
            "  - receiver: Test\n"
            "    routes:\n"
            "      - just a string\n"
        )
        self.assertFalse(vgc.validate_notification_policies_yaml(self._make_yaml(yml)))

    def test_deep_nesting(self):
        """Deep nesting (3 levels) should still be valid."""
        yml = (
            "apiVersion: 1\n"
            "policies:\n"
            "  - receiver: Root\n"
            "    routes:\n"
            "      - receiver: Level1\n"
            "        routes:\n"
            "          - receiver: Level2\n"
            "            object_matchers:\n"
            "              - ['severity', '=', 'critical']\n"
        )
        self.assertTrue(vgc.validate_notification_policies_yaml(self._make_yaml(yml)))

    def test_missing_file(self):
        """Non-existent file should return False (graceful error)."""
        self.assertFalse(vgc.validate_notification_policies_yaml("/tmp/nonexistent_policies.yml"))

    def test_invalid_yaml_syntax(self):
        """File with invalid YAML syntax should return False."""
        path = self._make_yaml("[unclosed\n")
        self.assertFalse(vgc.validate_notification_policies_yaml(path))


class TestValidateAlertRulesYaml(unittest.TestCase):
    """Tests for the validate_alert_rules_yaml() function."""

    def setUp(self):
        self.temp_files = []

    def tearDown(self):
        for f in self.temp_files:
            try:
                os.unlink(f)
            except OSError:
                pass

    def _make_yaml(self, content: str) -> str:
        fd, path = tempfile.mkstemp(suffix=".yml", text=True)
        with os.fdopen(fd, "w") as f:
            f.write(content)
        self.temp_files.append(path)
        return path

    def _valid_alert_rules_yaml(self) -> str:
        """Create a temp file matching the real alert_rules.yml structure."""
        return self._make_yaml(
            "apiVersion: 1\n"
            "groups:\n"
            "  - name: toroloom-test\n"
            "    folder: Toroloom Alerts\n"
            "    interval: 30s\n"
            "    rules:\n"
            "      - uid: test_rule\n"
            "        title: Test Alert Rule\n"
            "        condition: B\n"
            "        data:\n"
            "          - refId: A\n"
            "            relativeTimeRange:\n"
            "              from: 300\n"
            "              to: 0\n"
            "            datasourceUid: prometheus\n"
            "            model:\n"
            "              expr: test_metric_total\n"
            "              intervalMs: 10000\n"
            "              maxDataPoints: 100\n"
            "              refId: A\n"
            "          - refId: B\n"
            "            relativeTimeRange:\n"
            "              from: 0\n"
            "              to: 0\n"
            "            datasourceUid: __expr__\n"
            "            model:\n"
            "              type: math\n"
            "              expression: \$A > 100\n"
            "              refId: B\n"
            "        noDataState: NoData\n"
            "        execErrState: Alerting\n"
            "        for: 5m\n"
            "        annotations:\n"
            "          summary: Test summary\n"
            "        labels:\n"
            "          severity: warning\n"
        )

    def test_valid_alert_rules(self):
        """A valid alert rules config should return True."""
        self.assertTrue(vgc.validate_alert_rules_yaml(self._valid_alert_rules_yaml()))

    def test_valid_multi_group(self):
        """Multiple groups should all be valid."""
        yml = (
            "apiVersion: 1\n"
            "groups:\n"
            "  - name: group-a\n"
            "    rules:\n"
            "      - uid: rule-a\n"
            "        title: Rule A\n"
            "        condition: A\n"
            "        data:\n"
            "          - refId: A\n"
            "            datasourceUid: prometheus\n"
            "            model:\n"
            "              expr: metric_a\n"
            "  - name: group-b\n"
            "    rules:\n"
            "      - uid: rule-b\n"
            "        title: Rule B\n"
            "        condition: A\n"
            "        data:\n"
            "          - refId: A\n"
            "            datasourceUid: prometheus\n"
            "            model:\n"
            "              expr: metric_b\n"
        )
        self.assertTrue(vgc.validate_alert_rules_yaml(self._make_yaml(yml)))

    def test_missing_api_version(self):
        """Missing apiVersion should return False."""
        yml = (
            "groups:\n"
            "  - name: Test\n"
            "    rules:\n"
            "      - uid: test\n"
            "        title: Test\n"
            "        condition: A\n"
            "        data:\n"
            "          - refId: A\n"
            "            datasourceUid: prometheus\n"
            "            model:\n"
            "              expr: test\n"
        )
        self.assertFalse(vgc.validate_alert_rules_yaml(self._make_yaml(yml)))

    def test_wrong_api_version(self):
        """apiVersion != 1 should return False."""
        yml = (
            "apiVersion: 2\n"
            "groups:\n"
            "  - name: Test\n"
            "    rules:\n"
            "      - uid: test\n"
            "        title: Test\n"
            "        condition: A\n"
            "        data:\n"
            "          - refId: A\n"
            "            datasourceUid: prometheus\n"
            "            model:\n"
            "              expr: test\n"
        )
        self.assertFalse(vgc.validate_alert_rules_yaml(self._make_yaml(yml)))

    def test_missing_groups_key(self):
        """Missing 'groups' key should return False."""
        yml = "apiVersion: 1\n"
        self.assertFalse(vgc.validate_alert_rules_yaml(self._make_yaml(yml)))

    def test_groups_not_array(self):
        """Non-array groups should return False."""
        yml = (
            "apiVersion: 1\n"
            "groups: not-an-array\n"
        )
        self.assertFalse(vgc.validate_alert_rules_yaml(self._make_yaml(yml)))

    def test_empty_groups(self):
        """Empty groups array should return False."""
        yml = (
            "apiVersion: 1\n"
            "groups:\n"
        )
        self.assertFalse(vgc.validate_alert_rules_yaml(self._make_yaml(yml)))

    def test_group_not_a_dict(self):
        """Group entry that is not a dict should return False."""
        yml = (
            "apiVersion: 1\n"
            "groups:\n"
            "  - just a string\n"
        )
        self.assertFalse(vgc.validate_alert_rules_yaml(self._make_yaml(yml)))

    # ── Group-level validation tests ───────────────────────────────

    def test_group_missing_name(self):
        """Group missing name should return False."""
        yml = (
            "apiVersion: 1\n"
            "groups:\n"
            "  - folder: Test\n"
            "    rules:\n"
            "      - uid: test\n"
            "        title: Test\n"
            "        condition: A\n"
            "        data:\n"
            "          - refId: A\n"
            "            datasourceUid: prometheus\n"
            "            model:\n"
            "              expr: test\n"
        )
        self.assertFalse(vgc.validate_alert_rules_yaml(self._make_yaml(yml)))

    def test_group_folder_empty_string(self):
        """Group with empty folder string should return False."""
        yml = (
            "apiVersion: 1\n"
            "groups:\n"
            "  - name: Test\n"
            "    folder: \"\"\n"
            "    rules:\n"
            "      - uid: test\n"
            "        title: Test\n"
            "        condition: A\n"
            "        data:\n"
            "          - refId: A\n"
            "            datasourceUid: prometheus\n"
            "            model:\n"
            "              expr: test\n"
        )
        self.assertFalse(vgc.validate_alert_rules_yaml(self._make_yaml(yml)))

    def test_group_interval_duration(self):
        """Group interval uses duration format."""
        yml = (
            "apiVersion: 1\n"
            "groups:\n"
            "  - name: Test\n"
            "    interval: not-a-duration\n"
            "    rules:\n"
            "      - uid: test\n"
            "        title: Test\n"
            "        condition: A\n"
            "        data:\n"
            "          - refId: A\n"
            "            datasourceUid: prometheus\n"
            "            model:\n"
            "              expr: test\n"
        )
        self.assertFalse(vgc.validate_alert_rules_yaml(self._make_yaml(yml)))

    def test_group_missing_rules(self):
        """Group missing rules should return False."""
        yml = (
            "apiVersion: 1\n"
            "groups:\n"
            "  - name: Test\n"
        )
        self.assertFalse(vgc.validate_alert_rules_yaml(self._make_yaml(yml)))

    def test_group_rules_not_array(self):
        """Non-array rules should return False."""
        yml = (
            "apiVersion: 1\n"
            "groups:\n"
            "  - name: Test\n"
            "    rules: not-array\n"
        )
        self.assertFalse(vgc.validate_alert_rules_yaml(self._make_yaml(yml)))

    def test_group_empty_rules(self):
        """Empty rules array should return False."""
        yml = (
            "apiVersion: 1\n"
            "groups:\n"
            "  - name: Test\n"
            "    rules:\n"
        )
        self.assertFalse(vgc.validate_alert_rules_yaml(self._make_yaml(yml)))

    # ── Rule-level validation tests ────────────────────────────────

    def test_rule_not_a_dict(self):
        """Rule that is not a dict should return False."""
        yml = (
            "apiVersion: 1\n"
            "groups:\n"
            "  - name: Test\n"
            "    rules:\n"
            "      - just a string\n"
        )
        self.assertFalse(vgc.validate_alert_rules_yaml(self._make_yaml(yml)))

    def test_rule_missing_uid(self):
        """Rule missing uid should return False."""
        yml = (
            "apiVersion: 1\n"
            "groups:\n"
            "  - name: Test\n"
            "    rules:\n"
            "      - title: No UID\n"
            "        condition: A\n"
            "        data:\n"
            "          - refId: A\n"
            "            datasourceUid: prometheus\n"
            "            model:\n"
            "              expr: test\n"
        )
        self.assertFalse(vgc.validate_alert_rules_yaml(self._make_yaml(yml)))

    def test_rule_missing_title(self):
        """Rule missing title should return False."""
        yml = (
            "apiVersion: 1\n"
            "groups:\n"
            "  - name: Test\n"
            "    rules:\n"
            "      - uid: no-title\n"
            "        condition: A\n"
            "        data:\n"
            "          - refId: A\n"
            "            datasourceUid: prometheus\n"
            "            model:\n"
            "              expr: test\n"
        )
        self.assertFalse(vgc.validate_alert_rules_yaml(self._make_yaml(yml)))

    def test_rule_missing_condition(self):
        """Rule missing condition should return False."""
        yml = (
            "apiVersion: 1\n"
            "groups:\n"
            "  - name: Test\n"
            "    rules:\n"
            "      - uid: no-cond\n"
            "        title: No Condition\n"
            "        data:\n"
            "          - refId: A\n"
            "            datasourceUid: prometheus\n"
            "            model:\n"
            "              expr: test\n"
        )
        self.assertFalse(vgc.validate_alert_rules_yaml(self._make_yaml(yml)))

    def test_rule_missing_data(self):
        """Rule missing data array should return False."""
        yml = (
            "apiVersion: 1\n"
            "groups:\n"
            "  - name: Test\n"
            "    rules:\n"
            "      - uid: no-data\n"
            "        title: No Data\n"
            "        condition: A\n"
        )
        self.assertFalse(vgc.validate_alert_rules_yaml(self._make_yaml(yml)))

    def test_rule_data_not_array(self):
        """Non-array data should return False."""
        yml = (
            "apiVersion: 1\n"
            "groups:\n"
            "  - name: Test\n"
            "    rules:\n"
            "      - uid: test\n"
            "        title: Test\n"
            "        condition: A\n"
            "        data: not-array\n"
        )
        self.assertFalse(vgc.validate_alert_rules_yaml(self._make_yaml(yml)))

    def test_rule_empty_data(self):
        """Empty data array should return False."""
        yml = (
            "apiVersion: 1\n"
            "groups:\n"
            "  - name: Test\n"
            "    rules:\n"
            "      - uid: test\n"
            "        title: Test\n"
            "        condition: A\n"
            "        data:\n"
        )
        self.assertFalse(vgc.validate_alert_rules_yaml(self._make_yaml(yml)))

    def test_condition_refers_to_unknown_refid(self):
        """condition referring to non-existent data refId should return False."""
        yml = (
            "apiVersion: 1\n"
            "groups:\n"
            "  - name: Test\n"
            "    rules:\n"
            "      - uid: bad-cond\n"
            "        title: Bad Condition\n"
            "        condition: Z\n"
            "        data:\n"
            "          - refId: A\n"
            "            datasourceUid: prometheus\n"
            "            model:\n"
            "              expr: test\n"
            "          - refId: B\n"
            "            datasourceUid: __expr__\n"
            "            model:\n"
            "              type: math\n"
            "              expression: \$A > 0\n"
        )
        self.assertFalse(vgc.validate_alert_rules_yaml(self._make_yaml(yml)))

    # ── Data entry validation tests ────────────────────────────────

    def test_data_entry_missing_refId(self):
        """Data entry missing refId should return False."""
        yml = (
            "apiVersion: 1\n"
            "groups:\n"
            "  - name: Test\n"
            "    rules:\n"
            "      - uid: test\n"
            "        title: Test\n"
            "        condition: A\n"
            "        data:\n"
            "          - datasourceUid: prometheus\n"
            "            model:\n"
            "              expr: test\n"
        )
        self.assertFalse(vgc.validate_alert_rules_yaml(self._make_yaml(yml)))

    def test_data_entry_missing_datasourceUid(self):
        """Data entry missing datasourceUid should return False."""
        yml = (
            "apiVersion: 1\n"
            "groups:\n"
            "  - name: Test\n"
            "    rules:\n"
            "      - uid: test\n"
            "        title: Test\n"
            "        condition: A\n"
            "        data:\n"
            "          - refId: A\n"
            "            model:\n"
            "              expr: test\n"
        )
        self.assertFalse(vgc.validate_alert_rules_yaml(self._make_yaml(yml)))

    def test_data_entry_missing_model(self):
        """Data entry missing model should return False."""
        yml = (
            "apiVersion: 1\n"
            "groups:\n"
            "  - name: Test\n"
            "    rules:\n"
            "      - uid: test\n"
            "        title: Test\n"
            "        condition: A\n"
            "        data:\n"
            "          - refId: A\n"
            "            datasourceUid: prometheus\n"
        )
        self.assertFalse(vgc.validate_alert_rules_yaml(self._make_yaml(yml)))

    def test_data_entry_missing_expr(self):
        """Prometheus data entry missing expr should return False."""
        yml = (
            "apiVersion: 1\n"
            "groups:\n"
            "  - name: Test\n"
            "    rules:\n"
            "      - uid: test\n"
            "        title: Test\n"
            "        condition: A\n"
            "        data:\n"
            "          - refId: A\n"
            "            datasourceUid: prometheus\n"
            "            model:\n"
            "              type: prometheus\n"
        )
        self.assertFalse(vgc.validate_alert_rules_yaml(self._make_yaml(yml)))

    def test_data_entry_missing_expression_math(self):
        """Math data entry missing expression should return False."""
        yml = (
            "apiVersion: 1\n"
            "groups:\n"
            "  - name: Test\n"
            "    rules:\n"
            "      - uid: test\n"
            "        title: Test\n"
            "        condition: A\n"
            "        data:\n"
            "          - refId: A\n"
            "            datasourceUid: __expr__\n"
            "            model:\n"
            "              type: math\n"
        )
        self.assertFalse(vgc.validate_alert_rules_yaml(self._make_yaml(yml)))

    def test_noDataState_invalid(self):
        """Invalid noDataState should return False."""
        yml = (
            "apiVersion: 1\n"
            "groups:\n"
            "  - name: Test\n"
            "    rules:\n"
            "      - uid: test\n"
            "        title: Test\n"
            "        condition: A\n"
            "        data:\n"
            "          - refId: A\n"
            "            datasourceUid: prometheus\n"
            "            model:\n"
            "              expr: test\n"
            "        noDataState: InvalidState\n"
        )
        self.assertFalse(vgc.validate_alert_rules_yaml(self._make_yaml(yml)))

    def test_execErrState_invalid(self):
        """Invalid execErrState should return False."""
        yml = (
            "apiVersion: 1\n"
            "groups:\n"
            "  - name: Test\n"
            "    rules:\n"
            "      - uid: test\n"
            "        title: Test\n"
            "        condition: A\n"
            "        data:\n"
            "          - refId: A\n"
            "            datasourceUid: prometheus\n"
            "            model:\n"
            "              expr: test\n"
            "        execErrState: InvalidState\n"
        )
        self.assertFalse(vgc.validate_alert_rules_yaml(self._make_yaml(yml)))

    def test_for_duration_invalid(self):
        """Invalid 'for' duration should return False."""
        yml = (
            "apiVersion: 1\n"
            "groups:\n"
            "  - name: Test\n"
            "    rules:\n"
            "      - uid: test\n"
            "        title: Test\n"
            "        condition: A\n"
            "        data:\n"
            "          - refId: A\n"
            "            datasourceUid: prometheus\n"
            "            model:\n"
            "              expr: test\n"
            "        for: forever\n"
        )
        self.assertFalse(vgc.validate_alert_rules_yaml(self._make_yaml(yml)))

    def test_promql_unbalanced_parens(self):
        """PromQL expression with unbalanced parentheses should return False."""
        yml = (
            "apiVersion: 1\n"
            "groups:\n"
            "  - name: Test\n"
            "    rules:\n"
            "      - uid: test\n"
            "        title: Test\n"
            "        condition: A\n"
            "        data:\n"
            "          - refId: A\n"
            "            datasourceUid: prometheus\n"
            "            model:\n"
            "              expr: rate(metric[5m]\n"
        )
        self.assertFalse(vgc.validate_alert_rules_yaml(self._make_yaml(yml)))

    def test_promql_unbalanced_brackets(self):
        """PromQL expression with unbalanced brackets should return False."""
        yml = (
            "apiVersion: 1\n"
            "groups:\n"
            "  - name: Test\n"
            "    rules:\n"
            "      - uid: test\n"
            "        title: Test\n"
            "        condition: A\n"
            "        data:\n"
            "          - refId: A\n"
            "            datasourceUid: prometheus\n"
            "            model:\n"
            "              expr: metric{foo=\"bar\n"
        )
        self.assertFalse(vgc.validate_alert_rules_yaml(self._make_yaml(yml)))

    def test_promql_mismatched_brackets(self):
        """PromQL expression with mismatched brackets should return False."""
        yml = (
            "apiVersion: 1\n"
            "groups:\n"
            "  - name: Test\n"
            "    rules:\n"
            "      - uid: test\n"
            "        title: Test\n"
            "        condition: A\n"
            "        data:\n"
            "          - refId: A\n"
            "            datasourceUid: prometheus\n"
            "            model:\n"
            "              expr: metric]\n"
        )
        self.assertFalse(vgc.validate_alert_rules_yaml(self._make_yaml(yml)))

    def test_annotations_not_dict(self):
        """Non-dict annotations should return False."""
        yml = (
            "apiVersion: 1\n"
            "groups:\n"
            "  - name: Test\n"
            "    rules:\n"
            "      - uid: test\n"
            "        title: Test\n"
            "        condition: A\n"
            "        data:\n"
            "          - refId: A\n"
            "            datasourceUid: prometheus\n"
            "            model:\n"
            "              expr: test\n"
            "        annotations: not-dict\n"
        )
        self.assertFalse(vgc.validate_alert_rules_yaml(self._make_yaml(yml)))

    def test_labels_not_dict(self):
        """Non-dict labels should return False."""
        yml = (
            "apiVersion: 1\n"
            "groups:\n"
            "  - name: Test\n"
            "    rules:\n"
            "      - uid: test\n"
            "        title: Test\n"
            "        condition: A\n"
            "        data:\n"
            "          - refId: A\n"
            "            datasourceUid: prometheus\n"
            "            model:\n"
            "              expr: test\n"
            "        labels: not-dict\n"
        )
        self.assertFalse(vgc.validate_alert_rules_yaml(self._make_yaml(yml)))

    def test_missing_file(self):
        """Non-existent file should return False (graceful error)."""
        self.assertFalse(vgc.validate_alert_rules_yaml("/tmp/nonexistent_alert_rules.yml"))

    def test_invalid_yaml_syntax(self):
        """File with invalid YAML syntax should return False."""
        path = self._make_yaml("[unclosed\n")
        self.assertFalse(vgc.validate_alert_rules_yaml(path))


class TestMainOutput(unittest.TestCase):
    """Verify the stdout output of the validation functions contains expected strings."""

    def setUp(self):
        self.temp_files = []

    def tearDown(self):
        for f in self.temp_files:
            try:
                os.unlink(f)
            except OSError:
                pass

    def _make_yaml(self, content: str) -> str:
        fd, path = tempfile.mkstemp(suffix=".yml", text=True)
        with os.fdopen(fd, "w") as f:
            f.write(content)
        self.temp_files.append(path)
        return path

    def _make_json(self, data: dict) -> str:
        fd, path = tempfile.mkstemp(suffix=".json", text=True)
        with os.fdopen(fd, "w") as f:
            json.dump(data, f)
        self.temp_files.append(path)
        return path

    def test_output_valid_yaml(self):
        """Valid YAML prints 'YAML valid'."""
        path = self._make_yaml("ok: true\n")
        captured = io.StringIO()
        with patch("sys.stdout", captured):
            vgc.validate_yaml(path)
        self.assertIn("YAML valid", captured.getvalue())

    def test_output_valid_json(self):
        """Valid dashboard JSON prints 'JSON valid'."""
        dash = {
            "title": "Out",
            "panels": [{"id": 1, "title": "P", "type": "stat", "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0}}],
            "schemaVersion": 38,
            "timezone": "utc",
        }
        path = self._make_json(dash)
        captured = io.StringIO()
        with patch("sys.stdout", captured):
            vgc.validate_dashboard_json(path)
        output = captured.getvalue()
        self.assertIn("JSON valid", output)
        self.assertIn("1 panels", output)
        self.assertIn("schemaVersion=38", output)

    def test_output_invalid_yaml_shows_error(self):
        """Invalid YAML prints 'YAML ERROR'."""
        path = self._make_yaml("{unclosed\n")
        captured = io.StringIO()
        with patch("sys.stdout", captured):
            vgc.validate_yaml(path)
        self.assertIn("YAML ERROR", captured.getvalue())

    def test_output_invalid_json_shows_schema_errors(self):
        """Invalid dashboard JSON prints 'SCHEMA ERROR(S)' with bullet points."""
        dash = {"title": ""}
        path = self._make_json(dash)
        captured = io.StringIO()
        with patch("sys.stdout", captured):
            vgc.validate_dashboard_json(path)
        output = captured.getvalue()
        self.assertIn("SCHEMA ERROR", output)
        self.assertIn("title", output)

    def test_output_main_success_message(self):
        """main() prints 'All Grafana config files validated' on success."""
        path = self._make_yaml("key: val\n")
        captured = io.StringIO()
        with patch("sys.stdout", captured), patch.object(sys, "argv", ["prog", path]):
            vgc.main()
        self.assertIn("All Grafana config files validated", captured.getvalue())

    def test_output_main_failure_message(self):
        """main() prints 'Some Grafana config files failed' on failure."""
        path = self._make_yaml("{unclosed\n")
        captured = io.StringIO()
        with patch("sys.stdout", captured), patch.object(sys, "argv", ["prog", path]):
            vgc.main()
        self.assertIn("failed validation", captured.getvalue())



class TestCrossFileValidation(unittest.TestCase):
    """Tests for cross-file validation helpers."""

    def test_extract_contact_point_names(self):
        """Should extract contact point names from parsed YAML."""
        data = {
            "apiVersion": 1,
            "contactPoints": [
                {"name": "Slack Alerts", "receivers": [{"uid": "s1", "type": "slack", "settings": {"url": "http://hook"}}]},
                {"name": "PagerDuty Alerts", "receivers": [{"uid": "p1", "type": "pagerduty", "settings": {"integrationKey": "key"}}]},
                {"name": "Email Alerts", "receivers": [{"uid": "e1", "type": "email", "settings": {"addresses": "a@b.com"}}]},
            ],
        }
        names = vgc._extract_contact_point_names(data)
        self.assertEqual(names, {"Slack Alerts", "PagerDuty Alerts", "Email Alerts"})

    def test_extract_contact_point_names_empty(self):
        """Should return empty set for missing contactPoints."""
        self.assertEqual(vgc._extract_contact_point_names({}), set())
        self.assertEqual(vgc._extract_contact_point_names({"contactPoints": "not-array"}), set())

    def test_extract_datasource_uids(self):
        """Should extract datasource UIDs from parsed YAML."""
        data = {
            "apiVersion": 1,
            "datasources": [
                {"name": "Prometheus", "uid": "prometheus", "type": "prometheus", "access": "proxy", "url": "http://prom:9090"},
                {"name": "Loki", "uid": "loki", "type": "loki", "access": "proxy", "url": "http://loki:3100"},
            ],
        }
        uids = vgc._extract_datasource_uids(data)
        self.assertEqual(uids, {"prometheus", "loki"})

    def test_extract_datasource_uids_empty(self):
        """Should return empty set for missing datasources."""
        self.assertEqual(vgc._extract_datasource_uids({}), set())
        self.assertEqual(vgc._extract_datasource_uids({"datasources": "not-array"}), set())

    def test_collect_policy_receiver_refs(self):
        """Should collect all receiver names from policies including nested routes."""
        policies = [
            {"receiver": "Slack Alerts", "routes": [
                {"receiver": "PagerDuty Alerts", "continue": True},
            ]},
        ]
        receivers = vgc._collect_policy_receiver_refs(policies)
        self.assertEqual(receivers, {"Slack Alerts", "PagerDuty Alerts"})

    def test_collect_policy_receiver_refs_deep_nesting(self):
        """Should traverse deeply nested routes."""
        policies = [
            {"receiver": "Root", "routes": [
                {"receiver": "Level1", "routes": [
                    {"receiver": "Level2"},
                ]},
            ]},
        ]
        receivers = vgc._collect_policy_receiver_refs(policies)
        self.assertEqual(receivers, {"Root", "Level1", "Level2"})

    def test_collect_policy_receiver_refs_empty(self):
        """Should return empty set for empty/absent policies."""
        self.assertEqual(vgc._collect_policy_receiver_refs([]), set())
        self.assertEqual(vgc._collect_policy_receiver_refs([{}, {"routes": []}]), set())

    def test_collect_alert_datasource_uids(self):
        """Should collect datasourceUids from alert rules, excluding __expr__."""
        groups = [
            {
                "name": "test",
                "rules": [
                    {
                        "uid": "test",
                        "title": "Test",
                        "condition": "B",
                        "data": [
                            {"refId": "A", "datasourceUid": "prometheus", "model": {"expr": "test"}},
                            {"refId": "B", "datasourceUid": "__expr__", "model": {"type": "math", "expression": "$A > 0"}},
                        ],
                    },
                ],
            },
        ]
        uids = vgc._collect_alert_datasource_uids(groups)
        self.assertEqual(uids, {"prometheus"})

    def test_collect_alert_datasource_uids_multi(self):
        """Should collect datasourceUids from multiple rules and groups."""
        groups = [
            {"name": "g1", "rules": [
                {"uid": "r1", "title": "R1", "condition": "A", "data": [
                    {"refId": "A", "datasourceUid": "prometheus", "model": {"expr": "m1"}},
                ]},
            ]},
            {"name": "g2", "rules": [
                {"uid": "r2", "title": "R2", "condition": "A", "data": [
                    {"refId": "A", "datasourceUid": "loki", "model": {"expr": "m2"}},
                ]},
            ]},
        ]
        uids = vgc._collect_alert_datasource_uids(groups)
        self.assertEqual(uids, {"prometheus", "loki"})

    def test_collect_alert_datasource_uids_empty(self):
        """Should return empty set for empty groups."""
        self.assertEqual(vgc._collect_alert_datasource_uids([]), set())
        self.assertEqual(vgc._collect_alert_datasource_uids([{}, {"rules": []}]), set())

    # ── cross_validate_files tests ─────────────────────────────────

    def test_cross_validate_receivers_match(self):
        """Matching receiver names should produce no errors."""
        cp_names = {"Slack Alerts", "PagerDuty Alerts"}
        policy_data = {
            "apiVersion": 1,
            "policies": [
                {"receiver": "Slack Alerts", "routes": [
                    {"receiver": "PagerDuty Alerts", "continue": True},
                ]},
            ],
        }
        errors = vgc.cross_validate_files(
            contact_point_names=cp_names,
            datasource_uids=set(),
            policy_data=policy_data,
        )
        self.assertEqual(errors, [])

    def test_cross_validate_receivers_mismatch(self):
        """Missing receiver name should produce an error."""
        cp_names = {"Slack Alerts"}
        policy_data = {
            "apiVersion": 1,
            "policies": [
                {"receiver": "NonExistent Receiver"},
            ],
        }
        errors = vgc.cross_validate_files(
            contact_point_names=cp_names,
            datasource_uids=set(),
            policy_data=policy_data,
        )
        self.assertGreater(len(errors), 0)
        self.assertIn("NonExistent Receiver", errors[0])
        self.assertIn("Slack Alerts", errors[0])

    def test_cross_validate_datasource_uids_match(self):
        """Matching datasource UIDs should produce no errors."""
        ds_uids = {"prometheus", "loki"}
        alert_data = {
            "apiVersion": 1,
            "groups": [
                {
                    "name": "test",
                    "rules": [
                        {
                            "uid": "test",
                            "title": "Test",
                            "condition": "A",
                            "data": [
                                {"refId": "A", "datasourceUid": "prometheus", "model": {"expr": "m1"}},
                            ],
                        },
                    ],
                },
            ],
        }
        errors = vgc.cross_validate_files(
            contact_point_names=set(),
            datasource_uids=ds_uids,
            alert_data=alert_data,
        )
        self.assertEqual(errors, [])

    def test_cross_validate_datasource_uids_mismatch(self):
        """Missing datasource UID should produce an error."""
        ds_uids = {"prometheus"}
        alert_data = {
            "apiVersion": 1,
            "groups": [
                {
                    "name": "test",
                    "rules": [
                        {
                            "uid": "test",
                            "title": "Test",
                            "condition": "A",
                            "data": [
                                {"refId": "A", "datasourceUid": "nonexistent", "model": {"expr": "m1"}},
                            ],
                        },
                    ],
                },
            ],
        }
        errors = vgc.cross_validate_files(
            contact_point_names=set(),
            datasource_uids=ds_uids,
            alert_data=alert_data,
        )
        self.assertGreater(len(errors), 0)
        self.assertIn("nonexistent", errors[0])
        self.assertIn("prometheus", errors[0])

    def test_cross_validate_both_checks_together(self):
        """Both receiver and datasource checks should run when both data provided."""
        cp_names = {"Slack Alerts"}
        ds_uids = {"prometheus"}
        policy_data = {
            "apiVersion": 1,
            "policies": [
                {"receiver": "Slack Alerts"},
                {"receiver": "Missing Receiver"},
            ],
        }
        alert_data = {
            "apiVersion": 1,
            "groups": [
                {
                    "name": "test",
                    "rules": [
                        {
                            "uid": "test",
                            "title": "Test",
                            "condition": "A",
                            "data": [
                                {"refId": "A", "datasourceUid": "prometheus", "model": {"expr": "m1"}},
                                {"refId": "B", "datasourceUid": "missing-ds", "model": {"type": "math", "expression": "$A > 0"}},
                            ],
                        },
                    ],
                },
            ],
        }
        errors = vgc.cross_validate_files(
            contact_point_names=cp_names,
            datasource_uids=ds_uids,
            policy_data=policy_data,
            alert_data=alert_data,
        )
        self.assertGreaterEqual(len(errors), 2)  # At least 2 errors (receiver + datasource)
        error_text = " ".join(errors)
        self.assertIn("Missing Receiver", error_text)
        self.assertIn("missing-ds", error_text)

    def test_cross_validate_empty_references(self):
        """No cross-reference data should produce no errors."""
        errors = vgc.cross_validate_files(
            contact_point_names=set(),
            datasource_uids=set(),
        )
        self.assertEqual(errors, [])

    def test_cross_validate_with_path_info(self):
        """Error messages should include file path when provided."""
        cp_names = {"Real Name"}
        policy_data = {
            "apiVersion": 1,
            "policies": [{"receiver": "Fake Name"}],
        }
        errors = vgc.cross_validate_files(
            contact_point_names=cp_names,
            datasource_uids=set(),
            policy_data=policy_data,
            policy_path="policies.yml",
        )
        self.assertIn("policies.yml", errors[0])


class TestEdgeCases(unittest.TestCase):
    """Edge case tests: symlinks, permissions, large dashboards."""

    def setUp(self):
        self.temp_files = []
        self.temp_dirs = []

    def tearDown(self):
        for f in self.temp_files:
            try:
                os.unlink(f)
            except OSError:
                pass
        for d in self.temp_dirs:
            try:
                os.rmdir(d)
            except OSError:
                pass

    def _make_yaml(self, content: str, suffix: str = ".yml") -> str:
        fd, path = tempfile.mkstemp(suffix=suffix, text=True)
        with os.fdopen(fd, "w") as f:
            f.write(content)
        self.temp_files.append(path)
        return path

    def _make_json(self, data: dict) -> str:
        fd, path = tempfile.mkstemp(suffix=".json", text=True)
        with os.fdopen(fd, "w") as f:
            json.dump(data, f)
        self.temp_files.append(path)
        return path

    # ── Symlink tests ───────────────────────────────────────────────────

    @unittest.skipIf(
        os.name == "nt" and not hasattr(os, "symlink"),
        "symlinks not supported on this Windows configuration",
    )
    def test_symlink_valid_yaml(self):
        """Symlink to valid YAML should resolve and validate."""
        target = self._make_yaml("key: value\n")
        link = target + ".symlink.yml"
        try:
            os.symlink(target, link)
        except (OSError, NotImplementedError):
            self.skipTest("cannot create symlink")
        self.temp_files.append(link)
        self.assertTrue(vgc.validate_yaml(link))

    @unittest.skipIf(
        os.name == "nt" and not hasattr(os, "symlink"),
        "symlinks not supported on this Windows configuration",
    )
    def test_symlink_invalid_yaml(self):
        """Symlink to invalid YAML should fail validation."""
        target = self._make_yaml("[unclosed\n")
        link = target + ".symlink.yml"
        try:
            os.symlink(target, link)
        except (OSError, NotImplementedError):
            self.skipTest("cannot create symlink")
        self.temp_files.append(link)
        self.assertFalse(vgc.validate_yaml(link))

    @unittest.skipIf(
        os.name == "nt" and not hasattr(os, "symlink"),
        "symlinks not supported on this Windows configuration",
    )
    def test_symlink_broken(self):
        """Broken symlink should return False (graceful error)."""
        link = tempfile.mktemp(suffix=".broken.yml")
        self.temp_files.append(link)
        try:
            os.symlink("/nonexistent/target.yml", link)
        except (OSError, NotImplementedError):
            self.skipTest("cannot create symlink")
        self.assertFalse(vgc.validate_yaml(link))

    @unittest.skipIf(
        os.name == "nt" and not hasattr(os, "symlink"),
        "symlinks not supported on this Windows configuration",
    )
    def test_symlink_valid_json(self):
        """Symlink to valid dashboard JSON should resolve and validate."""
        dash = {
            "title": "Symlinked",
            "panels": [{"id": 1, "title": "P", "type": "stat", "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0}}],
            "schemaVersion": 38,
            "timezone": "utc",
        }
        target = self._make_json(dash)
        link = target + ".symlink.json"
        try:
            os.symlink(target, link)
        except (OSError, NotImplementedError):
            self.skipTest("cannot create symlink")
        self.temp_files.append(link)
        self.assertTrue(vgc.validate_dashboard_json(link))

    # ── Permission tests ────────────────────────────────────────────────

    @unittest.skipIf(os.name == "nt", "permission bits not reliable on Windows")
    def test_permission_denied_yaml(self):
        """Unreadable YAML file should return False (graceful error)."""
        path = self._make_yaml("key: value\n")
        os.chmod(path, 0o000)
        try:
            self.assertFalse(vgc.validate_yaml(path))
        finally:
            os.chmod(path, 0o644)

    @unittest.skipIf(os.name == "nt", "permission bits not reliable on Windows")
    def test_permission_denied_json(self):
        """Unreadable JSON file should return False (graceful error)."""
        dash = {
            "title": "Secret",
            "panels": [{"id": 1, "title": "P", "type": "stat", "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0}}],
            "schemaVersion": 38,
            "timezone": "utc",
        }
        path = self._make_json(dash)
        os.chmod(path, 0o000)
        try:
            self.assertFalse(vgc.validate_dashboard_json(path))
        finally:
            os.chmod(path, 0o644)

    # ── Large dashboard tests ───────────────────────────────────────────

    def _generate_large_dashboard(self, num_panels: int, num_sections: int = 0):
        """Generate a dashboard with the specified number of panels.

        Args:
            num_panels: Number of top-level panels.
            num_sections: Number of collapsible sections, each with 5 nested panels.
        """
        panels = []
        for i in range(num_panels):
            panels.append({
                "id": i + 1,
                "title": f"Panel {i + 1}",
                "type": "stat",
                "gridPos": {"h": 8, "w": 12, "x": 0, "y": i * 8},
            })
        for s in range(num_sections):
            section_id = num_panels + s + 1
            children = []
            for c in range(5):
                children.append({
                    "id": section_id * 100 + c,
                    "title": f"Child {section_id}.{c}",
                    "type": "timeseries",
                    "gridPos": {"h": 6, "w": 12, "x": 0, "y": c * 6},
                })
            panels.append({
                "id": section_id,
                "title": f"Section {s + 1}",
                "type": "row",
                "collapsed": True,
                "gridPos": {"h": 1, "w": 24, "x": 0, "y": 0},
                "panels": children,
            })
        return {
            "title": f"Large Dashboard ({num_panels} + {num_sections * 5} nested panels)",
            "panels": panels,
            "schemaVersion": 38,
            "timezone": "utc",
        }

    def test_large_dashboard_100_panels(self):
        """Dashboard with 100 panels should validate successfully."""
        dash = self._generate_large_dashboard(100)
        path = self._make_json(dash)
        self.assertTrue(vgc.validate_dashboard_json(path))

    def test_large_dashboard_500_panels(self):
        """Dashboard with 500 panels should validate successfully."""
        dash = self._generate_large_dashboard(500)
        path = self._make_json(dash)
        self.assertTrue(vgc.validate_dashboard_json(path))

    def test_large_dashboard_with_sections(self):
        """Dashboard with 50 top-level panels + 20 sections (100 nested) should validate."""
        dash = self._generate_large_dashboard(50, num_sections=20)
        path = self._make_json(dash)
        self.assertTrue(vgc.validate_dashboard_json(path))

    def test_large_dashboard_performance(self):
        """A 500-panel dashboard should validate in under 2 seconds."""
        import time

        dash = self._generate_large_dashboard(500)
        path = self._make_json(dash)
        start = time.perf_counter()
        result = vgc.validate_dashboard_json(path)
        elapsed = time.perf_counter() - start
        self.assertTrue(result, "500-panel dashboard should be valid")
        self.assertLess(
            elapsed,
            2.0,
            f"Validation took {elapsed:.3f}s (expected < 2.0s)",
        )

    def test_large_dashboard_one_invalid_panel(self):
        """Among 500 panels, one without title should fail."""
        dash = self._generate_large_dashboard(500)
        del dash["panels"][250]["title"]  # Remove title key from panel 251
        path = self._make_json(dash)
        self.assertFalse(vgc.validate_dashboard_json(path))

    def test_large_dashboard_all_missing_gridpos(self):
        """All 200 panels missing gridPos should still fail (not crash)."""
        panels = []
        for i in range(200):
            panels.append({
                "id": i + 1,
                "title": f"Panel {i + 1}",
                "type": "stat",
                # No gridPos
            })
        dash = {
            "title": "No GridPos",
            "panels": panels,
            "schemaVersion": 38,
            "timezone": "utc",
        }
        path = self._make_json(dash)
        self.assertFalse(vgc.validate_dashboard_json(path))


if __name__ == "__main__":
    unittest.main()
