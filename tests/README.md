# Smoke test

A no-browser boot + regression test for `index.html`, using [jsdom](https://www.npmjs.com/package/jsdom).

```bash
npm i --no-save jsdom   # once
node tests/smoke.js     # exits 0 on success, 1 on any FAIL
```

It checks that the app boots without the on-screen error bar, that the vendored
Supabase bundle (`supabase-2.119.0.js`) loads with no network, that navigation
renders, that the hobby-idea edit form and the hobby-block form never read
each other's fields (the duplicate-id bug fixed in v87), and that the v88
tab-open animations fire (karate sequence on the Karate tab, themed pop on
other tabs) and clean themselves up.

Add a check the same way: `ok("name", condition, optionalDetail)`.
