"""Unit tests for weather_service WMO code mapping.

Covers every WMO code in the mapping table plus the derived ``hot`` case
(sunny + max_c >= 40).  Run with ``pytest backend/tests/test_weather.py -v``.
"""

import sys
from pathlib import Path

# allow imports from backend/ without installing the package
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.weather_service import wmo_to_condition, CONDITIONS


class TestWmoMapping:
    """Every WMO code maps to exactly one of the seven UI conditions."""

    def test_sunny_codes(self):
        assert wmo_to_condition(0) == "sunny"
        assert wmo_to_condition(1) == "sunny"

    def test_partly_cloudy(self):
        assert wmo_to_condition(2) == "partly-cloudy"

    def test_cloudy(self):
        assert wmo_to_condition(3) == "cloudy"

    def test_fog_codes(self):
        for code in (45, 48):
            assert wmo_to_condition(code) == "fog"

    def test_rain_codes(self):
        rain_codes = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82]
        for code in rain_codes:
            assert wmo_to_condition(code) == "rain", f"WMO {code} should be rain"

    def test_thunderstorm_codes(self):
        for code in (95, 96, 99):
            assert wmo_to_condition(code) == "thunderstorm"

    def test_unknown_code_defaults_cloudy(self):
        assert wmo_to_condition(999) == "cloudy"
        assert wmo_to_condition(-1) == "cloudy"


class TestHotDerivation:
    """``hot`` = sunny AND max_c >= 40 — never appears from a raw WMO code."""

    def test_sunny_below_40_is_sunny(self):
        assert wmo_to_condition(0, max_c=39.9) == "sunny"
        assert wmo_to_condition(1, max_c=0) == "sunny"

    def test_sunny_at_40_is_hot(self):
        assert wmo_to_condition(0, max_c=40.0) == "hot"
        assert wmo_to_condition(1, max_c=42.5) == "hot"

    def test_sunny_above_40_is_hot(self):
        assert wmo_to_condition(0, max_c=45.0) == "hot"

    def test_non_sunny_at_40_stays_original(self):
        """partly-cloudy at 45C is NOT hot — only sunny can become hot."""
        assert wmo_to_condition(2, max_c=45.0) == "partly-cloudy"
        assert wmo_to_condition(3, max_c=50.0) == "cloudy"
        assert wmo_to_condition(61, max_c=42.0) == "rain"

    def test_sunny_no_max_c_defaults_to_sunny(self):
        """When max_c is None the derived rule cannot fire."""
        assert wmo_to_condition(0, max_c=None) == "sunny"

    def test_boundary_39_9_not_hot(self):
        assert wmo_to_condition(0, max_c=39.9) == "sunny"

    def test_boundary_40_0_is_hot(self):
        assert wmo_to_condition(0, max_c=40.0) == "hot"


class TestConditionEnum:
    """The seven conditions are the only values the mapping can return."""

    def test_all_mapped_codes_produce_valid_condition(self):
        from services.weather_service import _WMO_MAP
        for code, condition in _WMO_MAP.items():
            assert condition in CONDITIONS, f"WMO {code} -> {condition!r} not in CONDITIONS"

    def test_hot_is_in_conditions(self):
        assert "hot" in CONDITIONS

    def test_conditions_count(self):
        assert len(CONDITIONS) == 7
