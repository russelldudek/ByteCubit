#!/usr/bin/env python3
"""Verify the live Signal Twin workbench never clips its readouts or controls."""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass

from playwright.sync_api import sync_playwright


@dataclass(frozen=True)
class Viewport:
    width: int
    height: int


VIEWPORTS = (
    Viewport(1440, 900),
    Viewport(1280, 800),
    Viewport(768, 1024),
    Viewport(390, 844),
    Viewport(320, 800),
)


def verify_viewport(page, viewport: Viewport, base_url: str) -> None:
    page.set_viewport_size({"width": viewport.width, "height": viewport.height})
    page.goto(f"{base_url.rstrip('/')}/", wait_until="networkidle")
    page.locator(".workbench-frame").wait_for(state="visible")

    scenario_buttons = page.locator(".scenario-button")
    button_count = scenario_buttons.count()
    assert button_count == 4, f"Expected four scenario buttons, found {button_count}"

    for index in range(button_count):
        scenario_buttons.nth(index).click()
        page.wait_for_timeout(120)

        geometry = page.evaluate(
            """
            () => {
              const frame = document.querySelector('.workbench-frame');
              const readouts = document.querySelector('.bench-readout');
              const scenarios = document.querySelector('.scenario-row');
              const buttons = [...document.querySelectorAll('.scenario-button')];
              if (!frame || !readouts || !scenarios || buttons.length !== 4) {
                throw new Error('Missing Signal Twin geometry target');
              }
              const frameRect = frame.getBoundingClientRect();
              const readoutRect = readouts.getBoundingClientRect();
              const scenarioRect = scenarios.getBoundingClientRect();
              return {
                frameBottom: frameRect.bottom,
                readoutBottom: readoutRect.bottom,
                scenarioBottom: scenarioRect.bottom,
                buttonBottoms: buttons.map((button) => button.getBoundingClientRect().bottom),
                frameScrollHeight: frame.scrollHeight,
                frameClientHeight: frame.clientHeight,
                documentScrollWidth: document.documentElement.scrollWidth,
                viewportWidth: window.innerWidth,
              };
            }
            """
        )

        tolerance = 1.5
        assert geometry["readoutBottom"] <= geometry["frameBottom"] + tolerance, (
            f"Readouts clipped at {viewport.width}x{viewport.height}: {geometry}"
        )
        assert geometry["scenarioBottom"] <= geometry["frameBottom"] + tolerance, (
            f"Scenario rail clipped at {viewport.width}x{viewport.height}: {geometry}"
        )
        assert max(geometry["buttonBottoms"]) <= geometry["frameBottom"] + tolerance, (
            f"Scenario button clipped at {viewport.width}x{viewport.height}: {geometry}"
        )
        assert geometry["frameScrollHeight"] <= geometry["frameClientHeight"] + tolerance, (
            f"Workbench has masked vertical overflow at {viewport.width}x{viewport.height}: {geometry}"
        )
        assert geometry["documentScrollWidth"] <= geometry["viewportWidth"] + tolerance, (
            f"Horizontal overflow at {viewport.width}x{viewport.height}: {geometry}"
        )

    print(f"PASS {viewport.width}x{viewport.height}")


def main() -> int:
    base_url = sys.argv[1] if len(sys.argv) > 1 else os.environ.get(
        "BASE_URL", "https://russelldudek.github.io/ByteCubit"
    )

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        try:
            page = browser.new_page()
            for viewport in VIEWPORTS:
                verify_viewport(page, viewport, base_url)
        finally:
            browser.close()

    print("Hero geometry verification passed at all audited viewports.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
