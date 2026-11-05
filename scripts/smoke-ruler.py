#!/usr/bin/env python3
"""Verify the transient plan ruler in an isolated Chromium profile.

Run against a local editor: python3 scripts/smoke-ruler.py --url http://127.0.0.1:4173/
Requires Python Playwright and Chromium.
"""
import argparse
import asyncio
import json

from playwright.async_api import async_playwright, expect


async def run(url, executable):
    errors = []
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(
            executable_path=executable,
            headless=True,
            args=['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'],
        )
        context = await browser.new_context(viewport={'width': 1280, 'height': 649})
        page = await context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        await page.goto(url, wait_until='networkidle')

        toolbar = page.get_by_role('toolbar', name='Project commands')
        await expect(toolbar).to_be_visible()
        await toolbar.get_by_role('button', name='Save project', exact=True).click()
        baseline = await page.evaluate("localStorage.getItem('roomlab.project.v2')")
        assert baseline, 'explicit local save should create the baseline fixture'
        baseline_project = json.loads(baseline)

        tools = toolbar.get_by_role('button', name='Tools', exact=True)
        await tools.click()
        ruler_item = page.get_by_role('menuitem', name='Ruler', exact=True)
        await expect(ruler_item).to_be_enabled()
        await ruler_item.click()
        canvas = page.get_by_role('img', name='2D floor plan. Click two points to measure; Escape clears the measurement.')
        await expect(canvas).to_be_visible()
        await expect(page.locator('.canvas-hint')).to_contain_text('Click two points to measure')

        wall = page.locator('.plan-wall[data-wall-id="wall-north"]')
        endpoints = await wall.evaluate('''element => {
          const matrix = element.getScreenCTM();
          const point = (x, y) => new DOMPoint(Number(x), Number(y)).matrixTransform(matrix);
          const a = point(element.getAttribute('x1'), element.getAttribute('y1'));
          const b = point(element.getAttribute('x2'), element.getAttribute('y2'));
          return [{x:a.x, y:a.y}, {x:b.x, y:b.y}];
        }''')
        await page.mouse.click(endpoints[0]['x'], endpoints[0]['y'])
        await expect(page.locator('.plan-measurement')).to_be_visible()
        await page.mouse.move(endpoints[1]['x'], endpoints[1]['y'])
        await expect(page.locator('[data-measurement-label="true"]')).to_have_text('2.00 m')
        await page.mouse.click(endpoints[1]['x'], endpoints[1]['y'])
        await expect(page.locator('[data-measurement-label="true"]')).to_have_text('2.00 m')
        await expect(page.locator('.plan-wall.is-selected')).to_have_count(0)
        await expect(toolbar.get_by_role('button', name='Undo', exact=True)).to_be_disabled()

        await page.keyboard.press('Escape')
        await expect(page.locator('.plan-measurement')).to_have_count(0)
        saved_after = await page.evaluate("localStorage.getItem('roomlab.project.v2')")
        assert saved_after == baseline, 'transient measurement must not mutate persisted project data'
        assert json.loads(saved_after) == baseline_project
        assert not errors, errors
        print(json.dumps({
            'result': 'PASS',
            'checks': [
                'Tools > Ruler is enabled and enters accessible measurement mode',
                'wall-endpoint clicks snap and display the expected 2.00 m distance',
                'measurement clicks do not select a wall or create Undo history',
                'Escape clears the ruler overlay without changing saved project data',
                'zero page errors',
            ],
        }, indent=2))
        await browser.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', default='http://127.0.0.1:4173/')
    parser.add_argument('--executable', default='/usr/bin/chromium')
    args = parser.parse_args()
    asyncio.run(run(args.url, args.executable))
