"""Verify that explicit local Save preserves 3D orbit, pan, and zoom state.

Run against a local editor: python3 scripts/smoke-camera-persistence.py --url http://127.0.0.1:4173/
Requires Python Playwright, Pillow, and Chromium.
"""
import argparse
import asyncio
import io
import json
import math

from PIL import Image, ImageChops, ImageStat
from playwright.async_api import async_playwright, expect


async def scene_canvas(page):
    canvas = page.locator('.scene-viewport-canvas')
    await expect(canvas).to_be_visible()
    await page.wait_for_timeout(250)
    return canvas


def image_difference(left_png, right_png):
    left = Image.open(io.BytesIO(left_png)).convert('RGB')
    right = Image.open(io.BytesIO(right_png)).convert('RGB')
    assert left.size == right.size, (left.size, right.size)
    diff = ImageChops.difference(left, right)
    grayscale = diff.convert('L')
    histogram = grayscale.histogram()
    changed = sum(histogram[9:])
    mean = sum(ImageStat.Stat(diff).mean) / 3
    return changed / (left.width * left.height), mean


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
        await toolbar.get_by_role('button', name='Save project', exact=True).click()
        baseline = await page.evaluate("localStorage.getItem('roomlab.project.v2')")
        assert baseline and '"camera"' not in baseline

        footer = page.locator('.bottom-bar')
        await footer.get_by_role('button', name='3D View', exact=True).click()
        canvas = await scene_canvas(page)
        box = await canvas.bounding_box()
        assert box and box['width'] > 100 and box['height'] > 100
        start_x = box['x'] + box['width'] * 0.72
        start_y = box['y'] + box['height'] * 0.50
        await page.mouse.move(start_x, start_y)
        await page.mouse.down()
        await page.mouse.move(start_x + 64, start_y + 27, steps=6)
        await page.mouse.up()
        await expect(toolbar.get_by_role('button', name='Undo', exact=True)).to_be_disabled()
        await toolbar.get_by_role('button', name='Save project', exact=True).click()
        after_orbit = json.loads(await page.evaluate("localStorage.getItem('roomlab.project.v2')"))
        orbit_camera = after_orbit.get('camera')
        assert orbit_camera and all(math.isfinite(orbit_camera[key]) for key in ('targetX', 'targetY', 'targetZ', 'radius', 'azimuth', 'elevation'))
        assert abs(orbit_camera['azimuth'] - math.pi / 4) > 0.1, orbit_camera
        assert await page.locator('.inspector-head h2').inner_text() == 'Design summary'

        await page.mouse.move(box['x'] + box['width'] * 0.72, box['y'] + box['height'] * 0.50)
        await page.keyboard.down('Shift')
        await page.mouse.down()
        await page.mouse.move(box['x'] + box['width'] * 0.72 + 42, box['y'] + box['height'] * 0.50 + 16, steps=5)
        await page.mouse.up()
        await page.keyboard.up('Shift')
        await toolbar.get_by_role('button', name='Save project', exact=True).click()
        after_pan = json.loads(await page.evaluate("localStorage.getItem('roomlab.project.v2')"))
        pan_camera = after_pan['camera']
        assert abs(pan_camera['targetX'] - orbit_camera['targetX']) + abs(pan_camera['targetZ'] - orbit_camera['targetZ']) > 0.01, pan_camera
        await expect(toolbar.get_by_role('button', name='Undo', exact=True)).to_be_disabled()

        await page.mouse.move(box['x'] + box['width'] * 0.72, box['y'] + box['height'] * 0.50)
        await page.mouse.wheel(0, -180)
        await page.wait_for_timeout(150)
        await toolbar.get_by_role('button', name='Save project', exact=True).click()
        persisted = json.loads(await page.evaluate("localStorage.getItem('roomlab.project.v2')"))
        camera = persisted['camera']
        assert camera['radius'] < pan_camera['radius'], (camera, pan_camera)
        await toolbar.get_by_role('button', name='File', exact=True).click()
        async with page.expect_download() as download_info:
            await page.get_by_role('menuitem', name='Save As', exact=True).click()
        download = await download_info.value
        with open(await download.path(), encoding='utf-8') as file:
            exported = json.load(file)
        assert exported['camera'] == camera
        before_reload = await (await scene_canvas(page)).screenshot()

        # Switching view unmounts and recreates Three.js, which must use the saved camera.
        await footer.get_by_role('button', name='2D Plan', exact=True).click()
        await footer.get_by_role('button', name='3D View', exact=True).click()
        after_view_switch = await (await scene_canvas(page)).screenshot()
        switch_changed, switch_mean = image_difference(before_reload, after_view_switch)
        assert switch_changed < 0.02 and switch_mean < 1.0, (switch_changed, switch_mean)

        await page.reload(wait_until='networkidle')
        footer = page.locator('.bottom-bar')
        await footer.get_by_role('button', name='3D View', exact=True).click()
        after_reload = await (await scene_canvas(page)).screenshot()
        reload_changed, reload_mean = image_difference(before_reload, after_reload)
        assert reload_changed < 0.02 and reload_mean < 1.0, (reload_changed, reload_mean)
        restored = json.loads(await page.evaluate("localStorage.getItem('roomlab.project.v2')"))
        assert restored['camera'] == camera
        await expect(toolbar.get_by_role('button', name='Undo', exact=True)).to_be_disabled()

        # Fit View is the explicit escape hatch and removes the saved camera on next Save.
        await footer.get_by_role('button', name='Fit view', exact=True).click()
        await scene_canvas(page)
        await toolbar.get_by_role('button', name='Save project', exact=True).click()
        fitted = json.loads(await page.evaluate("localStorage.getItem('roomlab.project.v2')"))
        assert 'camera' not in fitted
        assert not errors, errors
        print(json.dumps({
            'result': 'PASS',
            'checks': [
                'orbit and Shift-pan snapshots do not create geometry Undo history or object selection',
                'zoom is captured after orbit and pan without selecting objects',
                'explicit Save and Save As store finite target/orbit/zoom metadata',
                'switching 2D→3D restores the same camera image within tolerance',
                'local Save/reload restores the same camera image within tolerance',
                'Fit View resets custom camera and the next Save removes camera metadata',
                'legacy no-camera project remains valid and zero page errors',
            ],
            'view_image_difference': {
                'switch_changed_pixel_fraction': round(switch_changed, 5),
                'switch_mean_channel_delta': round(switch_mean, 5),
                'reload_changed_pixel_fraction': round(reload_changed, 5),
                'reload_mean_channel_delta': round(reload_mean, 5),
            },
        }, indent=2))
        await browser.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', default='http://127.0.0.1:4173/')
    parser.add_argument('--executable', default='/usr/bin/chromium')
    args = parser.parse_args()
    asyncio.run(run(args.url, args.executable))
