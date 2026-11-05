#!/usr/bin/env python3
"""Run against a local editor: python3 scripts/smoke-editor-commands.py --url http://127.0.0.1:4173/
Requires Python Playwright and Chromium; uses an isolated, disposable browser context.
"""
import argparse
import asyncio
import copy
import csv
import io
import json
import shutil
import xml.etree.ElementTree as ET
from pathlib import Path

from playwright.async_api import async_playwright, expect

IDENTITY = dict(pattern='none', colorOverlay=False, rotation=0, offsetX=0, offsetY=0, scaleX=1, scaleY=1)


async def run(url, executable):
    errors, checks = [], []
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(executable_path=executable, headless=True, args=['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'])
        context = await browser.new_context(viewport=dict(width=1280, height=649), accept_downloads=True)
        page = await context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        await page.goto(url, wait_until='networkidle')
        toolbar = page.get_by_role('toolbar', name='Project commands')
        await expect(toolbar).to_be_visible()

        async def command(name):
            return toolbar.get_by_role('button', name=name, exact=True)

        async def focus_is(locator):
            await expect(locator).to_be_focused()

        async def menu(trigger, item, role='menuitem'):
            await (await command(trigger)).click()
            await page.get_by_role(role, name=item, exact=True).click()

        async def save():
            await (await command('Save project')).click()
            return await page.evaluate('''() => Object.values(localStorage).map(value => {try {return JSON.parse(value)} catch {return null}}).find(value => value && Array.isArray(value.rooms) && Array.isArray(value.wallOpenings))''')

        box = await toolbar.bounding_box()
        for name, expected in dict(x=335.3125, y=0, width=609.375, height=45).items():
            assert abs(box[name] - expected) < 0.1, (name, box)
        labels = await toolbar.get_by_role('button').evaluate_all('(buttons) => buttons.map(button => button.getAttribute("aria-label"))')
        assert labels == ['File', 'Save project', 'Undo', 'Redo', 'Clear', 'Construction', 'Tools', 'View', 'AI Tools', 'Export', 'Images', 'Render'], labels
        await expect(await command('Save project')).to_be_enabled()
        await save()
        file_button = await command('File')
        await file_button.click()
        file_menu = page.get_by_role('menu', name='File menu')
        menu_box = await file_menu.bounding_box()
        for name, expected in dict(x=342.3125, y=49.578125, width=168, height=262).items():
            assert abs(menu_box[name] - expected) < 0.15, (name, menu_box)
        await page.keyboard.press('Escape')
        await focus_is(file_button)
        await page.keyboard.press('ArrowRight')
        await focus_is(await command('Save project'))
        await page.keyboard.press('ArrowRight')
        await focus_is(await command('Clear'))  # skips disabled Undo and Redo
        await page.keyboard.press('ArrowLeft')
        await focus_is(await command('Save project'))
        await page.keyboard.press('End')
        await focus_is(await command('Export'))  # skips disabled Images and Render
        await page.keyboard.press('Home')
        await page.keyboard.press('ArrowDown')
        await focus_is(page.get_by_role('menuitem', name='New', exact=True))
        await page.keyboard.press('End')
        await focus_is(page.get_by_role('menuitem', name='Edit', exact=True))
        await page.keyboard.press('Home')
        await focus_is(page.get_by_role('menuitem', name='New', exact=True))
        await page.keyboard.press('Escape')
        await (await command('Clear')).focus()
        await page.keyboard.press('ArrowDown')
        await focus_is(page.get_by_role('menuitem', name='Clear Interior Finish', exact=True))
        await page.keyboard.press('Escape')
        await (await command('View')).click()
        await expect(page.get_by_role('menuitemcheckbox', name='2D Plan', exact=True)).to_have_attribute('aria-checked', 'true')
        await page.get_by_role('button', name='Project settings', exact=True).click()
        await expect(page.get_by_role('menu')).to_have_count(0)
        checks.append('exact measured toolbar/File-menu bounds; disabled-aware keyboard navigation; checkbox and dismissal semantics')

        await page.get_by_title('Add sofa', exact=True).click()
        await page.get_by_label('Width', exact=True).fill('1.6')
        await page.keyboard.press('Control+s')
        await page.wait_for_function('''() => Object.values(localStorage).some(value => {try {return JSON.parse(value).furniture?.[0]?.width === 1.6} catch {return false}})''')
        await page.get_by_label('Width', exact=True).focus()
        async with page.expect_download() as keyboard_download:
            await page.keyboard.press('Control+Shift+s')
        assert json.loads(Path(await (await keyboard_download.value).path()).read_text())['furniture'][0]['width'] == 1.6
        sofa = page.locator('.plan-furniture').first
        origin = await sofa.evaluate('''element => {
          const center = new DOMPoint(0, 0).matrixTransform(element.getScreenCTM());
          const matrix = element.ownerSVGElement.getScreenCTM();
          return {x:center.x,y:center.y,ux:matrix.a,uy:matrix.b};
        }''')
        await page.mouse.move(origin['x'], origin['y'])
        await page.mouse.down()
        await page.mouse.move(origin['x'] + origin['ux'] * 1.4, origin['y'] + origin['uy'] * 1.4, steps=6)
        await expect(sofa).to_have_attribute('data-placement-valid', 'false')
        await page.mouse.up()
        await expect(page.locator('.toast')).to_contain_text('fully inside its assigned room')
        rejected = await save()
        assert abs(rejected['furniture'][0]['position']['x'] - 5.2) < 1e-6, rejected['furniture'][0]
        await page.mouse.move(origin['x'], origin['y'])
        await page.mouse.down()
        await page.mouse.move(origin['x'] + origin['ux'] * 0.1, origin['y'] + origin['uy'] * 0.1, steps=4)
        await page.mouse.up()
        moved = await save()
        assert abs(moved['furniture'][0]['position']['x'] - 5.3) < 1e-6, moved['furniture'][0]
        await (await command('Undo')).click()
        assert abs((await save())['furniture'][0]['position']['x'] - 5.2) < 1e-6
        await (await command('Redo')).click()
        assert abs((await save())['furniture'][0]['position']['x'] - 5.3) < 1e-6
        checks.append('furniture move snaps to the 10 cm grid; room-invalid drag previews turn red and reject without history; valid move supports Undo/Redo and save')
        checks.append('Ctrl S commits focused numeric edits before saving; Ctrl Shift S exports from focused fields')
        original = await save()
        ground = original['levels'][0]['id']
        upper = 'floor-command-smoke-upper'
        fixture = copy.deepcopy(original)
        fixture['name'] = 'Command smoke · isolated test'
        fixture['levels'].append(dict(fixture['levels'][0], id=upper, name='Upper smoke', elevation=3))
        fixture['activeLevelId'] = ground
        fixture['materials'].append(dict(id='material-command-smoke-blue', name='Generic test blue', category='wall', color='#4167b2'))
        fixture['wallOpenings'] = [dict(id='opening-command-smoke-door', wallId='wall-north', kind='door', center=1, width=0.9, height=2.05, sillHeight=0)]
        for room in fixture['rooms']:
            room.update(floorMaterialId='material-command-smoke-blue', ceilingMaterialId='material-command-smoke-blue', ceilingVisible=True,
                        floorFinish=dict(IDENTITY, pattern='wood', rotation=27, offsetX=0.3), ceilingFinish=dict(IDENTITY, pattern='tile', rotation=-18, scaleY=1.4))
        fixture['rooms'].append(dict(copy.deepcopy(fixture['rooms'][0]), id='room-command-smoke-upper', levelId=upper,
                                     floorFinish=dict(IDENTITY, pattern='tile', rotation=43), ceilingFinish=dict(IDENTITY, pattern='wood', offsetX=0.6)))
        for wall in fixture['walls']:
            wall['materialId'] = 'material-command-smoke-blue'
        template = copy.deepcopy(fixture['furniture'][0])
        fixture['furniture'] = [dict(copy.deepcopy(template), id=f'furniture-command-smoke-{index}', levelId=level, color=color)
                                for index, level, color in [(1, ground, '#a82d2d'), (2, ground, '#2769af'), (3, upper, '#327c48')]]
        await (await command('File')).click()
        async with page.expect_file_chooser() as chooser:
            await page.get_by_role('menuitem', name='Open...', exact=True).click()
        await (await chooser.value).set_files(dict(name='command-smoke.json', mimeType='application/json', buffer=json.dumps(fixture).encode()))
        await expect(page.locator('.project-title')).to_contain_text(fixture['name'])
        door = page.locator('[data-opening-id="opening-command-smoke-door"]')
        door_center = await door.evaluate('''element => {
          const point = new DOMPoint(0, 0).matrixTransform(element.getScreenCTM());
          return {x: point.x, y: point.y};
        }''')
        await page.mouse.click(door_center['x'], door_center['y'])
        right_grip = page.locator('[data-opening-id="opening-command-smoke-door"] [data-opening-resize-handle="right"]')
        await expect(right_grip).to_be_visible()
        drag = await right_grip.evaluate('''handle => {
          const box = {x: Number(handle.getAttribute('x')), y: Number(handle.getAttribute('y')),
                       width: Number(handle.getAttribute('width')), height: Number(handle.getAttribute('height'))};
          const matrix = handle.closest('[data-opening-id]').getScreenCTM();
          const point = new DOMPoint(box.x + box.width / 2, box.y + box.height / 2).matrixTransform(matrix);
          const axis = new DOMPoint(box.x + box.width / 2 + 1, box.y + box.height / 2).matrixTransform(matrix);
          return {x: point.x, y: point.y, ux: axis.x - point.x, uy: axis.y - point.y};
        }''')
        await page.mouse.move(drag['x'], drag['y'])
        await page.mouse.down()
        await page.mouse.move(drag['x'] + drag['ux'] * 0.2, drag['y'] + drag['uy'] * 0.2, steps=5)
        await page.mouse.up()
        resized_state = await save()
        resized_door = next(item for item in resized_state['wallOpenings'] if item['id'] == 'opening-command-smoke-door')
        assert resized_door['width'] > 1 and resized_door['center'] > 1, resized_door
        await right_grip.focus()
        await page.keyboard.press('ArrowRight')
        keyboard_state = await save()
        keyboard_door = next(item for item in keyboard_state['wallOpenings'] if item['id'] == 'opening-command-smoke-door')
        assert keyboard_door['width'] > resized_door['width'], keyboard_door
        checks.append('2D door endpoint drag and arrow-key resize preserve the opposite jamb and persist geometry')
        before = await save()
        assert len(before['levels']) == 2 and len(before['furniture']) == 3

        async def download(trigger, item):
            async with page.expect_download() as info:
                await menu(trigger, item)
            result = await info.value
            return result.suggested_filename, Path(await result.path()).read_text()

        name, data = await download('File', 'Save As')
        assert name.endswith('.json') and json.loads(data)['rooms'] == before['rooms']
        name, data = await download('Export', 'Floor Plan · SVG')
        assert name.endswith('.svg') and ET.fromstring(data).tag.endswith('svg')
        name, data = await download('Export', 'Bill of Materials · CSV')
        assert name.endswith('.csv') and len(list(csv.reader(io.StringIO(data)))) > 1
        checks.append('UI JSON import/Save As; SVG and CSV downloads')

        await menu('Clear', 'Clear Furniture')
        cleared = await save()
        assert [item['levelId'] for item in cleared['furniture']] == [upper]
        assert cleared['rooms'] == before['rooms'] and cleared['walls'] == before['walls']
        await (await command('Undo')).click()
        assert (await save())['furniture'] == before['furniture']
        await (await command('Redo')).click()
        assert len((await save())['furniture']) == 1
        await (await command('Undo')).click()
        await menu('Clear', 'Clear Interior Finish')
        cleared = await save()
        assert cleared['furniture'] == before['furniture']
        assert [room for room in cleared['rooms'] if room['levelId'] == upper] == [room for room in before['rooms'] if room['levelId'] == upper]
        for room in cleared['rooms']:
            if room['levelId'] == ground:
                assert room['floorFinish'] == IDENTITY and room['ceilingFinish'] == IDENTITY and 'ceilingMaterialId' not in room
        assert [room['points'] for room in cleared['rooms']] == [room['points'] for room in before['rooms']]
        assert cleared['wallOpenings'] == before['wallOpenings']
        await (await command('Undo')).click()
        assert (await save())['rooms'] == before['rooms']
        await menu('Clear', 'Clear Furniture+Interior Finish')
        combined = await save()
        assert [item['levelId'] for item in combined['furniture']] == [upper]
        await (await command('Undo')).click()
        restored = await save()
        assert restored['rooms'] == before['rooms'] and restored['furniture'] == before['furniture']
        await (await command('Redo')).click()
        combined = await save()
        await page.reload(wait_until='networkidle')
        reloaded = await save()
        assert reloaded['rooms'] == combined['rooms'] and reloaded['furniture'] == combined['furniture']
        checks.append('all three bulk clears scoped to active floor; geometry/other-floor finishes preserved; single-step Undo/Redo; save/reload')

        await menu('View', '3D View', 'menuitemcheckbox')
        await expect(page.locator('.scene-viewport canvas')).to_be_visible(timeout=30000)
        await page.wait_for_function('document.querySelector(".scene-viewport canvas").width > 0')
        await page.set_viewport_size(dict(width=390, height=844))
        await (await command('File')).click()
        mobile = await page.get_by_role('menu', name='File menu').bounding_box()
        assert mobile['x'] >= 0 and mobile['x'] + mobile['width'] <= 390
        await page.keyboard.press('Escape')
        await (await command('Export')).click()
        mobile_export = await page.get_by_role('menu', name='Export menu').bounding_box()
        assert mobile_export['x'] >= 0 and mobile_export['x'] + mobile_export['width'] <= 390
        assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        await page.keyboard.press('Escape')
        checks.append('3D renderer mounts; narrow-viewport portal menus stay visible without page overflow')
        assert not errors, errors
        print(json.dumps(dict(passed=True, checks=checks, toolbar=box, file_menu=menu_box, mobile_file_menu=mobile, mobile_export_menu=mobile_export, page_errors=errors), indent=2))
        await browser.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:4173/')
    parser.add_argument('--executable', default=shutil.which('chromium') or shutil.which('google-chrome'))
    args = parser.parse_args()
    if not args.executable:
        parser.error('Chromium is required; pass --executable /path/to/browser')
    asyncio.run(run(args.url, args.executable))
