import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAnimatedContentStates,
  buildScrollTriggerBounds,
  WIPES,
} from './animated-content-utils.ts';
import { getRouteSeoMetadata, ROUTE_SEO_CONFIG, CANONICAL_ORIGIN } from './seo.ts';

test('buildAnimatedContentStates computes vertical and horizontal offsets, blur, and wipe states', () => {
  const verticalState = buildAnimatedContentStates({
    distance: 100,
    direction: 'vertical',
    reverse: false,
    initialOpacity: 0,
    animateOpacity: true,
    scale: 0.96,
    blur: 8,
    rotate: 0,
    tilt: 0,
    wipe: 'up',
  });

  assert.equal(verticalState.axis, 'y');
  assert.equal(verticalState.from.y, 100);
  assert.equal(verticalState.to.y, 0);
  assert.equal(verticalState.from.opacity, 0);
  assert.equal(verticalState.to.opacity, 1);
  assert.equal(verticalState.from.filter, 'blur(8px)');
  assert.equal(verticalState.to.filter, 'blur(0px)');
  assert.equal(verticalState.from['--ac-wipe'], 0);
  assert.equal(verticalState.to['--ac-wipe'], 1);

  const horizontalReverseState = buildAnimatedContentStates({
    distance: 60,
    direction: 'horizontal',
    reverse: true,
    initialOpacity: 0.2,
    animateOpacity: false,
    scale: 1,
    blur: 0,
    rotate: 5,
    tilt: 12,
    wipe: 'none',
  });

  assert.equal(horizontalReverseState.axis, 'x');
  assert.equal(horizontalReverseState.from.x, -60);
  assert.equal(horizontalReverseState.to.x, 0);
  assert.equal(horizontalReverseState.from.opacity, 1);
  assert.equal(horizontalReverseState.from.rotation, -5);
  assert.equal(horizontalReverseState.from.rotationY, 12);
});

test('buildScrollTriggerBounds clamps threshold and computes start and end bounds accurately', () => {
  const boundsDefault = buildScrollTriggerBounds(0.1);
  assert.equal(boundsDefault.start, 'top 90%');
  assert.equal(boundsDefault.end, 'top 45%');

  const boundsCustom = buildScrollTriggerBounds(0.25);
  assert.equal(boundsCustom.start, 'top 75%');
  assert.equal(boundsCustom.end, 'top 30%');
});

test('WIPES provides valid CSS gradient masks for all directional wipe presets', () => {
  assert.ok(WIPES.up.includes('linear-gradient(to top'));
  assert.ok(WIPES.down.includes('linear-gradient(to bottom'));
  assert.ok(WIPES.left.includes('linear-gradient(to left'));
  assert.ok(WIPES.right.includes('linear-gradient(to right'));
  assert.ok(WIPES.center.includes('radial-gradient'));
});

test('SEO metadata configuration adheres to length and canonical URL guidelines across routes', () => {
  for (const route of ['home', 'privacy', 'terms'] as const) {
    const meta = getRouteSeoMetadata(route, 'http://localhost:3000');
    assert.ok(
      meta.title.length >= 30 && meta.title.length <= 65,
      `${route} title length out of bounds: ${meta.title.length}`
    );
    assert.ok(
      meta.description.length >= 120 && meta.description.length <= 165,
      `${route} description length out of bounds: ${meta.description.length}`
    );
    assert.ok(meta.canonicalUrl.startsWith(CANONICAL_ORIGIN));
  }

  const customOriginMeta = getRouteSeoMetadata('privacy', 'https://custom.auramusic.app/');
  assert.equal(customOriginMeta.canonicalUrl, 'https://custom.auramusic.app/privacy');
  assert.equal(ROUTE_SEO_CONFIG.home.ogType, 'website');
  assert.equal(ROUTE_SEO_CONFIG.privacy.ogType, 'article');
});
