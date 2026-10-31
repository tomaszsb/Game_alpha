// public/legacy-shims.js
//
// Stand-ins for browser features an older screen lacks. Tom's classroom touch board (2026-10-31: JAV LED65H10S,
// Android 11, Chrome 95 inside the board's own browser, no updates possible) has no structuredClone, so StateService
// threw on the first render and the player got the "Something went wrong" screen. Proved on a real Chromium 95.
//
// An ordinary same-origin script, like error-handler.js, so the CSP's script-src stays 'self'. index.html loads it
// BEFORE the game's module scripts, because a module's chunks run their imports first and a stand-in imported from
// main.tsx would run after them. Each stand-in is installed only where the browser has none, so a modern browser
// never runs this code. Written in plain old JavaScript on purpose. tests/utils/legacyShims.test.ts checks the clone
// against the browser's own on the same values, and runs it on a real saved game state.
(function (root) {
  'use strict';

  function dataCloneError(what) {
    var message = String(what) + ' could not be cloned.';
    if (typeof root.DOMException === 'function') return new root.DOMException(message, 'DataCloneError');
    var error = new Error(message);
    error.name = 'DataCloneError';
    return error;
  }

  // The tag, not instanceof: a value from another frame is still a Date.
  function tagOf(value) {
    return Object.prototype.toString.call(value).slice(8, -1);
  }

  // Same-frame constructors only, so a typed array or error comes back as what it was.
  function copyView(value, seen) {
    var buffer = copyValue(value.buffer, seen);
    if (tagOf(value) === 'DataView') return new DataView(buffer, value.byteOffset, value.byteLength);
    return new value.constructor(buffer, value.byteOffset, value.length);
  }

  var ERROR_NAMES = { EvalError: 1, RangeError: 1, ReferenceError: 1, SyntaxError: 1, TypeError: 1, URIError: 1 };

  function copyError(value, seen) {
    var name = ERROR_NAMES[value.name] ? value.name : 'Error';
    var copy = new root[name](value.message);
    seen.set(value, copy);
    if (typeof value.stack === 'string') copy.stack = value.stack;
    return copy;
  }

  function copyValue(value, seen) {
    var kind = typeof value;
    if (kind === 'function' || kind === 'symbol') throw dataCloneError(String(value));
    if (kind !== 'object' || value === null) return value;
    if (seen.has(value)) return seen.get(value);

    var tag = tagOf(value);
    var copy;
    switch (tag) {
      case 'Date':
        copy = new Date(value.getTime());
        break;
      case 'RegExp':
        copy = new RegExp(value.source, value.flags);
        break;
      case 'Boolean':
      case 'Number':
      case 'String':
      case 'BigInt':
        copy = Object(value.valueOf());
        break;
      case 'ArrayBuffer':
        copy = value.slice(0);
        break;
      case 'Blob':
      case 'File':
      case 'FileList':
      case 'ImageData':
      case 'ImageBitmap':
        // Cannot change once made, so the same one is as good as a copy here.
        return value;
      case 'Error':
        return copyError(value, seen);
      case 'Map':
        copy = new Map();
        seen.set(value, copy);
        value.forEach(function (v, k) {
          copy.set(copyValue(k, seen), copyValue(v, seen));
        });
        return copy;
      case 'Set':
        copy = new Set();
        seen.set(value, copy);
        value.forEach(function (v) {
          copy.add(copyValue(v, seen));
        });
        return copy;
      case 'Array':
        copy = new Array(value.length);
        break;
      case 'Object':
        copy = {};
        break;
      default:
        if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(value)) {
          copy = copyView(value, seen);
          break;
        }
        // WeakMap, Promise, a DOM node and the like: the browser's own clone refuses these too.
        throw dataCloneError('#<' + tag + '>');
    }
    seen.set(value, copy);
    if (tag === 'Array' || tag === 'Object') {
      // Own enumerable string keys only, read through any getter, in order. A class instance comes back a plain
      // object, and an array keeps its holes, exactly as the browser's own clone does.
      var keys = Object.keys(value);
      for (var i = 0; i < keys.length; i++) copy[keys[i]] = copyValue(value[keys[i]], seen);
    }
    return copy;
  }

  if (typeof root.structuredClone !== 'function') {
    root.structuredClone = function structuredClone(value) {
      if (arguments.length === 0) throw new TypeError("Failed to execute 'structuredClone': 1 argument required.");
      return copyValue(value, new Map());
    };
  }

  // Chrome 103. Every use here only asks "give up after this long", through fetch.
  if (typeof root.AbortSignal === 'function' && typeof root.AbortSignal.timeout !== 'function') {
    root.AbortSignal.timeout = function timeout(ms) {
      var controller = new root.AbortController();
      root.setTimeout(function () {
        controller.abort();
      }, ms);
      return controller.signal;
    };
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
