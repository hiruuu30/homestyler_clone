#!/usr/bin/env python3
"""Run against a local editor: python3 scripts/smoke-furniture-placement.py --url http://127.0.0.1:4173/"""
import argparse
import asyncio
import json
import shutil

from playwright.async_api import async_playwright, expect


async def read_saved_project(page):
    await page.get_by_role('button', name='Save project').click()
    return await page.evaluate('''() => Object.values(localStorage).map(value => {try {return JSON.parse(value)} catch {return null}})
      .find(value => value && Array.isArray(value.rooms) && Array.isArray(value.furniture))''')


async def screen_center_and_world_x(page, locator):
    return await locator.evaluate('''element => {
      const center = new DOMPoint(0, 0).matrixTransform(element.getScreenCTM());
      const matrix = element.ownerSVGElement.getScreenCTM();
      return {x:center.x,y:center.y,ux:matrix.a,uy:matrix.b};
    }''')


SCENE_COORDINATES = '''({targetPosition}) => {
  const project = Object.values(localStorage).map(value => {try {return JSON.parse(value)} catch {return null}})
    .find(value => value && Array.isArray(value.rooms) && Array.isArray(value.furniture));
  const canvas = document.querySelector('.scene-viewport canvas');
  const rect = canvas.getBoundingClientRect();
  const points = [...project.rooms.flatMap(room => room.points), ...project.walls.flatMap(wall => [wall.start, wall.end])];
  project.furniture.filter(item => !item.hidden).forEach(item => {
    const angle = item.rotation * Math.PI / 180;
    const ex = Math.abs(Math.cos(angle)) * item.width / 2 + Math.abs(Math.sin(angle)) * item.depth / 2;
    const ey = Math.abs(Math.sin(angle)) * item.width / 2 + Math.abs(Math.cos(angle)) * item.depth / 2;
    points.push({x:item.position.x-ex,y:item.position.y-ey},{x:item.position.x+ex,y:item.position.y+ey});
  });
  const padding = Math.max(0, ...project.walls.map(wall => wall.thickness / 2));
  const xs = points.map(point => point.x), ys = points.map(point => point.y);
  const minX = Math.min(...xs)-padding, maxX = Math.max(...xs)+padding;
  const minY = Math.min(...ys)-padding, maxY = Math.max(...ys)+padding;
  const width = Math.max(1,maxX-minX), depth = Math.max(1,maxY-minY);
  const level = project.levels.find(item => item.id === project.activeLevelId);
  const floorY = level?.elevation ?? 0;
  const maxHeight = Math.max(2.4,...project.walls.map(wall => wall.height),...project.furniture.filter(item=>!item.hidden).map(item=>item.height));
  const target = {x:(minX+maxX)/2,y:floorY+maxHeight*.42,z:-(minY+maxY)/2};
  const halfDiagonal = Math.hypot(width/2,depth/2,maxHeight/2);
  const fov = 42*Math.PI/180, aspect = rect.width/rect.height;
  const halfV = fov/2, halfH = Math.atan(Math.tan(halfV)*aspect);
  const radius = Math.max(5,halfDiagonal/Math.sin(Math.min(halfV,halfH))*1.1);
  const azimuth = Math.PI/4, elevation = .82;
  const camera = {x:target.x+radius*Math.cos(elevation)*Math.sin(azimuth),y:target.y+radius*Math.sin(elevation),z:target.z+radius*Math.cos(elevation)*Math.cos(azimuth)};
  const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
  const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
  const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
  const norm=a=>{const d=Math.hypot(a.x,a.y,a.z);return{x:a.x/d,y:a.y/d,z:a.z/d}};
  const forward=norm(sub(target,camera)), right=norm(cross(forward,{x:0,y:1,z:0})), up=cross(right,forward);
  const projectPoint=point=>{
    const relative=sub(point,camera), d=dot(relative,forward);
    const nx=dot(relative,right)/(d*Math.tan(fov/2)*aspect), ny=dot(relative,up)/(d*Math.tan(fov/2));
    return{x:rect.left+(nx+1)*rect.width/2,y:rect.top+(1-ny)*rect.height/2};
  };
  const item=project.furniture.find(item=>!item.hidden&&item.levelId===project.activeLevelId);
  const top={x:item.position.x,y:floorY+item.elevation+item.height,z:-item.position.y};
  const ray=norm(sub(top,camera)), t=(floorY-camera.y)/ray.y;
  const ground={x:camera.x+ray.x*t,z:camera.z+ray.z*t};
  const offsetX=item.position.x-ground.x, offsetY=item.position.y+ground.z;
  const floorTarget={x:targetPosition.x-offsetX,y:floorY,z:-(targetPosition.y-offsetY)};
  return {start:projectPoint(top),end:projectPoint(floorTarget)};
}'''


async def run(url, executable):
    errors, checks = [], []
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(executable_path=executable, headless=True, args=['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'])
        context = await browser.new_context(viewport=dict(width=1280, height=720))
        page = await context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        await page.goto(url, wait_until='networkidle')
        await page.get_by_title('Add sofa', exact=True).click()
        width = page.get_by_label('Width', exact=True)
        await width.fill('1.6')
        project = await read_saved_project(page)
        sofa = page.locator('.plan-furniture').first
        origin = await screen_center_and_world_x(page, sofa)

        await page.mouse.move(origin['x'], origin['y'])
        await page.mouse.down()
        await page.mouse.move(origin['x'] + origin['ux'] * 1.4, origin['y'] + origin['uy'] * 1.4, steps=6)
        await expect(sofa).to_have_attribute('data-placement-valid', 'false')
        await page.mouse.up()
        await expect(page.locator('.toast')).to_contain_text('fully inside its assigned room')
        rejected = await read_saved_project(page)
        assert rejected['furniture'][0]['position'] == project['furniture'][0]['position'], rejected['furniture'][0]

        origin = await screen_center_and_world_x(page, sofa)
        await page.mouse.move(origin['x'], origin['y'])
        await page.mouse.down()
        await page.mouse.move(origin['x'] + origin['ux'] * 0.1, origin['y'] + origin['uy'] * 0.1, steps=4)
        await page.mouse.up()
        moved = await read_saved_project(page)
        assert abs(moved['furniture'][0]['position']['x'] - 5.3) < 1e-6, moved['furniture'][0]
        await page.get_by_role('button', name='Undo').click()
        undone = await read_saved_project(page)
        assert abs(undone['furniture'][0]['position']['x'] - 5.2) < 1e-6
        await page.get_by_role('button', name='Redo').click()
        redone = await read_saved_project(page)
        assert abs(redone['furniture'][0]['position']['x'] - 5.3) < 1e-6
        checks.append('2D: snap to 10 cm grid; invalid preview and rejected room escape; valid drop, Undo/Redo, save')

        await page.locator('.bottom-bar .view-tab').filter(has_text='3D View').click()
        canvas = page.locator('.scene-viewport canvas')
        await expect(canvas).to_be_visible(timeout=30000)
        await page.wait_for_function('document.querySelector(".scene-viewport canvas").width > 0')

        async def scene_drag(target):
            coords = await page.evaluate(SCENE_COORDINATES, {'targetPosition': target})
            await page.mouse.move(coords['start']['x'], coords['start']['y'])
            await page.mouse.down()
            await page.mouse.move(coords['end']['x'], coords['end']['y'], steps=8)
            await page.mouse.up()

        await scene_drag({'x': 6.7, 'y': 0.8})
        await expect(page.locator('.toast')).to_contain_text('fully inside its assigned room')
        three_d_rejected = await read_saved_project(page)
        assert abs(three_d_rejected['furniture'][0]['position']['x'] - 5.3) < 1e-6, three_d_rejected['furniture'][0]
        await scene_drag({'x': 5.2, 'y': 0.8})
        three_d_moved = await read_saved_project(page)
        assert abs(three_d_moved['furniture'][0]['position']['x'] - 5.2) < 1e-6, three_d_moved['furniture'][0]
        checks.append('3D: shared room validator and snapping; invalid drop rolls back; valid floor-plane move persists')

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
