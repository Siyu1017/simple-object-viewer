export function getType(obj) {
    return {}.toString.call(obj).slice(8, -1);
}

export function isExpandable(value) {
    if (value === null) return false;

    const t = typeof value;

    if (t !== "object" && t !== "function")
        return false;

    return true;
}

export function isElement(obj) {
    try {
        return obj instanceof Element;
    }
    catch (e) {
        return (typeof obj === "object") &&
            (obj.nodeType === 1) && (typeof obj.style === "object") &&
            (typeof obj.ownerDocument === "object");
    }
}

export function safeEscape(html) {
    return html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function functionToCode(fn) {
    try {
        return Function.prototype.toString.call(fn);
    } catch (e) { }
    try {
        return fn + '';
    } catch (e) { }
}

export function capitalizeFirstLetter(val) {
    return String(val).charAt(0).toUpperCase() + String(val).slice(1);
}

export function safeString(str) {
    if (typeof str !== 'string') {
        str = String(str);
    }
    return safeEscape(str);
}

/**
 * Based on implementation from:
 * https://github.com/angus-c/just/blob/master/packages/collection-clone/
 *
 * Original author: Angus Croll
 * License: MIT
 */
export function clone(obj) {
    const seen = new WeakSet();

    function _clone(obj) {
        let result = obj;
        const type = getType(obj);
        if (type == 'Set') {
            return new Set([...obj].map(value => _clone(value)));
        }
        if (type == 'Map') {
            return new Map([...obj].map(kv => [_clone(kv[0]), _clone(kv[1])]));
        }
        if (type == 'Date') {
            return new Date(obj.getTime());
        }
        if (type == 'RegExp') {
            return RegExp(obj.source, getRegExpFlags(obj));
        }
        if (type == 'Array' || type == 'Object') {
            // circular references detection
            if (seen.has(obj)) return obj;
            seen.add(obj);

            result = Array.isArray(obj) ? [] : {};
            if (type === 'Array') {
                for (var key in obj) {
                    // include prototype properties
                    result[key] = _clone(obj[key]);
                }
            } else {
                for (var key of Reflect.ownKeys(obj)) {
                    result[key] = _clone(obj[key]);
                }
            }
        }

        // primitives and non-supported objects (e.g. functions) land here
        return result;
    }

    return _clone(obj);
}

function getRegExpFlags(regExp) {
    if (typeof regExp.source.flags == 'string') {
        return regExp.source.flags;
    } else {
        var flags = [];
        regExp.global && flags.push('g');
        regExp.ignoreCase && flags.push('i');
        regExp.multiline && flags.push('m');
        regExp.sticky && flags.push('y');
        regExp.unicode && flags.push('u');
        return flags.join('');
    }
}