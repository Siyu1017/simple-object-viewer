# Simple Object Viewer

> [!WARNING]
> This project has been deprecated and replaced by [Object Inspector](https://github.com/Siyu1017/object-inspector).

![npm version](https://img.shields.io/npm/v/simple-object-viewer)
![npm downloads](https://img.shields.io/npm/dm/simple-object-viewer)
![license](https://img.shields.io/npm/l/simple-object-viewer)
![npm bundle size](https://img.shields.io/bundlephobia/min/simple-object-viewer)

A simple viewer for JavaScript objects.

It renders objects in a clean, expandable tree view.
Nothing fancy.

## Installation

```bash
npm install simple-object-viewer
```

## CDN

Simple Object Viewer can be loaded via CDN using ESM or UMD format.

### ESM

```js
import ObjectViewer from 'simple-object-viewer'
```

### UMD

```html
<script src="https://cdn.jsdelivr.net/npm/simple-object-viewer@latest/dist/index.umd.js"></script>
<script>
    const viewer = new ObjectViewer(container, object);
</script>
```

## Usage

```js
import ObjectViewer from 'simple-object-viewer'

const container = document.getElementById('container');

const obj = {
    name: 'John',
    age: 30,
    address: {
        city: 'New York',
        zip: 100
    }
}

new ObjectViewer(container, obj);
```

## What it does

At a glance, it just displays objects.

In practice, it also:

- ~~Displays objects~~
- Expands and collapses nested structures
- Handles deeply nested values
- Shows `[[Prototype]]` chains
- Detects getters and setters
- Supports `Symbol` properties
- Displays function signatures
- Safely handles circular references
- Differentiates value types (String, Number, Array, Object, etc.)

Still pretty simple.

## Contributing

Contributions are welcome!

If you'd like to make significant changes, please open an issue first to discuss what you would like to change.

## License

MIT
