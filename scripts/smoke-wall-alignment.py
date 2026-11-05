#!/usr/bin/env python3
"""Run against a local editor: python3 scripts/smoke-wall-alignment.py --url http://127.0.0.1:4173/
Requires Python Playwright and Chromium; uses an isolated, disposable browser context.
"""
import argparse
import asyncio
import copy
import math
from playwright.async_api import async_playwright, expect


async def run(url, executable):
    errors, checks = [], []
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(
            executable_path=executable,
            headless=True,
            args=['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'],
        )
        context = await browser.new_context(viewport=dict(width=1280, height=720))
        page = await context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        await page.goto(url, wait_until='networkidle')
        toolbar = page.get_by_role('toolbar', name='Project commands')
        await expect(toolbar).to_be_visible()

        async def saved_project():
            await toolbar.get_by_role('button', name='Save project', exact=True).click()
            return await page.evaluate('''() => Object.values(localStorage).map(value => {
              try { return JSON.parse(value); } catch { return null; }
            }).find(value => value && Array.isArray(value.rooms) && Array.isArray(value.walls))''')

        initial = await saved_project()
        fixture = copy.deepcopy(initial)
        fixture['walls'].append(dict(
            id='alignment-smoke-wall', start=dict(x=-1, y=8), end=dict(x=2, y=10),
            thickness=0.12, height=2.4, materialId=fixture['walls'][0]['materialId'],
            levelId=fixture['activeLevelId'],
        ))
        original_wall = copy.deepcopy(fixture['walls'][-1])
        page_errors_before_reload = len(errors)
        await page.evaluate('(fixture) => localStorage.setItem("roomlab.project.v2", JSON.stringify(fixture))', fixture)
        await page.reload(wait_until='networkidle')
        await expect(page.locator('[data-wall-id="alignment-smoke-wall"]').first).to_be_visible()

        async def select_wall():
            wall = page.locator('[data-wall-id="alignment-smoke-wall"]').first
            point = await wall.evaluate('''element => {
              const x = (Number(element.getAttribute('x1')) + Number(element.getAttribute('x2'))) / 2;
              const y = (Number(element.getAttribute('y1')) + Number(element.getAttribute('y2'))) / 2;
              const screen = new DOMPoint(x, y).matrixTransform(element.getScreenCTM());
              return {x: screen.x, y: screen.y};
            }''')
            await page.mouse.click(point['x'], point['y'])
            await expect(page.get_by_role('group', name='Align selected wall')).to_be_visible()

        def wall_from(state):
            return next(item for item in state['walls'] if item['id'] == 'alignment-smoke-wall')

        def assert_geometry(wall, horizontal=None, vertical=None):
            dx = wall['end']['x'] - wall['start']['x']
            dy = wall['end']['y'] - wall['start']['y']
            if horizontal:
                assert abs(dy) < 1e-8, wall
            if vertical:
                assert abs(dx) < 1e-8, wall
            return math.hypot(dx, dy), ((wall['start']['x'] + wall['end']['x']) / 2,
                                        (wall['start']['y'] + wall['end']['y']) / 2)

        original_length, original_midpoint = assert_geometry(original_wall)
        await select_wall()
        await page.get_by_role('button', name='Align wall horizontally', exact=True).click()
        horizontal_state = await saved_project()
        horizontal_wall = wall_from(horizontal_state)
        length, midpoint = assert_geometry(horizontal_wall, horizontal=True)
        assert math.isclose(length, original_length, rel_tol=0, abs_tol=1e-8), (length, original_length)
        assert all(math.isclose(a, b, rel_tol=0, abs_tol=1e-8) for a, b in zip(midpoint, original_midpoint)), (midpoint, original_midpoint)

        await toolbar.get_by_role('button', name='Undo', exact=True).click()
        undone_wall = wall_from(await saved_project())
        assert undone_wall['start'] == original_wall['start'] and undone_wall['end'] == original_wall['end'], undone_wall
        await toolbar.get_by_role('button', name='Redo', exact=True).click()
        redone_wall = wall_from(await saved_project())
        assert_geometry(redone_wall, horizontal=True)

        await select_wall()
        await page.get_by_role('button', name='Align wall vertically', exact=True).click()
        vertical_state = await saved_project()
        vertical_wall = wall_from(vertical_state)
        length, midpoint = assert_geometry(vertical_wall, vertical=True)
        assert math.isclose(length, original_length, rel_tol=0, abs_tol=1e-8), (length, original_length)
        assert all(math.isclose(a, b, rel_tol=0, abs_tol=1e-8) for a, b in zip(midpoint, original_midpoint)), (midpoint, original_midpoint)

        await toolbar.get_by_role('button', name='Undo', exact=True).click()
        assert_geometry(wall_from(await saved_project()), horizontal=True)
        await toolbar.get_by_role('button', name='Redo', exact=True).click()
        assert_geometry(wall_from(await saved_project()), vertical=True)
        await page.reload(wait_until='networkidle')
        persisted_wall = wall_from(await page.evaluate('''() => Object.values(localStorage).map(value => {
          try { return JSON.parse(value); } catch { return null; }
        }).find(value => value && Array.isArray(value.walls))'''))
        assert_geometry(persisted_wall, vertical=True)
        await expect(page.get_by_role('img', name='2D floor plan')).to_be_visible()
        assert await page.locator('[data-wall-id="alignment-smoke-wall"]').count() == 2
        await toolbar.get_by_role('button', name='View', exact=True).click()
        await page.get_by_role('menuitemcheckbox', name='3D View', exact=True).click()
        canvas = page.locator('.scene-viewport canvas')
        await expect(canvas).to_be_visible()
        box = await canvas.bounding_box()
        assert box and box['width'] > 0 and box['height'] > 0, box

        checks.extend([
            'horizontal and vertical alignment preserve wall midpoint and length',
            'alignment is one undoable/redoable edit and survives local Save/reload',
            'reloaded aligned geometry mounts in the 3D scene',
        ])
        assert len(errors) == page_errors_before_reload, errors
        assert not errors, errors
        print({'checks': checks, 'pageErrors': errors})
        await context.close()
        await browser.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:4173/')
    parser.add_argument('--executable', default=None)
    arguments = parser.parse_args()
    asyncio.run(run(arguments.url, arguments.executable))


if __name__ == '__main__':
    main()
