import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
const origin=new URL(process.argv[2] || 'http://localhost:8795').origin;
const root=new URL('../../',import.meta.url).pathname;
const explorer=JSON.parse(await readFile(`${root}data/launch/explorer-release-2026-08-13.json`,'utf8'));
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader'],...(process.env.BCA_BROWSER_EXECUTABLE?{executablePath:process.env.BCA_BROWSER_EXECUTABLE}:{})});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],responses=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error') errors.push(message.text());});
  page.on('response',response=>responses.push({url:response.url(),status:response.status()}));
  page.setDefaultTimeout(15000);
  const vectorResponse=page.waitForResponse(response=>response.url().includes('context.pmtiles') && response.status()===206);
  await page.goto(origin);
  await page.getByRole('button',{name:'Zoom in',exact:true}).waitFor();
  await vectorResponse;
  await page.getByRole('button',{name:'Zoom in',exact:true}).click();
  await page.getByRole('radio',{name:'Vegetation greenness index change (NDVI)',exact:true}).check();
  await page.waitForURL(/layers=[^&]*ndvi/);
  await page.getByRole('checkbox',{name:'Terrain and 10 m contours',exact:true}).check();
  await page.waitForURL(/layers=[^&]*terrain/);
  // A separate synthetic page mounts the actual production MapCanvas component.
  // This fixture never enters the published evidence or deployable site output.
  const fixture=(await build({stdin:{contents:`
import React from 'react';
import {createRoot} from 'react-dom/client';
import {MapCanvas} from './apps/web/app/MapCanvas';
import {DEFAULT_EXPLORER_STATE} from '@bca/domain';
import {INITIAL_ACTIVE_FIRE_STATE} from './apps/web/app/activeFire';
const explorer=${JSON.stringify(explorer)};
explorer.map.zoom=14; // Keep the fixture centre inside maxBounds at this viewport.
const map={type:'FeatureCollection',features:[{type:'Feature',id:'synthetic-observation',geometry:{type:'Point',coordinates:explorer.map.center},properties:{sensor:'Synthetic test sensor',observed_at:'2026-09-09T00:00:00Z',confidence:'nominal',frp_mw:1}}]};
createRoot(document.getElementById('root')).render(<MapCanvas explorer={explorer} language="en" state={{...DEFAULT_EXPLORER_STATE,visibleLayerIds:['thermal'],primaryDate:explorer.dates.at(-1).id}} activeFire={{...INITIAL_ACTIVE_FIRE_STATE,map,counts:{map24h:1,history30d:1}}} activeFireMapOverride={null}/>);
`,resolveDir:root,loader:'tsx'},bundle:true,write:false,format:'esm',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_ASSET_ORIGIN':'""'}})).outputFiles[0].text;
  const css=await readFile(`${root}node_modules/maplibre-gl/dist/maplibre-gl.css`,'utf8');
  await page.route(`${origin}/__map-browser-fixture`,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic map regression</title><link rel="stylesheet" href="/__map-browser-fixture.css"><div id="root"></div><script type="module" src="/__map-browser-fixture.mjs"></script>'}));
  await page.route(`${origin}/__map-browser-fixture.css`,route=>route.fulfill({contentType:'text/css',body:css+'body{margin:0}.map-figure{margin:0}.map-canvas{width:100vw;height:800px}'}));
  await page.route(`${origin}/__map-browser-fixture.mjs`,route=>route.fulfill({contentType:'text/javascript',body:fixture}));
  await page.goto(`${origin}/__map-browser-fixture`);
  await page.getByRole('button',{name:'Zoom in',exact:true}).waitFor();
  // Clicking the centre succeeds only when the resolver supplied the symbol image
  // and its rendered feature can be queried by the production click handler.
  await page.waitForFunction(()=>document.querySelector('.maplibregl-canvas')?.width>0);
  await page.locator('.maplibregl-canvas').click({position:{x:720,y:400}});
  try {await page.getByText(/Synthetic test sensor/).waitFor({timeout:3000});}
  catch {await page.locator('.maplibregl-canvas').click({position:{x:720,y:400}});try {await page.getByText(/Synthetic test sensor/).waitFor();} catch(error) {await page.screenshot({path:'/tmp/bca-map-browser-failure.png'});console.error(errors);throw error;}}
  assert.match(await page.locator('.thermal-popup').textContent(),/not an exact fire location/);
  assert.ok(responses.some(response=>response.url.includes('/maplibre/') && response.url.endsWith('/maplibre-gl-worker.mjs') && response.status===200));
  assert.ok(responses.some(response=>response.url.includes('/maplibre/') && response.url.endsWith('/maplibre-gl-shared.mjs') && response.status===200));
  assert.deepEqual(errors,[]);
  await page.screenshot({path:'/tmp/bca-map-browser-regression.png'});
  console.log('Map browser checks passed: ESM worker/sibling, PMTiles ranges, zoom/layers, thermal symbol and popup.');
} finally {await browser.close();}
