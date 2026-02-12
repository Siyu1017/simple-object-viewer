import { symbols } from "./symbols";
import { functionToCode, getType, isElement, isExpandable, safeString } from "./utils";
import styles from "./buildPreview.module.css";

export function buildPreview(value, options) {
    if (options && getType(options) !== 'Object') {
        throw new Error('options must be an object');
    } else {
        options = Object.assign({
            depth: 2,
            detail: true,
            maxArrayLength: 100,
            maxStringLength: 1000,
            maxSetLength: 5,
            maxMapLength: 5,
            maxObjectLength: 5,
            type: 'normal',
            self: null
        }, options);
    }

    function wrapText(text, type) {
        if (options.type === 'styleless') return `${text}`;
        return `<span class="${styles[type]}">${text}</span>`;
    }

    function safeWrapText(text, type) {
        return wrapText(safeString(text), type);
    }

    function wrapKey(key) {
        return safeWrapText(key, 'preview-key');
    }

    const seen = new WeakSet();

    function traverse(value, depth) {
        const type = getType(value);
        const isTop = depth == 0;
        const showDetail = options.detail == true && isTop;
        let preview = '';

        if (type === 'Object') {
            if (seen.has(value))
                // Circular
                return `{${symbols.ellipsis}}`;

            seen.add(value);
        }

        if (depth > options.depth) return symbols.ellipsis;

        if (type === 'Array') {
            const len = value.length;
            if (showDetail) {
                preview = value.slice(0, options.maxArrayLength).map(item => traverse(item, depth + 1)).join(', ');
                if (len > options.maxArrayLength)
                    preview += ', ' + symbols.ellipsis;

                return wrapText(`${len > 1 ? safeWrapText(`(${len})`, 'desc') : ''} [${preview}]`, 'array');
            }
            return wrapText(`Array(${safeString(len)})`, 'array');
        }

        if (type === 'Object') {
            if (showDetail) {
                const keys = Reflect.ownKeys(value);
                preview = keys.slice(0, options.maxObjectLength).map(k => {
                    const t = value[k];
                    return `${wrapKey(k)}: ${wrapText(traverse(t, depth + 1), getType(t).toLowerCase())}`;
                }).join(', ');

                if (keys.length > options.maxObjectLength)
                    preview += ', ' + symbols.ellipsis;

                return wrapText(`{${preview}}`, 'object');
            }

            if (depth > 0)
                return wrapText(`{${symbols.ellipsis}}`, 'object');

            return wrapText(`Object`, 'object');
        }

        if (type === 'String') {
            return wrapText(`\'${safeString(value)}\'`, 'string');
        }

        if (type.includes('Function')) {
            if (showDetail) {
                const fnCode = functionToCode(value);
                const cName = value.constructor?.toString().toLowerCase() || '';
                const isArrow = !value.prototype && !/^(?:async\s+)?function/.test(fnCode);
                const isAsync = cName.includes('async');
                const isGenerator = cName.includes('generator');
                const isClass = (fnCode || '').trim().startsWith('class');
                if (isClass) {
                    return wrapText(`${wrapText('class', 'keyword')} ${safeString(value.prototype?.constructor?.name)}`, 'function');
                } else if (isArrow) {
                    return wrapText(`${isAsync ? wrapText('async', 'keyword') : ''} () => {}`, 'function');
                } else {
                    preview += isAsync ? wrapText('async', 'keyword') : '';
                    preview += wrapText(`${isAsync ? ' ' : ''}${symbols.function}`, 'keyword');
                    preview += isGenerator ? wrapText('*', 'keyword') : '';
                    preview += ` ${value.name && fnCode.match(/function([\s\S]*?)\(.*?\)/)?.[1]?.replace('*', '').trim() ? safeString(value.name) : ''}()`;
                    return wrapText(preview, 'function');
                }
            } else {
                return wrapText(symbols.function, 'function');
            }
        }

        if (isElement(value)) {
            const id = value.id;
            const classArr = [...value.classList];
            const className = (classArr.length > 0 ? '.' : '') + classArr.join('.');
            return wrapText(`${safeWrapText(value.tagName.toLowerCase(), 'element-tagName')}${safeWrapText(id ? '#' + id : '', 'element-id')}${safeWrapText(className, 'element-className')}`, 'generic');
        }

        if (type === 'Map') {
            const size = value.size;

            if (showDetail) {
                const keys = [...value.keys()];
                preview = keys.slice(0, options.maxMapLength).map(k => {
                    const t = value.get(k);
                    return `${safeWrapText(`\'${k}\'`, 'string')} => ${traverse(t, depth + 1)}`;
                }).join(', ');
                if (size > options.maxMapLength) {
                    preview += ', ' + symbols.ellipsis;
                }
                return wrapText(`${wrapText(`Map(${safeString(size)})`, 'desc')} {${preview}}`, 'map');
            }
            return wrapText(`Map(${safeString(size)})`, 'map');
        }

        if (type === 'Set') {
            const size = value.size;

            if (showDetail) {
                const keys = [...value.keys()];
                preview = keys.slice(0, options.maxSetLength).map(k => {
                    return `${traverse(k, depth + 1)}`;
                }).join(', ');
                if (size > options.maxSetLength) {
                    preview += ', ' + symbols.ellipsis;
                }
                return wrapText(`${wrapText(`Set(${safeString(size)})`, 'desc')} {${preview}}`, 'set');
            }
            return wrapText(`Set(${safeString(size)})`, 'set');
        }

        if (type == 'Error') {
            return wrapText('Error: ' + safeString(value.message), 'error');
        }

        if ([
            'Number', 'Boolean', 'Null', 'Undefined', 'Symbol', 'Date', 'Regexp'
        ].includes(type)) {
            return wrapText(safeString(value), type.toLowerCase());
        }

        if (!isExpandable(value)) {
            return wrapText(safeString(value), type.toLowerCase());
        } else {
            return safeWrapText(type, type.toLowerCase());
        }
    }

    try {
        return traverse(options.self || value, 0);
    } catch (e) {
        const type = getType(options.self || value)
        return safeWrapText(type, type.toLowerCase());
    }
}
