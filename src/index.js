import { clone, getType, isElement, isExpandable, safeString } from "./utils";
import styles from "./index.module.css";
import { buildPreview } from "./buildPreview";
import { symbols } from "./symbols";

const ROW_HEIGHT = 18;
const ROW_INDENT = 16;

class NodeManager {
    constructor(rootValue) {
        this.nextId = 0;
        this.nodeMap = new Map();

        this.root = this.createNode({
            value: rootValue
        });

        this.visibleNodes = [];
        this._buildVisibleNodes(this.root);
    }
    createNode({
        parent,
        key,
        value,
        valueGetter,
        preview,
        type = 'normal',
        self,
        attachment = null
    }) {
        const valueType = getType(value);
        try {
            if (typeof preview !== 'string') {
                preview = buildPreview(value, {
                    self: valueType.includes('Element') ? self : null
                })
            }
        } catch (e) {
            preview = `[Exception: ${e}]`;
        }

        const id = this.nextId++
        const listeners = new Map();
        const node = new Proxy({
            id: id,
            parent: parent,
            level: parent?.level + 1 || 0,
            key: key,
            valueRef: value,
            valueType: valueType,
            valueGetter: valueGetter || null,
            hasChildren: isExpandable(value),
            childrenLoaded: false,
            children: [],
            expanded: false,
            visibleSize: 1,
            preview: preview,
            type: typeof type === 'string' ? [type] : Array.isArray(type) ? type : ['normal'],
            on: (event, callback) => {
                if (!listeners.has(event))
                    listeners.set(event, []);
                listeners.get(event).push(callback);
            },
            self: self || null,
            attachment: attachment || null
        }, {
            set: (target, key, value) => {
                if (key === 'visibleSize' && value < 1)
                    throw new Error('visibleSize must be a positive integer');
                target[key] = value;
                listeners.get('visibleSizeChange')?.forEach(callback => callback());
                return true;
            }
        })

        node.accessGetter = () => {
            if (!node.valueGetter) return;
            try {
                node.valueRef = node.valueGetter();
                node.valueType = getType(node.valueRef);
                node.hasChildren = isExpandable(node.valueRef);
                if (!(node.valueType.includes('Element') && !isElement(node.valueRef))) {
                    node.self = node.valueRef;
                }

                if (node.type.includes('prototype')) {
                    node.preview = buildPreview(node.valueRef, {
                        detail: false
                    })
                } else {
                    node.preview = buildPreview(node.valueRef);
                }
            } catch (e) {
                node.valueRef = `[Exception: ${e}]`;
                node.valueType = 'string';
                node.hasChildren = false;
                node.type.push('styleless');
                node.preview = node.valueRef;
            }
        }
        node.increaseVisibleSize = (size) => {
            node.visibleSize += size;
            node.parent?.increaseVisibleSize(size);
        }
        node.decreaseVisibleSize = (size) => {
            node.visibleSize -= size;
            node.parent?.decreaseVisibleSize(size);
        }

        function extractKeys(self, keys) {
            const result = [];
            const accessors = [];
            keys.forEach(k => {
                const desc = Object.getOwnPropertyDescriptor(self, k);
                const hasGetter = desc && desc.get;
                const hasSetter = desc && desc.set;
                result.push(k);
                if (hasGetter || hasSetter) accessors.push(k);
            })

            return {
                common: result,
                accessors: accessors
            }
        }

        const createNodes = (data, keys, nodeType, self) => {
            keys.forEach(k => {
                const datas = [];
                if (nodeType.includes('accessors')) {
                    const desc = Object.getOwnPropertyDescriptor(data, k);
                    const getter = desc && desc.get;
                    const setter = desc && desc.set;
                    if (getter) {
                        datas.push({
                            key: 'get ' + String(k),
                            type: 'getterFunc',
                            value: getter
                        })
                    }
                    if (setter) {
                        datas.push({
                            key: 'set ' + String(k),
                            type: 'setterFunc',
                            value: setter
                        })
                    }
                } else {
                    const desc = Object.getOwnPropertyDescriptor(data, k);
                    try {
                        if (desc && desc.get) {
                            datas.push({
                                key: String(k),
                                type: 'getter',
                                value: '(...)',
                                getter: () => {
                                    return Reflect.get(data, k, self);
                                }
                            })
                        } else {
                            datas.push({
                                key: String(k),
                                type: 'common',
                                value: data[k]
                            })
                        }
                    } catch (e) {
                        if (desc && desc.get) {
                            datas.push({
                                key: String(k),
                                type: 'plaintext',
                                value: `[${e}]`
                            })
                        } else {
                            datas.push({
                                key: String(k),
                                type: 'plaintext',
                                value: `[${e}]`
                            })
                        }
                    }
                }

                let types = [];
                if (node.type.includes('[[prototype]]'))
                    types.push('prototype');
                if (nodeType.includes('property'))
                    types.push('property');

                datas.forEach(data => {
                    let childType = [...types];
                    if (data.type === 'getter') {
                        childType.push('styleless');
                        childType.push('getter');
                    }

                    if (data.type === 'plaintext')
                        childType.push('styleless');

                    const child = this.createNode({
                        parent: node,
                        key: data.key,
                        value: data.value,
                        type: childType,
                        preview: childType.includes('styleless') ? data.value : null,
                        self: data.value,
                        valueGetter: data.getter
                    })
                    node.children.push(child);
                })
            })
        }

        node.expand = () => {
            if (!node.childrenLoaded) {
                const type = getType(node.valueRef);

                if (node.attachment && node.type.includes('array') || type === 'Array' && !node.type.includes('[[prototype]]')) {
                    const { parentLevels, startIndex } = node.attachment || {};
                    const len = node.valueRef.length;
                    const start = startIndex || 0;

                    if (len > 100 || parentLevels > 1 && len == 100) {
                        const levels = parentLevels ? parentLevels - 1 : ~~(Math.log10(len - 1) / 2);
                        const chunkSize = Math.pow(100, levels);
                        const n = len / chunkSize;

                        for (let i = 0; i < n; i++) {
                            let value = node.valueRef.slice(i * chunkSize, (i + 1) * chunkSize);
                            let range = [start + i * chunkSize, start + (i + 1) * chunkSize - 1];

                            if (range[1] > len - 1 && start == 0) {
                                range[1] = len - 1;
                            }
                            if (range[0] == range[1]) {
                                value = value[0];
                            }

                            const child = this.createNode(range[0] == range[1] ? {
                                parent: node,
                                key: String(range[0]),
                                value: value,
                                preview: buildPreview(value)
                            } : {
                                parent: node,
                                value: value,
                                preview: `[${range[0]} ${symbols.ellipsis} ${range[1]}]`,
                                type: ['array'],
                                attachment: {
                                    parentLevels: levels,
                                    startIndex: range[0]
                                }
                            })
                            node.children.push(child);
                        }
                    } else {
                        for (let i = 0; i < len; i++) {
                            const value = node.valueRef[i];
                            const child = this.createNode({
                                parent: node,
                                key: String(start ? start + i : i),
                                value: value,
                                preview: buildPreview(value)
                            })
                            node.children.push(child);
                        }

                        const __proto__ = node.valueRef.__proto__ || Object.getPrototypeOf(node.valueRef);
                        if (__proto__) {
                            const child = this.createNode({
                                parent: node,
                                key: '[[Prototype]]',
                                value: __proto__,
                                type: ['[[prototype]]'],
                                self: node.valueRef,
                                preview: buildPreview(__proto__, {
                                    detail: false
                                })
                            })
                            node.children.push(child);
                        }
                    }
                } else if (type === 'Map') {
                    node.valueRef.keys().forEach((key, i) => {
                        const value = node.valueRef.get(key);
                        const child = this.createNode({
                            parent: node,
                            key: String(i),
                            value: { key, value },
                            preview: `{\"${safeString(key)}\" => ${buildPreview(value, {
                                detail: false,
                                depth: 1,
                                type: 'styleless'
                            })}}`,
                            type: ['dummy-object']
                        })
                        node.children.push(child);
                    })
                } else if (type === 'Set') {
                    node.valueRef.keys().forEach((value, i) => {
                        const child = this.createNode({
                            parent: node,
                            key: String(i),
                            value: { value },
                            preview: `${buildPreview(value, {
                                detail: false,
                                depth: 1,
                                type: 'styleless'
                            })}`,
                            type: ['dummy-object']
                        })
                        node.children.push(child);
                    })
                } else {
                    const commonKeys = Object.keys(node.valueRef).sort();
                    const propertyKeys = Object.getOwnPropertyNames(node.valueRef).filter(t => !commonKeys.includes(t)).sort();
                    const symbolKeys = Object.getOwnPropertySymbols(node.valueRef);

                    const commons = extractKeys(node.valueRef, commonKeys.concat(symbolKeys));
                    const properties = extractKeys(node.valueRef, propertyKeys);

                    createNodes(node.valueRef, commons.common, ['common'], node.self || node.valueRef);
                    createNodes(node.valueRef, properties.common, ['property'], node.self || node.valueRef);
                    createNodes(node.valueRef, commons.accessors.concat(properties.accessors), ['property', 'accessors'], node.self || node.valueRef);

                    const __proto__ = node.valueRef.__proto__ || Object.getPrototypeOf(node.valueRef);

                    if (__proto__ && !node.type.includes('dummy-object')) {
                        let preview;
                        if (type.includes('Element')) {
                            preview = getType(__proto__);
                        } else {
                            preview = buildPreview(__proto__, {
                                detail: false
                            });
                        }
                        const child = this.createNode({
                            parent: node,
                            key: '[[Prototype]]',
                            value: __proto__,
                            type: ['[[prototype]]'],
                            self: type.includes('Element') ? node.self : node.valueRef,
                            preview: preview
                        })
                        node.children.push(child);
                    }
                }

                node.childrenLoaded = true;
            }

            node.expanded = true;

            const childrenSize = this.findChildrenSize(node);
            node.visibleSize = childrenSize + 1;
            node.parent?.increaseVisibleSize(childrenSize);

            this.visibleNodes = [];
            this._buildVisibleNodes(this.root);
        }

        node.collapse = () => {
            if (node.valueGetter) {
                this.removeChildren(node);
                node.childrenLoaded = false;
                node.children = [];
            }

            for (const child of node.children) {
                if (child.valueGetter) {
                    if (child.hasChildren && child.childTypeLoaded) {
                        this.removeChildren(child);
                    }
                    child.children = [];
                    child.childrenLoaded = false;
                    child.expanded = false;
                    child.hasChildren = false;
                    child.valueRef = '(...)';
                    child.valueType = 'string';
                    child.preview = child.valueRef;
                    child.visibleSize = 1;
                }
            }

            node.expanded = false;
            node.parent?.decreaseVisibleSize(node.visibleSize - 1);
            node.visibleSize = 1;

            this.visibleNodes = [];
            this._buildVisibleNodes(this.root);
        }

        node.destroy = (self = true) => {
            if (node.hasChildren) {
                for (const child of node.children) {
                    child.destroy();
                }
            }
            node.visibleSize = 1;

            if (self == true) {
                this.nodeMap.delete(node.id);
            }
        }

        this.nodeMap.set(id, node);

        return node;
    }
    findNodeAtIndex(index) {
        function traverse(node, index) {
            if (index === 0) return node;
            index--;

            if (node.expanded && node.childrenLoaded && node.children) {
                for (const child of node.children) {
                    if (index < child.visibleSize) {
                        return traverse(child, index);
                    }
                    index -= child.visibleSize;
                }
            }

            return null;
        }

        return traverse(this.root, index);
    }
    findChildrenSize(node) {
        if (!node.hasChildren || !node.childrenLoaded || !node.expanded) return 0;

        let size = 0;
        for (const child of node.children) {
            size += this.findChildrenSize(child) + 1;
        }

        return size;
    }
    removeNode(node) {
        node.destroy();
        this.visibleNodes = [];
        this._buildVisibleNodes(this.root);
    }
    removeChildren(node) {
        node.destroy(false);
        this.visibleNodes = [];
        this._buildVisibleNodes(this.root);
    }
    _buildVisibleNodes(node) {
        this.visibleNodes.push(node);
        if (node.expanded && node.childrenLoaded && node.children) {
            for (const child of node.children) {
                this._buildVisibleNodes(child);
            }
        }
    }
}

function ObjectViewer(container, obj, options) {
    if (!container)
        throw new Error('container is required');
    if (!isElement(container))
        throw new Error('container must be an element');
    if (options && getType(options) !== 'Object')
        throw new Error('options must be an object');

    this.options = Object.assign({
        shallow: false,
        prototype: true
    }, options);

    this.nodeManager = new NodeManager(clone(obj));
    this.rows = {};

    this.nodeManager.root.on('visibleSizeChange', () => {
        this.render();
        this.rowsEl.style.height = `${this.nodeManager.root.visibleSize * ROW_HEIGHT}px`;
    })

    this.container = document.createElement('div');
    this.rowsEl = document.createElement('div');
    this.container.className = styles.container;
    this.rowsEl.className = styles.rows;
    container.appendChild(this.container);
    this.container.appendChild(this.rowsEl);

    let lastTime = 0;
    let lastScroll = 0;

    this.container.addEventListener('scroll', () => {
        if (this.container.scrollTop == lastScroll) return;

        const viewportSize = Math.ceil(this.container.clientHeight / ROW_HEIGHT);
        const scrollTop = this.container.scrollTop;
        const now = Date.now();
        const delta = now - lastTime;
        const distance = Math.abs(scrollTop - lastScroll);
        const speed = distance / delta * 1000;

        let tolerant = speed / ROW_HEIGHT * 2;
        let topTolerance = tolerant;
        let bottomTolerance = tolerant;

        if (tolerant > viewportSize * 2) {
            tolerant = viewportSize * 2;
        }

        if (scrollTop > lastScroll) {
            bottomTolerance = tolerant;
            topTolerance = ~~(tolerant * 0.3);
        } else {
            topTolerance = tolerant;
            bottomTolerance = ~~(tolerant * 0.3);
        }

        lastScroll = scrollTop;
        lastTime = now;

        this.render(topTolerance, bottomTolerance);
    })

    this.render();
}

ObjectViewer.prototype._getRowRange = function (topTolerance = 0, bottomTolerance = 0) {
    const topRow = ~~(this.container.scrollTop / ROW_HEIGHT);
    const bottomRow = ~~((this.container.scrollTop + this.container.clientHeight) / ROW_HEIGHT);

    let count = this.container.clientHeight / ROW_HEIGHT;
    let top = topRow - ~~(count / 2);
    let bottom = bottomRow + ~~(count / 2);

    top -= topTolerance;
    bottom += bottomTolerance;

    if (count > this.nodeManager.root.visibleSize) {
        return {
            start: 0,
            end: this.nodeManager.root.visibleSize - 1
        }
    } else {
        if (top < 0)
            top = 0;
        if (bottom > this.nodeManager.root.visibleSize - 1)
            bottom = this.nodeManager.root.visibleSize - 1;

        return {
            start: ~~top,
            end: ~~bottom
        }
    }
}

ObjectViewer.prototype._createRow = function (node, index) {
    const row = document.createElement('div');
    const indent = document.createElement('div');
    const content = document.createElement('div');
    const expand = document.createElement('div');
    const key = document.createElement('div');
    const colon = document.createElement('div');
    const preview = document.createElement('div');

    row.className = styles.row;
    row.style.height = `${ROW_HEIGHT}px`;
    row.style.lineHeight = `${ROW_HEIGHT}px`;

    indent.className = styles['row-indent'];
    content.className = styles['row-content'];
    expand.className = styles['row-expand'];
    key.className = styles['row-key'];
    colon.className = styles['row-colon'];
    preview.className = styles['row-preview'];
    row.style.top = `${index * ROW_HEIGHT}px`;

    row.appendChild(indent);
    row.appendChild(content);
    content.appendChild(expand);
    content.appendChild(key);
    content.appendChild(colon);
    content.appendChild(preview);

    function initialize() {
        updateKey(node.key);
        updatePreview(node.preview);
        updateIndent(node.level);

        key.style.removeProperty('opacity');
        key.style.removeProperty('fontWeight');
        key.style.removeProperty('color');

        if (node.type.includes('property')) {
            key.style.opacity = '.6';
        }
        if (node.type.includes('[[prototype]]')) {
            key.style.color = '#868686';
            key.style.fontWeight = '400';
        }
        if (node.type.includes('prototype')) {
            key.style.fontWeight = '400';
            key.style.opacity = '.6';
        }

        if (node.valueGetter && node.preview === '(...)') {
            row.classList.add(styles.getter);
            preview.addEventListener('click', getValue);

            function getValue(e) {
                e.preventDefault();
                e.stopPropagation();

                node.accessGetter();
                preview.removeEventListener('click', getValue);
                initialize();
            }
        } else {
            row.classList.remove(styles.getter);
        }

        if (node.key) {
            colon.textContent = ': ';
        } else {
            colon.textContent = '';
        }

        if (node.hasChildren) {
            expand.classList.add(styles.visible);
        } else {
            expand.classList.remove(styles.visible);
        }

        if (node.expanded) {
            expand.classList.add(styles.expanded);
        } else {
            expand.classList.remove(styles.expanded);
        }
    }

    initialize();

    function updateIndent(level) {
        indent.style.minWidth = `${level * ROW_INDENT}px`;
    }

    function updateKey(val) {
        key.textContent = val;
    }

    function updatePreview(val) {
        preview.innerHTML = val;
    }

    function updatePosition(val) {
        if (index === val) return;
        index = val;
        row.style.top = `${index * ROW_HEIGHT}px`;
    }

    row.addEventListener('click', () => {
        if (!node) return;

        if (!node.hasChildren) return;

        if (node.expanded) {
            node.collapse();
            expand.classList.remove(styles.expanded);
        } else {
            node.expand();
            expand.classList.add(styles.expanded);
        }

        this.render();
    })

    return {
        row, index, updatePosition
    };
}

ObjectViewer.prototype.render = function (topTolerance = 0, bottomTolerance = 0) {
    const rowRange = this._getRowRange(topTolerance, bottomTolerance);
    const scrollTop = this.container.scrollTop;
    const scrollLeft = this.container.scrollLeft;
    const nodes = this.nodeManager.visibleNodes.slice(rowRange.start, rowRange.end + 1);

    for (const [id, row] of Object.entries(this.rows)) {
        if (!nodes.find(node => node.id == id)) {
            row.row.remove();
            delete this.rows[id];
        }
    }

    let last = null;
    for (let i = nodes.length - 1; i >= 0; i--) {
        const node = nodes[i];
        if (!this.rows[node.id]) {
            const newRow = this._createRow(node, rowRange.start + i);
            if (last) {
                this.rowsEl.insertBefore(newRow.row, last);
            } else {
                this.rowsEl.appendChild(newRow.row);
            }
            this.rows[node.id] = newRow;
        } else {
            this.rows[node.id].updatePosition(rowRange.start + i);
        }

        last = this.rows[node.id].row;
    }

    this.container.scrollTop = scrollTop;
    if (scrollLeft > this.container.scrollWidth) {
        this.container.scrollLeft = this.container.scrollWidth;
    } else {
        this.container.scrollLeft = scrollLeft;
    }
}

export default ObjectViewer;
