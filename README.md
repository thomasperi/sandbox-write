# Sandbox FS

An experimental `fs` monkey patch for limiting write access to certain directories.

```javascript
// try/catch blocks omitted for brevity
const unbox = sandboxFs('/foo/bar', '/foo/sbor');
await fs.access('/foo/bar/zote.txt'); // succeeds
await fs.access('/foo/sbor/thed.txt'); // succeeds
await fs.access('/foo/sneg/baz.txt'); // fails
await fs.access('/boo/far.txt'); // fails
unbox(); 
await fs.access('/foo/sneg/baz.txt'); // succeeds now
await fs.access('/boo/far.txt'); // succeeds now
```

## Unfinished Features

* `mkdtemp` methods are not sandboxed yet
