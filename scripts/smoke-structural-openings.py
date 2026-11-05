#!/usr/bin/env python3
"""Run against a local editor: python3 scripts/smoke-structural-openings.py --url http://127.0.0.1:4173/"""
import argparse
import asyncio
import copy
import json
import shutil

from playwright.async_api import async_playwright, expect

OPENING = [
    {'x': 2.75, 'y': 1.25}, {'x': 3.35, 'y': 1.25},
    {'x': 3.35, 'y': 1.85}, {'x': 2.75, 'y': 1.85},
]


async def saved_project(page):
    await page.get_by_role('button', name='Save project', exact=True).click()
    return await page.evaluate('''() => Object.values(localStorage).map(value => {try {return JSON.parse(value)} catch {return null}})
      .find(value => value && Array.isArray(value.rooms) && Array.isArray(value.levels))''')


async def run(url, executable):
    errors, checks = [], []
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(executable_path=executable, headless=True,
            args=['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'])
        page = await browser.new_page(viewport={'width': 1280, 'height': 800})
        page.on('pageerror', lambda error: errors.append(str(error)))
        await page.goto(url, wait_until='networkidle')
        project = await saved_project(page)
        source = next(room for room in project['rooms'] if room['id'] == 'room-living')
        ground_id = source['levelId']
        upper_id = 'floor-structural-smoke-upper'
        fixture = copy.deepcopy(project)
        fixture['name'] = 'Structural opening interaction smoke'
        fixture['levels'].append({'id': upper_id, 'name': 'Upper smoke floor', 'elevation': 3, 'height': 2.7})
        upper_room = copy.deepcopy(source)
        upper_room.update(id='room-structural-smoke-upper', name='Upper smoke room', levelId=upper_id)
        upper_room.pop('holes', None)
        fixture['rooms'].append(upper_room)
        fixture['activeLevelId'] = ground_id
        await page.evaluate('''value => {
          const key = Object.keys(localStorage).find(name => name.includes('project.v2')) || 'roomlab.project.v2';
          localStorage.setItem(key, JSON.stringify(value));
        }''', fixture)
        await page.reload(wait_until='networkidle')

        room_paths = page.locator('.plan-room')
        living_index = next(index for index, room in enumerate(fixture['rooms']) if room['id'] == 'room-living')
        await room_paths.nth(living_index).click()
        await expect(page.get_by_role('heading', name='Living Room', exact=True)).to_be_visible()
        selector = page.get_by_label('Through upper floor', exact=True)
        await expect(selector).to_have_value(upper_id)
        await page.get_by_role('button', name='Draw through-floor opening', exact=True).click()
        screen_points = await page.locator('svg.plan-canvas').evaluate('''(svg, vertices) => {
          const matrix = svg.getScreenCTM();
          return vertices.map(({x, y}) => {
            const point = new DOMPoint(x, y).matrixTransform(matrix);
            return {x: point.x, y: point.y};
          });
        }''', OPENING)
        for point in screen_points:
            await page.mouse.click(point['x'], point['y'])
        await page.keyboard.press('Enter')
        await expect(page.get_by_text('Through-floor opening created through Upper smoke floor', exact=False)).to_be_visible()
        opened = await saved_project(page)
        structural = opened.get('structuralOpenings', [])
        assert len(structural) == 1, structural
        assert structural[0]['levelIds'] == [ground_id, upper_id], structural[0]
        linked_rooms = [room for room in opened['rooms'] if room['id'] in structural[0]['roomIds']]
        assert len(linked_rooms) == 2 and all(room.get('holes') == [structural[0]['polygon']] for room in linked_rooms), linked_rooms
        checks.append('UI polygon gesture created aligned openings on source and upper floors')

        await page.get_by_role('button', name='Undo', exact=True).click()
        undone = await saved_project(page)
        assert undone.get('structuralOpenings') == []
        assert all(not room.get('holes') for room in undone['rooms'])
        await page.get_by_role('button', name='Redo', exact=True).click()
        redone = await saved_project(page)
        assert redone.get('structuralOpenings') == structural
        await page.reload(wait_until='networkidle')
        persisted = await saved_project(page)
        assert persisted.get('structuralOpenings') == structural
        checks.append('grouped Undo/Redo and browser save/reload preserved the linked opening')

        await page.get_by_role('button', name='Build', exact=True).click()
        await page.get_by_role('button', name=f'Delete Upper smoke floor · undoable', exact=True).click()
        removed_floor = await saved_project(page)
        assert all(level['id'] != upper_id for level in removed_floor['levels'])
        assert removed_floor.get('structuralOpenings') == []
        assert all(not room.get('holes') for room in removed_floor['rooms'])
        await page.get_by_role('button', name='Undo', exact=True).click()
        restored = await saved_project(page)
        assert any(level['id'] == upper_id for level in restored['levels'])
        assert restored.get('structuralOpenings') == structural
        checks.append('deleting a participating floor removes linked cutouts; Undo restores both floors and void')
        assert not errors, errors
        print(json.dumps({'passed': True, 'checks': checks, 'page_errors': errors}, indent=2))
        await browser.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:4173/')
    parser.add_argument('--executable', default=shutil.which('chromium') or shutil.which('google-chrome'))
    args = parser.parse_args()
    if not args.executable:
        parser.error('Chromium is required; pass --executable /path/to/browser')
    asyncio.run(run(args.url, args.executable))
