import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, example, key } from './helpers.mjs';
import { createPost, saveDraft, draft, publish, publicArticle, publicIndex, withdraw, rows } from '../src/storage.mjs';

test('private draft, explicit publication, corrections, exact retries and conflict preservation', async t => {
  const { env, actor } = await setup(t);
  const post = await createPost(env, actor, { slug: 'hello-wales', consent: 'public-attribution-v1' }, key());
  const saveKey = key(), body = { version: 0, source: example() };
  const saved = await saveDraft(env, actor, post.id, body, saveKey);
  assert.deepEqual(await saveDraft(env, actor, post.id, body, saveKey), saved);
  assert.deepEqual(await publicIndex(env), []);
  await assert.rejects(publicArticle(env, post.slug), { status: 404 });
  assert.deepEqual((await draft(env, actor, post.id)).source, body.source);
  await assert.rejects(saveDraft(env, actor, post.id, { ...body, source: example('different') }, saveKey), { status: 409 });
  const publishBody = { version: saved.version, revision: saved.revision }, publishKey = key();
  const published = await publish(env, actor, post.id, publishBody, publishKey);
  assert.deepEqual(await publish(env, actor, post.id, publishBody, publishKey), published);
  const correction = await saveDraft(env, actor, post.id, { version: published.version, source: example('Private correction') }, key());
  assert.equal((await publicArticle(env, post.slug)).title, 'Public title');
  assert.equal((await publicIndex(env))[0].title, 'Public title');
  assert.doesNotMatch(JSON.stringify(await publicArticle(env, post.slug)), /facebook:test|Private correction|draft_revision|source_key/);
  await assert.rejects(saveDraft(env, actor, post.id, { version: published.version, source: example('stale') }, key()), { status: 409 });
  await publish(env, actor, post.id, { version: correction.version, revision: correction.revision }, key());
  assert.equal((await publicArticle(env, post.slug)).title, 'Private correction');
});

test('concurrent saves have one winner and withdrawal fences staged publish', async t => {
  const { env, actor } = await setup(t), post = await createPost(env, actor, { slug: 'races', consent: 'public-attribution-v1' }, key());
  const saves = await Promise.allSettled(['one','two'].map(title => saveDraft(env, actor, post.id, { version: 0, source: example(title) }, key())));
  assert.equal(saves.filter(s => s.status === 'fulfilled').length, 1);
  const saved = saves.find(s => s.status === 'fulfilled').value;
  const actualPut = env.CONTENT.put.bind(env.CONTENT);
  let once = false;
  const racingEnv = { ...env, CONTENT: new Proxy(env.CONTENT, { get(target, prop) { if (prop === 'put') return async (...args) => { const result = await actualPut(...args); if (!once && args[0].includes('/render-')) { once = true; await withdraw(env, actor, post.id, { version: saved.version }, key()); } return result; }; const v = target[prop]; return typeof v === 'function' ? v.bind(target) : v; } }) };
  await assert.rejects(publish(racingEnv, actor, post.id, { version: saved.version, revision: saved.revision }, key()), { status: 409 });
  await assert.rejects(publicArticle(env, post.slug), { status: 404 });
});

test('administrator removal during staging denies commit and retains old publication', async t => {
  const { env, actor } = await setup(t), post = await createPost(env, actor, { slug: 'authority', consent: 'public-attribution-v1' }, key());
  const saved = await saveDraft(env, actor, post.id, { version: 0, source: example() }, key());
  await publish(env, actor, post.id, { version: 1, revision: saved.revision }, key());
  const correction = await saveDraft(env, actor, post.id, { version: 2, source: example('secret') }, key());
  const content = new Proxy(env.CONTENT, { get(target, prop) { const v = target[prop]; if (prop === 'put') return async (...args) => { const result = await v.apply(target,args); await env.DB.prepare('DELETE FROM administrators').run(); return result; }; return typeof v === 'function' ? v.bind(target) : v; } });
  await assert.rejects(publish({ ...env, CONTENT: content }, actor, post.id, { version: 3, revision: correction.revision }, key()), { status: 403 });
  assert.equal((await publicArticle(env, post.slug)).title, 'Public title');
});

test('missing or corrupted artifacts fail closed; deletion fences publication and reserves slug', async t => {
  const { env, actor } = await setup(t), post = await createPost(env, actor, { slug: 'deleted', consent: 'public-attribution-v1' }, key());
  const saved = await saveDraft(env, actor, post.id, { version: 0, source: example() }, key());
  await publish(env, actor, post.id, { version: 1, revision: saved.revision }, key());
  const [revision] = await rows(env, 'SELECT * FROM revisions WHERE id=?', saved.revision);
  await env.CONTENT.put(revision.manifest_key, '{"html":"evil"}');
  await assert.rejects(publicArticle(env, post.slug), { status: 503 });
  await withdraw(env, actor, post.id, { version: 2 }, key());
  await withdraw(env, actor, post.id, { version: 3 }, key(), true);
  await assert.rejects(publish(env, actor, post.id, { version: 4, revision: saved.revision }, key()), { status: 404 });
  await assert.rejects(createPost(env, actor, { slug: 'deleted', consent: 'public-attribution-v1' }, key()), { status: 409 });
  assert.equal((await rows(env, 'SELECT * FROM recovery_outbox')).length, 2);
});
