#!/usr/bin/env python3
"""
Toroloom — Grafana Config Validation Script

Validates Grafana provisioning YAML files and dashboard JSON files.

Usage:
    python3 scripts/validate-grafana-configs.py <file1> [file2 ...]

Exit codes:
    0 — all files valid
    1 — at least one file invalid (syntax or schema error)

Output:
    Prints validation results per file to stdout.
"""

import json
import sys

# Force UTF-8 stdout encoding for Windows compatibility (fixes UnicodeEncodeError
# when printing checkmark/cross characters like \u2713/\u274c on cp1252 consoles)
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

try:
    import yaml
except ImportError:
    print("PyYAML not installed. Run: pip3 install pyyaml --user")
    sys.exit(1)

# Sentinel object to distinguish "load error" from "successfully parsed to None"
_YAML_LOAD_FAILED = object()


def _load_yaml(filepath: str):
    """Load and parse a YAML file, handling filesystem errors.

    Returns the parsed data on success (may be None for empty files).
    Returns _YAML_LOAD_FAILED on filesystem/YAML error (error already printed).
    """
    try:
        with open(filepath) as fh:
            return yaml.safe_load(fh)
    except FileNotFoundError:
        print(f"\u274c FILE NOT FOUND: {filepath}")
        return _YAML_LOAD_FAILED
    except PermissionError:
        print(f"\u274c PERMISSION DENIED: {filepath}")
        return _YAML_LOAD_FAILED
    except IsADirectoryError:
        print(f"\u274c IS A DIRECTORY: {filepath}")
        return _YAML_LOAD_FAILED
    except OSError as e:
        print(f"\u274c FILE ERROR in {filepath}:")
        print(f"    {e}")
        return _YAML_LOAD_FAILED
    except yaml.YAMLError as e:
        print(f"\u274c YAML ERROR in {filepath}:")
        print(f"    {e}")
        return _YAML_LOAD_FAILED


def _yaml_load_ok(data) -> bool:
    """Check if _load_yaml succeeded (not a load error)."""
    return data is not _YAML_LOAD_FAILED


def validate_yaml(filepath: str, data=None) -> bool:
    """Check that a YAML file is syntactically valid."""
    if data is None:
        data = _load_yaml(filepath)
        if not _yaml_load_ok(data):
            return False
    print(f"  \u2713 YAML valid: {filepath}")
    return True


# Known Grafana datasource types (as of Grafana 10/11)
_KNOWN_DATASOURCE_TYPES = frozenset({
    "prometheus",
    "loki",
    "elasticsearch",
    "graphite",
    "influxdb",
    "opentsdb",
    "mysql",
    "postgres",
    "mssql",
    "cloudwatch",
    "azuremonitor",
    "stackdriver",  # Google Cloud Monitoring
    "datadog",
    "newrelic",
    "splunk",
    "dynatrace",
    "jaeger",
    "tempo",
    "zipkin",
    "opencensus",
    "grafana",       # -- Grafana -- (special internal)
    "testdata",      # TestData DB
    "alexanderzobnin-zabbix-datasource",
    "grafana-github-datasource",
    "grafana-salesforce-datasource",
})

# Valid access modes for Grafana datasources
_VALID_ACCESS_MODES = frozenset({"proxy", "direct", "browser"})


def _validate_datasource_entry(ds: dict, index: int, Q: str) -> list:
    """Validate a single Grafana datasource entry.

    Returns a list of error strings (empty = valid).
    """
    errors = []
    prefix = f"Datasource #{index}"

    # ── Required fields ─────────────────────────────────────────────
    required_fields = ["name", "type", "access", "url"]
    for field in required_fields:
        if field not in ds:
            errors.append(f"{prefix}: missing {Q}{field}{Q}")

    if "uid" not in ds:
        errors.append(f"{prefix}: missing {Q}uid{Q} (recommended for alert rule references)")

    # ── type validation ────────────────────────────────────────────
    if "type" in ds:
        ds_type = ds["type"]
        if not isinstance(ds_type, str):
            errors.append(f"{prefix}: {Q}type{Q} must be a string, got {Q}{type(ds_type).__name__}{Q}")
        elif ds_type not in _KNOWN_DATASOURCE_TYPES:
            errors.append(f"{prefix}: unknown {Q}type{Q} {Q}{ds_type}{Q}")

    # ── access validation ──────────────────────────────────────────
    if "access" in ds:
        ds_access = ds["access"]
        if not isinstance(ds_access, str):
            errors.append(f"{prefix}: {Q}access{Q} must be a string, got {Q}{type(ds_access).__name__}{Q}")
        elif ds_access not in _VALID_ACCESS_MODES:
            errors.append(
                f"{prefix}: {Q}access{Q} {Q}{ds_access}{Q} is invalid "
                f"(expected one of {Q}proxy{Q}, {Q}direct{Q}, {Q}browser{Q})"
            )

    # ── url validation ─────────────────────────────────────────────
    if "url" in ds:
        ds_url = ds["url"]
        if not isinstance(ds_url, str) or not ds_url.strip():
            errors.append(f"{prefix}: {Q}url{Q} must be a non-empty string")

    # ── isDefault validation ───────────────────────────────────────
    if "isDefault" in ds and not isinstance(ds["isDefault"], bool):
        errors.append(f"{prefix}: {Q}isDefault{Q} must be a boolean, got {Q}{type(ds['isDefault']).__name__}{Q}")

    # ── editable validation ────────────────────────────────────────
    if "editable" in ds and not isinstance(ds["editable"], bool):
        errors.append(f"{prefix}: {Q}editable{Q} must be a boolean, got {Q}{type(ds['editable']).__name__}{Q}")

    # ── jsonData validation ────────────────────────────────────────
    if "jsonData" in ds:
        jd = ds["jsonData"]
        if not isinstance(jd, dict):
            errors.append(f"{prefix}: {Q}jsonData{Q} must be an object")

    return errors


def validate_datasource_yaml(filepath: str, data=None) -> bool:
    """Validate a Grafana datasource provisioning YAML file."""
    if data is None:
        data = _load_yaml(filepath)
        if not _yaml_load_ok(data):
            return False

    errors = []
    Q = chr(34)

    # ── apiVersion check ───────────────────────────────────────────
    if data.get("apiVersion") != 1:
        errors.append(f"{Q}apiVersion{Q} must be 1, got {Q}{data.get('apiVersion')!r}{Q}")

    # ── datasources array check ────────────────────────────────────
    if "datasources" not in data:
        errors.append(f"Missing required field: {Q}datasources{Q} (array of datasource objects)")
        print(f"\u274c SCHEMA ERROR(S) in {filepath}:")
        for e in errors:
            print(f"    \u2022 {e}")
        return False

    ds_list = data["datasources"]
    if not isinstance(ds_list, list):
        errors.append(f"{Q}datasources{Q} must be an array, got {Q}{type(ds_list).__name__}{Q}")
        print(f"\u274c SCHEMA ERROR(S) in {filepath}:")
        for e in errors:
            print(f"    \u2022 {e}")
        return False

    if len(ds_list) == 0:
        errors.append(f"{Q}datasources{Q} is empty — expected at least one datasource")
        print(f"\u274c SCHEMA ERROR(S) in {filepath}:")
        for e in errors:
            print(f"    \u2022 {e}")
        return False

    # ── Validate each datasource entry ─────────────────────────────
    for i, ds in enumerate(ds_list):
        if not isinstance(ds, dict):
            errors.append(f"Datasource #{i}: must be an object, got {Q}{type(ds).__name__}{Q}")
            continue
        errors.extend(_validate_datasource_entry(ds, i, Q))

    # ── Report results ────────────────────────────────────────────
    if errors:
        print(f"\u274c SCHEMA ERROR(S) in {filepath}:")
        for e in errors:
            print(f"    \u2022 {e}")
        return False

    ds_count = len(ds_list)
    print(f"  \u2713 Datasource YAML valid: {filepath} ({ds_count} datasource(s))")
    return True


def _validate_dashboard_provider_entry(provider: dict, index: int, Q: str) -> list:
    """Validate a single Grafana dashboard provider entry.

    Returns a list of error strings (empty = valid).
    """
    errors = []
    prefix = f"Provider #{index}"

    # ── Required fields ─────────────────────────────────────────────
    if "name" not in provider:
        errors.append(f"{prefix}: missing {Q}name{Q}")

    # ── type validation ─────────────────────────────────────────────
    if "type" in provider:
        ptype = provider["type"]
        if not isinstance(ptype, str):
            errors.append(f"{prefix}: {Q}type{Q} must be a string, got {Q}{type(ptype).__name__}{Q}")
        elif ptype not in ("file",):
            errors.append(f"{prefix}: {Q}type{Q} {Q}{ptype}{Q} is unknown (expected {Q}file{Q})")

    # ── orgId must be positive integer ──────────────────────────────
    if "orgId" in provider:
        oid = provider["orgId"]
        if not isinstance(oid, int) or isinstance(oid, bool):
            errors.append(f"{prefix}: {Q}orgId{Q} must be a positive integer, got {Q}{type(oid).__name__}{Q}")
        elif oid < 1:
            errors.append(f"{prefix}: {Q}orgId{Q} must be >= 1, got {oid}")

    # ── disableDeletion must be bool ────────────────────────────────
    if "disableDeletion" in provider and not isinstance(provider["disableDeletion"], bool):
        errors.append(f"{prefix}: {Q}disableDeletion{Q} must be a boolean, got {Q}{type(provider['disableDeletion']).__name__}{Q}")

    # ── updateIntervalSeconds must be positive integer ──────────────
    if "updateIntervalSeconds" in provider:
        uis = provider["updateIntervalSeconds"]
        if not isinstance(uis, int) or isinstance(uis, bool):
            errors.append(f"{prefix}: {Q}updateIntervalSeconds{Q} must be a positive integer, got {Q}{type(uis).__name__}{Q}")
        elif uis < 1:
            errors.append(f"{prefix}: {Q}updateIntervalSeconds{Q} must be >= 1, got {uis}")

    # ── allowUiUpdates must be bool ─────────────────────────────────
    if "allowUiUpdates" in provider and not isinstance(provider["allowUiUpdates"], bool):
        errors.append(f"{prefix}: {Q}allowUiUpdates{Q} must be a boolean, got {Q}{type(provider['allowUiUpdates']).__name__}{Q}")

    # ── options validation ──────────────────────────────────────────
    if "options" in provider:
        opts = provider["options"]
        if not isinstance(opts, dict):
            errors.append(f"{prefix}: {Q}options{Q} must be an object")
        else:
            if "path" not in opts:
                errors.append(f"{prefix}: {Q}options.path{Q} is required")
            elif not isinstance(opts["path"], str) or not opts["path"].strip():
                errors.append(f"{prefix}: {Q}options.path{Q} must be a non-empty string")
            if "foldersFromFilesStructure" in opts and not isinstance(opts["foldersFromFilesStructure"], bool):
                errors.append(
                    f"{prefix}: {Q}options.foldersFromFilesStructure{Q} must be a boolean, "
                    f"got {Q}{type(opts['foldersFromFilesStructure']).__name__}{Q}"
                )

    return errors


def validate_dashboard_provider_yaml(filepath: str, data=None) -> bool:
    """Validate a Grafana dashboard provider provisioning YAML file."""
    if data is None:
        data = _load_yaml(filepath)
        if not _yaml_load_ok(data):
            return False

    errors = []
    Q = chr(34)

    # ── apiVersion check ───────────────────────────────────────────
    if data.get("apiVersion") != 1:
        errors.append(f"{Q}apiVersion{Q} must be 1, got {Q}{data.get('apiVersion')!r}{Q}")

    # ── providers array check ──────────────────────────────────────
    if "providers" not in data:
        errors.append(f"Missing required field: {Q}providers{Q} (array of dashboard provider objects)")
        print(f"\u274c SCHEMA ERROR(S) in {filepath}:")
        for e in errors:
            print(f"    \u2022 {e}")
        return False

    prov_list = data["providers"]
    if not isinstance(prov_list, list):
        errors.append(f"{Q}providers{Q} must be an array, got {Q}{type(prov_list).__name__}{Q}")
        print(f"\u274c SCHEMA ERROR(S) in {filepath}:")
        for e in errors:
            print(f"    \u2022 {e}")
        return False

    if len(prov_list) == 0:
        errors.append(f"{Q}providers{Q} is empty — expected at least one provider")
        print(f"\u274c SCHEMA ERROR(S) in {filepath}:")
        for e in errors:
            print(f"    \u2022 {e}")
        return False

    # ── Validate each provider entry ────────────────────────────────
    for i, prov in enumerate(prov_list):
        if not isinstance(prov, dict):
            errors.append(f"Provider #{i}: must be an object, got {Q}{type(prov).__name__}{Q}")
            continue
        errors.extend(_validate_dashboard_provider_entry(prov, i, Q))

    # ── Report results ─────────────────────────────────────────────
    if errors:
        print(f"\u274c SCHEMA ERROR(S) in {filepath}:")
        for e in errors:
            print(f"    \u2022 {e}")
        return False

    prov_count = len(prov_list)
    print(f"  \u2713 Dashboard provider YAML valid: {filepath} ({prov_count} provider(s))")
    return True


# Known Grafana contact point types (as of Grafana 10/11)
_KNOWN_CONTACT_POINT_TYPES = frozenset({
    "slack",
    "pagerduty",
    "email",
    "webhook",
    "discord",
    "telegram",
    "pushover",
    "opsgenie",
    "victorops",
    "sensu",
    "threema",
    "teams",
    "googlechat",
    "line",
    "prometheus-alertmanager",
    "dingding",
    "kafka",
    "sqs",
    "sns",
    "pubsub",
})


def _validate_receiver_entry(receiver: dict, cp_name: str, index: int, Q: str) -> list:
    """Validate a single contact point receiver entry.

    Returns a list of error strings (empty = valid).
    """
    errors = []
    prefix = f"Contact point {Q}{cp_name}{Q} receiver #{index}"

    # ── Required fields ─────────────────────────────────────────────
    if "uid" not in receiver:
        errors.append(f"{prefix}: missing {Q}uid{Q}")
    if "type" not in receiver:
        errors.append(f"{prefix}: missing {Q}type{Q}")

    # ── type validation ─────────────────────────────────────────────
    if "type" in receiver:
        rtype = receiver["type"]
        if not isinstance(rtype, str):
            errors.append(f"{prefix}: {Q}type{Q} must be a string, got {Q}{type(rtype).__name__}{Q}")
        elif rtype not in _KNOWN_CONTACT_POINT_TYPES:
            errors.append(f"{prefix}: unknown {Q}type{Q} {Q}{rtype}{Q}")

    # ── disableResolveMessage must be bool ─────────────────────────
    if "disableResolveMessage" in receiver and not isinstance(receiver["disableResolveMessage"], bool):
        errors.append(
            f"{prefix}: {Q}disableResolveMessage{Q} must be a boolean, "
            f"got {Q}{type(receiver['disableResolveMessage']).__name__}{Q}"
        )

    # ── settings validation ─────────────────────────────────────────
    rtype = receiver.get("type", "")
    settings_required_types = {"slack", "pagerduty", "webhook"}
    if rtype in settings_required_types and "settings" not in receiver:
        errors.append(f"{prefix}: {Q}settings{Q} is required for {Q}{rtype}{Q} receivers")
    elif "settings" in receiver:
        settings = receiver["settings"]
        if not isinstance(settings, dict):
            errors.append(f"{prefix}: {Q}settings{Q} must be an object")
        else:
            errors.extend(_validate_receiver_settings(rtype, settings, prefix, Q))

    return errors


def _validate_receiver_settings(rtype: str, settings: dict, prefix: str, Q: str) -> list:
    """Validate receiver settings based on type.

    Returns a list of error strings (empty = valid).
    """
    errors = []

    if rtype == "slack":
        if "url" not in settings:
            errors.append(f"{prefix}: {Q}settings.url{Q} is required for Slack receivers")
        elif not isinstance(settings["url"], str) or not settings["url"].strip():
            errors.append(f"{prefix}: {Q}settings.url{Q} must be a non-empty string")

    elif rtype == "pagerduty":
        if "integrationKey" not in settings:
            errors.append(f"{prefix}: {Q}settings.integrationKey{Q} is required for PagerDuty receivers")
        elif not isinstance(settings["integrationKey"], str) or not settings["integrationKey"].strip():
            errors.append(f"{prefix}: {Q}settings.integrationKey{Q} must be a non-empty string")

    elif rtype == "webhook":
        if "url" not in settings:
            errors.append(f"{prefix}: {Q}settings.url{Q} is required for webhook receivers")
        elif not isinstance(settings["url"], str) or not settings["url"].strip():
            errors.append(f"{prefix}: {Q}settings.url{Q} must be a non-empty string")

    elif rtype == "email":
        if "addresses" not in settings:
            errors.append(f"{prefix}: {Q}settings.addresses{Q} is required for email receivers")

    return errors


def validate_contact_points_yaml(filepath: str, data=None) -> bool:
    """Validate a Grafana contact points provisioning YAML file."""
    if data is None:
        data = _load_yaml(filepath)
        if not _yaml_load_ok(data):
            return False

    errors = []
    Q = chr(34)

    # ── apiVersion check ───────────────────────────────────────────
    if data.get("apiVersion") != 1:
        errors.append(f"{Q}apiVersion{Q} must be 1, got {Q}{data.get('apiVersion')!r}{Q}")

    # ── contactPoints array check ──────────────────────────────────
    if "contactPoints" not in data:
        errors.append(f"Missing required field: {Q}contactPoints{Q} (array of contact point objects)")
        print(f"\u274c SCHEMA ERROR(S) in {filepath}:")
        for e in errors:
            print(f"    \u2022 {e}")
        return False

    cp_list = data["contactPoints"]
    if not isinstance(cp_list, list):
        errors.append(f"{Q}contactPoints{Q} must be an array, got {Q}{type(cp_list).__name__}{Q}")
        print(f"\u274c SCHEMA ERROR(S) in {filepath}:")
        for e in errors:
            print(f"    \u2022 {e}")
        return False

    if len(cp_list) == 0:
        errors.append(f"{Q}contactPoints{Q} is empty — expected at least one contact point")
        print(f"\u274c SCHEMA ERROR(S) in {filepath}:")
        for e in errors:
            print(f"    \u2022 {e}")
        return False

    # ── Validate each contact point entry ───────────────────────────
    for i, cp in enumerate(cp_list):
        if not isinstance(cp, dict):
            errors.append(f"Contact point #{i}: must be an object, got {Q}{type(cp).__name__}{Q}")
            continue

        cp_prefix = f"Contact point #{i}"

        # ── name validation ─────────────────────────────────────────
        if "name" not in cp:
            errors.append(f"{cp_prefix}: missing {Q}name{Q}")

        cp_name = cp.get("name", f"#{i}")

        # ── orgId validation ────────────────────────────────────────
        if "orgId" in cp:
            oid = cp["orgId"]
            if not isinstance(oid, int) or isinstance(oid, bool):
                errors.append(f"{cp_prefix}: {Q}orgId{Q} must be a positive integer, got {Q}{type(oid).__name__}{Q}")
            elif oid < 1:
                errors.append(f"{cp_prefix}: {Q}orgId{Q} must be >= 1, got {oid}")

        # ── receivers array check ───────────────────────────────────
        if "receivers" not in cp:
            errors.append(f"{cp_prefix}: missing {Q}receivers{Q} (array of receiver objects)")
            continue

        recv_list = cp["receivers"]
        if not isinstance(recv_list, list):
            errors.append(f"{cp_prefix}: {Q}receivers{Q} must be an array, got {Q}{type(recv_list).__name__}{Q}")
            continue

        if len(recv_list) == 0:
            errors.append(f"{cp_prefix}: {Q}receivers{Q} is empty — expected at least one receiver")
            continue

        # ── Validate each receiver entry ────────────────────────────
        for j, recv in enumerate(recv_list):
            if not isinstance(recv, dict):
                errors.append(f"{cp_prefix} receiver #{j}: must be an object, got {Q}{type(recv).__name__}{Q}")
                continue
            errors.extend(_validate_receiver_entry(recv, cp_name, j, Q))

    # ── Report results ─────────────────────────────────────────────
    if errors:
        print(f"\u274c SCHEMA ERROR(S) in {filepath}:")
        for e in errors:
            print(f"    \u2022 {e}")
        return False

    cp_count = len(cp_list)
    print(f"  \u2713 Contact points YAML valid: {filepath} ({cp_count} contact point(s))")
    return True


# ── Notification Policy Constants ──────────────────────────────────────────────

# Valid Grafana duration units for group timers
_KNOWN_DURATION_UNITS = frozenset({"s", "m", "h", "d", "w"})

# Valid operators for object_matchers
_KNOWN_MATCHER_OPERATORS = frozenset({
    "=",     # Equal
    "!=",    # Not equal
    "=~",    # Regex match
    "!~",    # Regex not match
})


def _validate_duration(value, field_name: str, prefix: str, Q: str) -> list:
    """Validate a Grafana duration string (e.g. "30s", "5m", "4h", "1d", "2w").

    Returns a list of error strings (empty = valid).
    """
    errors = []
    if not isinstance(value, str):
        errors.append(
            f"{prefix}: {Q}{field_name}{Q} must be a duration string, "
            f"got {Q}{type(value).__name__}{Q}"
        )
        return errors

    if not value.strip():
        errors.append(f"{prefix}: {Q}{field_name}{Q} must not be empty")
        return errors

    # Match pattern: one or more digits followed by a unit (s, m, h, d, w)
    import re
    if not re.fullmatch(r"\d+([smhdw])", value):
        units_str = ", ".join(sorted(_KNOWN_DURATION_UNITS))
        errors.append(
            f"{prefix}: {Q}{field_name}{Q} {Q}{value}{Q} is not a valid duration "
            f"(expected number + unit, e.g. 30s, 5m, 4h, 1d; valid units: {units_str})"
        )
    return errors


def _validate_object_matchers(matchers: list, prefix: str, Q: str) -> list:
    """Validate Grafana object_matchers format: [[key, operator, value], ...].

    Returns a list of error strings (empty = valid).
    """
    errors = []
    if not isinstance(matchers, list):
        errors.append(
            f"{prefix}: {Q}object_matchers{Q} must be an array of [key, operator, value] tuples, "
            f"got {Q}{type(matchers).__name__}{Q}"
        )
        return errors

    for i, m in enumerate(matchers):
        if not isinstance(m, list):
            errors.append(
                f"{prefix}: {Q}object_matchers{Q}[{i}] must be an array "
                f"[key, operator, value], got {Q}{type(m).__name__}{Q}"
            )
            continue
        if len(m) != 3:
            errors.append(
                f"{prefix}: {Q}object_matchers{Q}[{i}] must have exactly 3 elements "
                f"[key, operator, value], got {len(m)}"
            )
            continue
        key, op, val = m
        if not isinstance(key, str):
            errors.append(
                f"{prefix}: {Q}object_matchers{Q}[{i}][0] (key) must be a string, "
                f"got {Q}{type(key).__name__}{Q}"
            )
        if not isinstance(op, str) or op not in _KNOWN_MATCHER_OPERATORS:
            ops_str = ", ".join(_KNOWN_MATCHER_OPERATORS)
            errors.append(
                f"{prefix}: {Q}object_matchers{Q}[{i}][1] (operator) must be one of "
                f"({ops_str}), got {Q}{op!r}{Q}"
            )
        if not isinstance(val, str):
            errors.append(
                f"{prefix}: {Q}object_matchers{Q}[{i}][2] (value) must be a string, "
                f"got {Q}{type(val).__name__}{Q}"
            )

    return errors


def _validate_notification_policy_entry(policy: dict, prefix: str, Q: str, depth: int = 0) -> list:
    """Validate a single Grafana notification policy (root or nested route).

    Supports recursive validation for nested 'routes'. The depth parameter
    tracks nesting level to give meaningful error messages.

    Returns a list of error strings (empty = valid).
    """
    errors = []
    max_depth = 5  # Safety limit to prevent infinite recursion on circular refs

    if depth > max_depth:
        errors.append(f"{prefix}: maximum nesting depth ({max_depth}) exceeded — circular reference?")
        return errors

    # ── receiver: required for leaf policies ──────────────────────────
    if "receiver" not in policy:
        errors.append(f"{prefix}: missing {Q}receiver{Q}")
    elif not isinstance(policy["receiver"], str) or not policy["receiver"].strip():
        errors.append(f"{prefix}: {Q}receiver{Q} must be a non-empty string")

    # ── orgId: positive integer ───────────────────────────────────────
    if "orgId" in policy:
        oid = policy["orgId"]
        if not isinstance(oid, int) or isinstance(oid, bool):
            errors.append(f"{prefix}: {Q}orgId{Q} must be a positive integer, got {Q}{type(oid).__name__}{Q}")
        elif oid < 1:
            errors.append(f"{prefix}: {Q}orgId{Q} must be >= 1, got {oid}")

    # ── group_by: array of strings ────────────────────────────────────
    if "group_by" in policy:
        gb = policy["group_by"]
        if not isinstance(gb, list):
            errors.append(f"{prefix}: {Q}group_by{Q} must be an array of label strings")
        else:
            for i, label in enumerate(gb):
                if not isinstance(label, str):
                    errors.append(
                        f"{prefix}: {Q}group_by{Q}[{i}] must be a string, "
                        f"got {Q}{type(label).__name__}{Q}"
                    )

    # ── Duration fields: group_wait, group_interval, repeat_interval ──
    for dur_field in ("group_wait", "group_interval", "repeat_interval"):
        if dur_field in policy:
            errors.extend(_validate_duration(policy[dur_field], dur_field, prefix, Q))

    # ── continue: bool (only meaningful on nested routes) ─────────────
    if "continue" in policy and not isinstance(policy["continue"], bool):
        errors.append(
            f"{prefix}: {Q}continue{Q} must be a boolean, "
            f"got {Q}{type(policy['continue']).__name__}{Q}"
        )

    # ── object_matchers ───────────────────────────────────────────────
    if "object_matchers" in policy:
        errors.extend(_validate_object_matchers(policy["object_matchers"], prefix, Q))

    # ── matchers (legacy string format: 'severity=critical') ───────────
    if "matchers" in policy:
        matchers_list = policy["matchers"]
        if not isinstance(matchers_list, list):
            errors.append(
                f"{prefix}: {Q}matchers{Q} must be an array of matcher strings, "
                f"got {Q}{type(matchers_list).__name__}{Q}"
            )
        else:
            import re
            for i, m_str in enumerate(matchers_list):
                if not isinstance(m_str, str):
                    errors.append(
                        f"{prefix}: {Q}matchers{Q}[{i}] must be a string, "
                        f"got {Q}{type(m_str).__name__}{Q}"
                    )
                elif not re.fullmatch(r"[\w.]+(?:=|!=|=~|!~)[\w.*-]+", str(m_str)):
                    errors.append(
                        f"{prefix}: {Q}matchers{Q}[{i}] {Q}{m_str}{Q} is not valid "
                        f"(expected format: key=value, key!=value, key=~value, key!~value)"
                    )

    # ── routes: recursive nested policies ─────────────────────────────
    if "routes" in policy:
        routes = policy["routes"]
        if not isinstance(routes, list):
            errors.append(
                f"{prefix}: {Q}routes{Q} must be an array of policy objects, "
                f"got {Q}{type(routes).__name__}{Q}"
            )
        else:
            for j, route in enumerate(routes):
                if not isinstance(route, dict):
                    errors.append(
                        f"{prefix}: {Q}routes{Q}[{j}] must be an object, "
                        f"got {Q}{type(route).__name__}{Q}"
                    )
                    continue
                child_prefix = f"{prefix} route #{j}"
                errors.extend(_validate_notification_policy_entry(route, child_prefix, Q, depth + 1))

    return errors


def validate_notification_policies_yaml(filepath: str, data=None) -> bool:
    """Validate a Grafana notification policies provisioning YAML file."""
    if data is None:
        data = _load_yaml(filepath)
        if not _yaml_load_ok(data):
            return False

    errors = []
    Q = chr(34)

    # ── apiVersion check ───────────────────────────────────────────
    if data.get("apiVersion") != 1:
        errors.append(f"{Q}apiVersion{Q} must be 1, got {Q}{data.get('apiVersion')!r}{Q}")

    # ── policies array check ───────────────────────────────────────
    if "policies" not in data:
        errors.append(f"Missing required field: {Q}policies{Q} (array of notification policy objects)")
        print(f"\u274c SCHEMA ERROR(S) in {filepath}:")
        for e in errors:
            print(f"    \u2022 {e}")
        return False

    pol_list = data["policies"]
    if not isinstance(pol_list, list):
        errors.append(f"{Q}policies{Q} must be an array, got {Q}{type(pol_list).__name__}{Q}")
        print(f"\u274c SCHEMA ERROR(S) in {filepath}:")
        for e in errors:
            print(f"    \u2022 {e}")
        return False

    if len(pol_list) == 0:
        errors.append(f"{Q}policies{Q} is empty — expected at least one policy")
        print(f"\u274c SCHEMA ERROR(S) in {filepath}:")
        for e in errors:
            print(f"    \u2022 {e}")
        return False

    # ── Validate each top-level policy entry ───────────────────────────
    for i, pol in enumerate(pol_list):
        if not isinstance(pol, dict):
            errors.append(f"Policy #{i}: must be an object, got {Q}{type(pol).__name__}{Q}")
            continue
        prefix = f"Policy #{i}"
        errors.extend(_validate_notification_policy_entry(pol, prefix, Q, depth=0))

    # ── Report results ─────────────────────────────────────────────
    if errors:
        print(f"\u274c SCHEMA ERROR(S) in {filepath}:")
        for e in errors:
            print(f"    \u2022 {e}")
        return False

    pol_count = len(pol_list)
    print(f"  \u2713 Notification policies YAML valid: {filepath} ({pol_count} top-level policy/policies)")
    return True


# Grafana special timezone values + common IANA timezones
_VALID_TIMEZONES = frozenset({
    # Grafana special values
    "utc",
    "UTC",
    "browser",
    "local",
    # Africa
    "Africa/Cairo", "Africa/Casablanca", "Africa/Johannesburg", "Africa/Lagos",
    "Africa/Nairobi", "Africa/Tunis",
    # America
    "America/Argentina/Buenos_Aires", "America/Bogota", "America/Caracas",
    "America/Chicago", "America/Denver", "America/Edmonton", "America/Halifax",
    "America/Lima", "America/Los_Angeles", "America/Mexico_City",
    "America/New_York", "America/Phoenix", "America/Santiago", "America/Sao_Paulo",
    "America/St_Johns", "America/Toronto", "America/Vancouver", "America/Winnipeg",
    # Asia
    "Asia/Bangkok", "Asia/Colombo", "Asia/Dhaka", "Asia/Dubai",
    "Asia/Hong_Kong", "Asia/Jakarta", "Asia/Kolkata", "Asia/Kuala_Lumpur",
    "Asia/Kuwait", "Asia/Manila", "Asia/Riyadh", "Asia/Seoul",
    "Asia/Shanghai", "Asia/Singapore", "Asia/Taipei", "Asia/Tokyo",
    # Atlantic
    "Atlantic/Reykjavik",
    # Australia
    "Australia/Adelaide", "Australia/Brisbane", "Australia/Darwin",
    "Australia/Melbourne", "Australia/Perth", "Australia/Sydney",
    # Europe
    "Europe/Amsterdam", "Europe/Athens", "Europe/Berlin", "Europe/Brussels",
    "Europe/Dublin", "Europe/Helsinki", "Europe/Istanbul", "Europe/Lisbon",
    "Europe/London", "Europe/Madrid", "Europe/Moscow", "Europe/Oslo",
    "Europe/Paris", "Europe/Prague", "Europe/Rome", "Europe/Stockholm",
    "Europe/Vienna", "Europe/Warsaw", "Europe/Zurich",
    # Pacific
    "Pacific/Auckland", "Pacific/Fiji", "Pacific/Honolulu",
})


# Known Grafana panel types (as of Grafana 10/11)
_VALID_PANEL_TYPES = frozenset({
    "stat",
    "timeseries",
    "table",
    "gauge",
    "bargauge",
    "piechart",
    "state-timeline",
    "status-history",
    "text",
    "heatmap",
    "candlestick",
    "logs",
    "traces",
    "nodeGraph",
    "flamegraph",
    "canvas",
    "datagrid",
    "geomap",
    "news",
    "alertlist",
    "row",
    "dashlist",
})


def _validate_gridpos(gridpos: dict, prefix: str, Q: str) -> list:
    """Validate a Grafana gridPos object.

    Returns a list of error strings (empty = valid).
    """
    errors = []

    if not isinstance(gridpos, dict):
        errors.append(f"{prefix}: {Q}gridPos{Q} must be an object with {Q}h{Q}, {Q}w{Q}, {Q}x{Q}, {Q}y{Q}")
        return errors

    required = ["h", "w", "x", "y"]
    for field in required:
        if field not in gridpos:
            errors.append(f"{prefix}: {Q}gridPos.{field}{Q} is required")

    # Validate each field if present
    for field in required:
        if field in gridpos:
            val = gridpos[field]
            if not isinstance(val, int) or isinstance(val, bool):
                errors.append(
                    f"{prefix}: {Q}gridPos.{field}{Q} must be a positive integer, got {Q}{type(val).__name__}{Q}"
                )
            elif field in ("h", "w") and val < 1:
                errors.append(
                    f"{prefix}: {Q}gridPos.{field}{Q} must be >= 1, got {val}"
                )
            elif field in ("x", "y") and val < 0:
                errors.append(
                    f"{prefix}: {Q}gridPos.{field}{Q} must be >= 0, got {val}"
                )

    return errors


def _validate_panel_type(panel: dict, prefix: str, Q: str) -> list:
    """Validate that a panel has a known Grafana type.

    Returns a list of error strings (empty = valid).
    """
    errors = []
    if "type" not in panel:
        sample = sorted(_VALID_PANEL_TYPES)[:5]
        examples = Q + (Q + ", " + Q).join(sample) + Q
        errors.append(
            f"{prefix}: missing {Q}type{Q} (e.g. {examples})"
        )
        return errors

    ptype = panel["type"]
    if not isinstance(ptype, str):
        errors.append(
            f"{prefix}: {Q}type{Q} must be a string, got {Q}{type(ptype).__name__}{Q}"
        )
        return errors

    if ptype not in _VALID_PANEL_TYPES:
        valid = Q + (Q + ", " + Q).join(sorted(_VALID_PANEL_TYPES)) + Q
        errors.append(
            f"{prefix}: unknown {Q}type{Q} {Q}{ptype}{Q} (valid types: {valid})"
        )

    return errors


def validate_dashboard_json(filepath: str) -> bool:
    """Check that a Grafana dashboard JSON has the required schema fields."""
    Q = chr(34)

    try:
        with open(filepath) as fh:
            dash = json.load(fh)
    except FileNotFoundError:
        print(f"\u274c FILE NOT FOUND: {filepath}")
        return False
    except PermissionError:
        print(f"\u274c PERMISSION DENIED: {filepath}")
        return False
    except IsADirectoryError:
        print(f"\u274c IS A DIRECTORY: {filepath}")
        return False
    except OSError as e:
        print(f"\u274c FILE ERROR in {filepath}:")
        print(f"    {e}")
        return False
    except json.JSONDecodeError as e:
        print(f"\u274c JSON ERROR in {filepath}:")
        print(f"    {e}")
        return False

    errors = []

    # ── Required top-level fields ────────────────────────────────────
    if "title" not in dash:
        errors.append("Missing required field: title")
    if "panels" not in dash:
        errors.append("Missing required field: panels (array of panel objects)")
    if "schemaVersion" not in dash:
        errors.append("Missing recommended field: schemaVersion")
    if "timezone" not in dash:
        errors.append("Missing recommended field: timezone")

    # ── schemaVersion must be positive integer ───────────────────────
    if "schemaVersion" in dash:
        sv_val = dash["schemaVersion"]
        if not isinstance(sv_val, int) or isinstance(sv_val, bool):
            errors.append(f"Field {Q}schemaVersion{Q} must be a positive integer, got {Q}{type(sv_val).__name__}{Q}")
        elif sv_val < 1:
            errors.append(f"Field {Q}schemaVersion{Q} must be >= 1, got {sv_val}")

    # ── timezone must be valid ───────────────────────────────────────
    if "timezone" in dash:
        tz_val = dash["timezone"]
        if not isinstance(tz_val, str):
            errors.append(f"Field {Q}timezone{Q} must be a string, got {Q}{type(tz_val).__name__}{Q}")
        elif tz_val not in _VALID_TIMEZONES:
            errors.append(
                f"Field {Q}timezone{Q} {Q}{tz_val}{Q} is unknown "
                f"(expected a valid IANA timezone or one of {Q}utc{Q}, {Q}browser{Q}, {Q}local{Q})"
            )

    # ── Title must be non-empty ──────────────────────────────────────
    if not (dash.get("title") or "").strip():
        errors.append(f"Field {Q}title{Q} must be a non-empty string")

    # ── Panels validation ────────────────────────────────────────────
    dash_panels = dash.get("panels", [])
    if not isinstance(dash_panels, list):
        errors.append(f"Field {Q}panels{Q} must be an array")
    elif len(dash_panels) == 0:
        errors.append("Dashboard has zero panels \u2014 expected at least one")
    else:
        for i, panel in enumerate(dash_panels):
            pid = panel.get("id", i)
            # Collapsible sections nest panels inside
            sub_panels = panel.get("panels", [])
            is_container = isinstance(sub_panels, list) and len(sub_panels) > 0
            if is_container:
                # Row/section container with nested panels — don't require type on the container itself
                for j, sub in enumerate(sub_panels):
                    section_title = panel.get("title") or str(pid)
                    if "title" not in sub:
                        errors.append(
                            f"SECTION {Q}{section_title}{Q} panel #{j}: missing {Q}title{Q}"
                        )
                    elif not (sub.get("title") or "").strip():
                        errors.append(
                            f"SECTION {Q}{section_title}{Q} panel #{j}: {Q}title{Q} must be a non-empty string"
                        )
                    if "gridPos" not in sub:
                        errors.append(
                            f"SECTION {Q}{section_title}{Q} panel #{j}: missing {Q}gridPos{Q}"
                        )
                    else:
                        gprefix = f"SECTION {Q}{section_title}{Q} panel #{j}"
                        errors.extend(_validate_gridpos(sub["gridPos"], gprefix, Q))
                    errors.extend(_validate_panel_type(sub, f"SECTION {Q}{section_title}{Q} panel #{j}", Q))
            else:
                if "title" not in panel:
                    errors.append(f"Panel #{pid}: missing {Q}title{Q}")
                elif not (panel.get("title") or "").strip():
                    errors.append(f"Panel #{pid}: {Q}title{Q} must be a non-empty string")
                if "gridPos" not in panel:
                    errors.append(
                        f"Panel #{pid}: missing {Q}gridPos{Q} (h, w, x, y)"
                    )
                else:
                    gprefix = f"Panel #{pid}"
                    errors.extend(_validate_gridpos(panel["gridPos"], gprefix, Q))
                # Only require type on non-container panels
                errors.extend(_validate_panel_type(panel, f"Panel #{pid}", Q))

    # ── Report results ──────────────────────────────────────────────
    if errors:
        print(f"\u274c SCHEMA ERROR(S) in {filepath}:")
        for e in errors:
            print(f"    \u2022 {e}")
        return False

    panel_count = len(dash_panels)
    sub_count = sum(
        len(p.get("panels", []))
        for p in dash_panels
        if isinstance(p.get("panels", []), list)
    )
    total = panel_count + sub_count
    sv = dash.get("schemaVersion", "?")
    print(f"  \u2713 JSON valid + schema OK: {filepath} ({total} panels, schemaVersion={sv})")
    return True


# ── Alert Rule Constants ────────────────────────────────────────────────────

# Valid noDataState values for Grafana alert rules
_KNOWN_NO_DATA_STATES = frozenset({"Alerting", "NoData", "OK", "KeepLast"})

# Valid execErrState values for Grafana alert rules
_KNOWN_EXEC_ERR_STATES = frozenset({"Alerting", "Error", "KeepLast"})


def _validate_relative_time_range(rtr: dict, prefix: str, Q: str) -> list:
    """Validate a Grafana relativeTimeRange object (from/to as non-negative ints).

    Returns a list of error strings (empty = valid).
    """
    errors = []
    if not isinstance(rtr, dict):
        errors.append(f"{prefix}: {Q}relativeTimeRange{Q} must be an object")
        return errors

    for field in ("from", "to"):
        if field in rtr:
            val = rtr[field]
            if not isinstance(val, int) or isinstance(val, bool):
                errors.append(
                    f"{prefix}: {Q}relativeTimeRange.{field}{Q} must be a non-negative integer, "
                    f"got {Q}{type(val).__name__}{Q}"
                )
            elif val < 0:
                errors.append(f"{prefix}: {Q}relativeTimeRange.{field}{Q} must be >= 0, got {val}")
    return errors


def _validate_promql_expr(expr: str, prefix: str, Q: str) -> list:
    """Basic PromQL expression validation.

    Checks for non-empty, balanced parentheses/brackets/braces.
    Does NOT fully parse PromQL (would require a library).

    Returns a list of error strings (empty = valid).
    """
    errors = []
    if not isinstance(expr, str) or not expr.strip():
        errors.append(f"{prefix}: expression/expr must be a non-empty string")
        return errors

    # Check balanced parentheses, brackets, braces
    stack = []
    pairs = {"{": "}", "[": "]", "(": ")"}
    for i, ch in enumerate(expr):
        if ch in "{[" or ch == "(":
            stack.append((ch, i))
        elif ch in "}]":
            if not stack:
                errors.append(
                    f"{prefix}: unmatched closing {Q}{ch}{Q} at position {i}"
                )
                return errors
            open_ch, _ = stack.pop()
            expected_closing = pairs.get(open_ch, "")
            if ch != expected_closing:
                errors.append(
                    f"{prefix}: mismatched bracket: {Q}{open_ch}{Q} opened at position {_}, "
                    f"closed with {Q}{ch}{Q} at position {i}"
                )
                return errors
        elif ch == ")":
            if not stack:
                errors.append(
                    f"{prefix}: unmatched closing {Q}){Q} at position {i}"
                )
                return errors
            open_ch, _ = stack.pop()
            if open_ch != "(":
                errors.append(
                    f"{prefix}: mismatched bracket: {Q}{open_ch}{Q} opened at position {_}, "
                    f"closed with {Q}{ch}{Q} at position {i}"
                )
                return errors

    if stack:
        missing = "".join(pairs[ch] for ch, _ in reversed(stack))
        errors.append(
            f"{prefix}: unclosed brackets/braces/parens: expected {Q}{missing}{Q} "
            f"at end of expression"
        )

    return errors


def _validate_rule_data_entry(entry: dict, index: int, prefix: str, Q: str) -> list:
    """Validate a single alert rule data query entry.

    Returns a list of error strings (empty = valid).
    """
    errors = []
    data_prefix = f"{prefix} data #{index}"

    # ── refId: required, non-empty string ────────────────────────────
    if "refId" not in entry:
        errors.append(f"{data_prefix}: missing {Q}refId{Q}")
    elif not isinstance(entry["refId"], str) or not entry["refId"].strip():
        errors.append(f"{data_prefix}: {Q}refId{Q} must be a non-empty string")

    # ── datasourceUid: required, non-empty string ────────────────────
    if "datasourceUid" not in entry:
        errors.append(f"{data_prefix}: missing {Q}datasourceUid{Q}")
    elif not isinstance(entry["datasourceUid"], str) or not entry["datasourceUid"].strip():
        errors.append(f"{data_prefix}: {Q}datasourceUid{Q} must be a non-empty string")

    # ── relativeTimeRange: validate if present ───────────────────────
    if "relativeTimeRange" in entry:
        errors.extend(_validate_relative_time_range(entry["relativeTimeRange"], data_prefix, Q))

    # ── model: validate expression/expr ──────────────────────────────
    if "model" not in entry:
        errors.append(f"{data_prefix}: missing {Q}model{Q} (query model)")
    elif not isinstance(entry["model"], dict):
        errors.append(f"{data_prefix}: {Q}model{Q} must be an object")
    else:
        model = entry["model"]
        model_type = model.get("type", "")
        if model_type == "math":
            if "expression" not in model:
                errors.append(f"{data_prefix}: {Q}model.expression{Q} is required for math queries")
            else:
                errors.extend(_validate_promql_expr(model["expression"], data_prefix, Q))
        else:
            # Prometheus or default type should have 'expr'
            if "expr" not in model:
                errors.append(f"{data_prefix}: {Q}model.expr{Q} is required for Prometheus queries")
            elif not isinstance(model["expr"], str) or not model["expr"].strip():
                errors.append(f"{data_prefix}: {Q}model.expr{Q} must be a non-empty string")
            else:
                errors.extend(_validate_promql_expr(model["expr"], data_prefix, Q))

    # ── intervalMs: positive int ─────────────────────────────────────
    if "intervalMs" in entry:
        ims = entry["intervalMs"]
        if not isinstance(ims, int) or isinstance(ims, bool):
            errors.append(f"{data_prefix}: {Q}intervalMs{Q} must be a positive integer, got {Q}{type(ims).__name__}{Q}")
        elif ims < 1:
            errors.append(f"{data_prefix}: {Q}intervalMs{Q} must be >= 1, got {ims}")

    # ── maxDataPoints: positive int ──────────────────────────────────
    if "maxDataPoints" in entry:
        mdp = entry["maxDataPoints"]
        if not isinstance(mdp, int) or isinstance(mdp, bool):
            errors.append(f"{data_prefix}: {Q}maxDataPoints{Q} must be a positive integer, got {Q}{type(mdp).__name__}{Q}")
        elif mdp < 1:
            errors.append(f"{data_prefix}: {Q}maxDataPoints{Q} must be >= 1, got {mdp}")

    return errors


def _validate_rule(rule: dict, prefix: str, Q: str) -> list:
    """Validate a single Grafana alert rule.

    Returns a list of error strings (empty = valid).
    """
    errors = []

    # ── uid: required, non-empty string ──────────────────────────────
    if "uid" not in rule:
        errors.append(f"{prefix}: missing {Q}uid{Q}")
    elif not isinstance(rule["uid"], str) or not rule["uid"].strip():
        errors.append(f"{prefix}: {Q}uid{Q} must be a non-empty string")

    # ── title: required, non-empty string ────────────────────────────
    if "title" not in rule:
        errors.append(f"{prefix}: missing {Q}title{Q}")
    elif not isinstance(rule["title"], str) or not rule["title"].strip():
        errors.append(f"{prefix}: {Q}title{Q} must be a non-empty string")

    # ── condition: required, must match a data refId ─────────────────
    condition = rule.get("condition", "")
    if "condition" not in rule:
        errors.append(f"{prefix}: missing {Q}condition{Q}")
    elif not isinstance(condition, str) or not condition.strip():
        errors.append(f"{prefix}: {Q}condition{Q} must be a non-empty string")

    # ── data: non-empty array of query entries ───────────────────────
    ref_ids = set()
    if "data" not in rule:
        errors.append(f"{prefix}: missing {Q}data{Q} (array of query data entries)")
    else:
        data_list = rule["data"]
        if not isinstance(data_list, list):
            errors.append(f"{prefix}: {Q}data{Q} must be an array")
        elif len(data_list) == 0:
            errors.append(f"{prefix}: {Q}data{Q} is empty — expected at least one query")
        else:
            for j, entry in enumerate(data_list):
                if not isinstance(entry, dict):
                    errors.append(f"{prefix} data #{j}: must be an object, got {Q}{type(entry).__name__}{Q}")
                    continue
                errors.extend(_validate_rule_data_entry(entry, j, prefix, Q))
                # Collect refIds for condition cross-reference
                if isinstance(entry, dict) and "refId" in entry and isinstance(entry["refId"], str):
                    ref_ids.add(entry["refId"])

    # ── condition cross-reference: must match a data refId ───────────
    if condition and ref_ids:
        if condition not in ref_ids:
            refs_str = ", ".join(sorted(ref_ids))
            errors.append(
                f"{prefix}: {Q}condition{Q} {Q}{condition}{Q} does not match any "
                f"{Q}data{Q} entry {Q}refId{Q} ({refs_str})"
            )

    # ── for: duration string ─────────────────────────────────────────
    if "for" in rule:
        errors.extend(_validate_duration(rule["for"], "for", prefix, Q))

    # ── noDataState: must be a known value ───────────────────────────
    if "noDataState" in rule:
        nds = rule["noDataState"]
        if not isinstance(nds, str) or nds not in _KNOWN_NO_DATA_STATES:
            valid_str = ", ".join(sorted(_KNOWN_NO_DATA_STATES))
            errors.append(
                f"{prefix}: {Q}noDataState{Q} {Q}{nds}{Q} is invalid "
                f"(expected one of: {valid_str})"
            )

    # ── execErrState: must be a known value ──────────────────────────
    if "execErrState" in rule:
        ees = rule["execErrState"]
        if not isinstance(ees, str) or ees not in _KNOWN_EXEC_ERR_STATES:
            valid_str = ", ".join(sorted(_KNOWN_EXEC_ERR_STATES))
            errors.append(
                f"{prefix}: {Q}execErrState{Q} {Q}{ees}{Q} is invalid "
                f"(expected one of: {valid_str})"
            )

    # ── annotations: must be dict ────────────────────────────────────
    if "annotations" in rule and not isinstance(rule["annotations"], dict):
        errors.append(f"{prefix}: {Q}annotations{Q} must be an object")

    # ── labels: must be dict ─────────────────────────────────────────
    if "labels" in rule and not isinstance(rule["labels"], dict):
        errors.append(f"{prefix}: {Q}labels{Q} must be an object")

    return errors


def _validate_group(group: dict, index: int, Q: str) -> list:
    """Validate a single Grafana alert rule group.

    Returns a list of error strings (empty = valid).
    """
    errors = []
    prefix = f"Group #{index}"

    # ── name: required, non-empty string ─────────────────────────────
    if "name" not in group:
        errors.append(f"{prefix}: missing {Q}name{Q}")
    elif not isinstance(group["name"], str) or not group["name"].strip():
        errors.append(f"{prefix}: {Q}name{Q} must be a non-empty string")

    # ── folder: non-empty string if present ──────────────────────────
    if "folder" in group:
        if not isinstance(group["folder"], str) or not group["folder"].strip():
            errors.append(f"{prefix}: {Q}folder{Q} must be a non-empty string")

    # ── interval: duration string ────────────────────────────────────
    if "interval" in group:
        errors.extend(_validate_duration(group["interval"], "interval", prefix, Q))

    # ── rules: non-empty array ───────────────────────────────────────
    group_name = group.get("name", f"#{index}")
    if "rules" not in group:
        errors.append(f"{prefix}: missing {Q}rules{Q} (array of alert rule objects)")
    else:
        rules_list = group["rules"]
        if not isinstance(rules_list, list):
            errors.append(f"{prefix}: {Q}rules{Q} must be an array")
        elif len(rules_list) == 0:
            errors.append(f"{prefix}: {Q}rules{Q} is empty — expected at least one rule")
        else:
            for j, rule in enumerate(rules_list):
                if not isinstance(rule, dict):
                    errors.append(f"{prefix} rule #{j}: must be an object, got {Q}{type(rule).__name__}{Q}")
                    continue
                rule_prefix = f"{prefix} rule {Q}{rule.get('uid', f'#{j}')}{Q}"
                errors.extend(_validate_rule(rule, rule_prefix, Q))

    return errors


def validate_alert_rules_yaml(filepath: str, data=None) -> bool:
    """Validate a Grafana alert rules provisioning YAML file."""
    if data is None:
        data = _load_yaml(filepath)
        if not _yaml_load_ok(data):
            return False

    errors = []
    Q = chr(34)

    # ── apiVersion check ───────────────────────────────────────────
    if data.get("apiVersion") != 1:
        errors.append(f"{Q}apiVersion{Q} must be 1, got {Q}{data.get('apiVersion')!r}{Q}")

    # ── groups array check ───────────────────────────────────────────
    if "groups" not in data:
        errors.append(f"Missing required field: {Q}groups{Q} (array of rule group objects)")
        print(f"\u274c SCHEMA ERROR(S) in {filepath}:")
        for e in errors:
            print(f"    \u2022 {e}")
        return False

    groups_list = data["groups"]
    if not isinstance(groups_list, list):
        errors.append(f"{Q}groups{Q} must be an array, got {Q}{type(groups_list).__name__}{Q}")
        print(f"\u274c SCHEMA ERROR(S) in {filepath}:")
        for e in errors:
            print(f"    \u2022 {e}")
        return False

    if len(groups_list) == 0:
        errors.append(f"{Q}groups{Q} is empty — expected at least one group")
        print(f"\u274c SCHEMA ERROR(S) in {filepath}:")
        for e in errors:
            print(f"    \u2022 {e}")
        return False

    # ── Validate each group entry ─────────────────────────────────────
    for i, group in enumerate(groups_list):
        if not isinstance(group, dict):
            errors.append(f"Group #{i}: must be an object, got {Q}{type(group).__name__}{Q}")
            continue
        errors.extend(_validate_group(group, i, Q))

    # ── Report results ─────────────────────────────────────────────
    if errors:
        print(f"\u274c SCHEMA ERROR(S) in {filepath}:")
        for e in errors:
            print(f"    \u2022 {e}")
        return False

    groups_count = len(groups_list)
    total_rules = sum(
        len(g.get("rules", []))
        for g in groups_list
        if isinstance(g, dict) and isinstance(g.get("rules", []), list)
    )
    print(f"  \u2713 Alert rules YAML valid: {filepath} ({groups_count} group(s), {total_rules} rule(s))")
    return True


# ── Cross-File Validation Helpers ────────────────────────────────────────────


def _extract_contact_point_names(data: dict) -> set:
    """Extract contact point names from a contact_points YAML structure.

    Returns a set of contact point name strings (empty if none found).
    """
    names = set()
    if not isinstance(data, dict):
        return names
    cps = data.get("contactPoints", [])
    if not isinstance(cps, list):
        return names
    for cp in cps:
        if isinstance(cp, dict) and "name" in cp and isinstance(cp["name"], str):
            names.add(cp["name"])
    return names


def _extract_datasource_uids(data: dict) -> set:
    """Extract datasource UIDs from a datasource YAML structure.

    Returns a set of UID strings (empty if none found).
    """
    uids = set()
    if not isinstance(data, dict):
        return uids
    ds_list = data.get("datasources", [])
    if not isinstance(ds_list, list):
        return uids
    for ds in ds_list:
        if isinstance(ds, dict) and "uid" in ds and isinstance(ds["uid"], str):
            uids.add(ds["uid"])
    return uids


def _collect_policy_receiver_refs(policies: list) -> set:
    """Recursively collect all receiver name references from notification policies.

    Traverses nested 'routes' to find all 'receiver' field values.

    Returns a set of receiver name strings.
    """
    receivers = set()
    for pol in policies:
        if not isinstance(pol, dict):
            continue
        if "receiver" in pol and isinstance(pol["receiver"], str):
            receivers.add(pol["receiver"])
        # Recurse into nested routes
        routes = pol.get("routes", [])
        if isinstance(routes, list):
            receivers |= _collect_policy_receiver_refs(routes)
    return receivers


def _collect_alert_datasource_uids(groups: list) -> set:
    """Collect all datasourceUid references from alert rule groups.

    Returns a set of datasourceUid strings (excluding __expr__ which is built-in).
    """
    uids = set()
    for group in groups:
        if not isinstance(group, dict):
            continue
        rules = group.get("rules", [])
        if not isinstance(rules, list):
            continue
        for rule in rules:
            if not isinstance(rule, dict):
                continue
            data_list = rule.get("data", [])
            if not isinstance(data_list, list):
                continue
            for entry in data_list:
                if isinstance(entry, dict) and "datasourceUid" in entry and isinstance(entry["datasourceUid"], str):
                    uid = entry["datasourceUid"]
                    if uid != "__expr__":  # Built-in expression datasource, always available
                        uids.add(uid)
    return uids


def cross_validate_files(
    contact_point_names: set,
    datasource_uids: set,
    policy_data: dict = None,
    alert_data: dict = None,
    policy_path: str = None,
    alert_path: str = None,
) -> list:
    """Cross-validate references between Grafana provisioning files.

    Checks:
    1. Receiver names in notification_policies.yml exist in contact_points.yml
    2. Datasource UIDs in alert_rules.yml exist in datasource.yml

    Returns a list of error strings (empty = all cross-references valid).
    """
    errors = []
    Q = chr(34)

    # ── Check 1: Receiver name cross-reference ───────────────────────
    if policy_data is not None and isinstance(policy_data, dict):
        policies = policy_data.get("policies", [])
        if isinstance(policies, list):
            policy_receivers = _collect_policy_receiver_refs(policies)
            for receiver in sorted(policy_receivers):
                if receiver not in contact_point_names:
                    path_info = f" in {policy_path}" if policy_path else ""
                    errors.append(
                        f"[Cross-file] Receiver {Q}{receiver}{Q} referenced in notification policies"
                        f"{path_info} does not match any contact point name"
                        f" (defined contact points: {Q}{', '.join(sorted(contact_point_names)) or '(none)'}{Q})"
                    )

    # ── Check 2: Datasource UID cross-reference ──────────────────────
    if alert_data is not None and isinstance(alert_data, dict):
        groups = alert_data.get("groups", [])
        if isinstance(groups, list):
            alert_uids = _collect_alert_datasource_uids(groups)
            for uid in sorted(alert_uids):
                if uid not in datasource_uids:
                    path_info = f" in {alert_path}" if alert_path else ""
                    errors.append(
                        f"[Cross-file] Datasource UID {Q}{uid}{Q} referenced in alert rules"
                        f"{path_info} does not match any defined datasource UID"
                        f" (defined UIDs: {Q}{', '.join(sorted(datasource_uids)) or '(none)'}{Q})"
                    )

    return errors


def main(argv: list = None) -> int:
    """Run the Grafana config validator.

    Args:
        argv: Command-line arguments (defaults to sys.argv[1:]).
              Supports positional file paths and --no-cross-file flag.
    """
    import argparse
    parser = argparse.ArgumentParser(
        description="Validate Grafana provisioning YAML and dashboard JSON files.",
        usage="python3 validate-grafana-configs.py <file1> [file2 ...] [--no-cross-file]",
    )
    parser.add_argument(
        "files", nargs="*",
        help="One or more Grafana config files to validate (.yml, .yaml, .json)",
    )
    parser.add_argument(
        "--no-cross-file", action="store_true",
        help="Skip cross-file reference validation (receiver names, datasource UIDs)",
    )
    args = parser.parse_args(argv)
    if not args.files:
        parser.print_usage()
        print("error: at least one file is required")
        return 1

    any_failed = False
    yaml_exts = {"yml", "yaml"}
    run_cross_validate = not args.no_cross_file

    # Cross-reference collectors
    contact_point_names = set()
    datasource_uids = set()
    policy_data_store = None
    alert_data_store = None
    policy_path = None
    alert_path = None

    for f in args.files:
        ext = f.rpartition(".")[-1].lower()
        if ext in yaml_exts:
            data = _load_yaml(f)
            if not _yaml_load_ok(data):
                ok = False
            elif isinstance(data, dict) and "datasources" in data:
                ok = validate_datasource_yaml(f, data)
                # Collect datasource UIDs for cross-reference
                datasource_uids |= _extract_datasource_uids(data)
            elif isinstance(data, dict) and "providers" in data:
                ok = validate_dashboard_provider_yaml(f, data)
            elif isinstance(data, dict) and "contactPoints" in data:
                ok = validate_contact_points_yaml(f, data)
                # Collect contact point names for cross-reference
                contact_point_names |= _extract_contact_point_names(data)
            elif isinstance(data, dict) and "policies" in data:
                ok = validate_notification_policies_yaml(f, data)
                # Store policy data for cross-reference
                policy_data_store = data
                policy_path = f
            elif isinstance(data, dict) and "groups" in data:
                ok = validate_alert_rules_yaml(f, data)
                # Store alert data for cross-reference
                alert_data_store = data
                alert_path = f
            else:
                print(f"  \u2713 YAML valid: {f}")
                ok = True
        elif ext == "json":
            ok = validate_dashboard_json(f)
        else:
            print(f"\u26a0 Skipping unknown file type: {f}")
            ok = True
        if not ok:
            any_failed = True

    # ── Cross-file validation (only if individual files passed and not skipped) ──
    if run_cross_validate and not any_failed and (policy_data_store is not None or alert_data_store is not None):
        cross_errors = cross_validate_files(
            contact_point_names=contact_point_names,
            datasource_uids=datasource_uids,
            policy_data=policy_data_store,
            alert_data=alert_data_store,
            policy_path=policy_path,
            alert_path=alert_path,
        )
        for err in cross_errors:
            print(f"\u274c {err}")
        if cross_errors:
            any_failed = True

    if any_failed:
        print("")
        print("\u274c Some Grafana config files failed validation")
        return 1

    print("")
    print("\u2705 All Grafana config files validated")
    return 0


if __name__ == "__main__":
    sys.exit(main())
