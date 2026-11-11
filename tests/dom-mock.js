class MockEventTarget {
  constructor() {
    this._listeners = new Map();
  }

  addEventListener(type, fn, capture = false) {
    const key = `${type}:${Boolean(capture)}`;
    if (!this._listeners.has(key)) this._listeners.set(key, new Set());
    this._listeners.get(key).add(fn);
  }

  removeEventListener(type, fn, capture = false) {
    const key = `${type}:${Boolean(capture)}`;
    const set = this._listeners.get(key);
    if (set) set.delete(fn);
  }

  dispatchEvent(event) {
    if (!event.target) event.target = this;
    for (const capture of [true, false]) {
      const key = `${event.type}:${capture}`;
      const set = this._listeners.get(key);
      if (set) {
        for (const fn of Array.from(set)) {
          fn(event);
        }
      }
    }
  }
}

class MockElement extends MockEventTarget {
  constructor(tagName, ownerDocument) {
    super();
    this.tagName = tagName.toUpperCase();
    this.nodeType = 1;
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.dataset = {};
    this.style = {};
    this.id = '';
    this.textContent = '';
    this.value = '';
    this.type = '';
    this.title = '';
    this.min = '';
    this.max = '';
    this.step = '';
    this._classes = new Set();
    this.shadowRoot = null;
    this.classList = {
      add: (...cls) => cls.forEach((c) => this._classes.add(c)),
      remove: (...cls) => cls.forEach((c) => this._classes.delete(c)),
      contains: (c) => this._classes.has(c)
    };
    this.isConnected = true;
  }

  set className(val) {
    this._classes = new Set(String(val).split(/\s+/).filter(Boolean));
  }

  get className() {
    return Array.from(this._classes).join(' ');
  }

  setAttribute(k, v) {
    this.attributes.set(k, String(v));
  }

  getAttribute(k) {
    return this.attributes.has(k) ? this.attributes.get(k) : null;
  }

  appendChild(child) {
    if (child.parentNode && child.parentNode !== this) {
      child.parentNode.removeChild(child);
    }
    child.parentNode = this;
    if (!this.children.includes(child)) {
      this.children.push(child);
    }
    return child;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  contains(other) {
    if (other === this) return true;
    return this.children.some((c) => c === other || (c.contains && c.contains(other)));
  }

  attachShadow() {
    const root = new MockElement('#shadow-root', this.ownerDocument);
    this.shadowRoot = root;
    return root;
  }

  querySelectorAll(selector) {
    const results = [];
    const targetTag = selector.toUpperCase();
    const walk = (node) => {
      for (const child of node.children || []) {
        if (child.tagName === targetTag || (selector.startsWith('.') && child._classes.has(selector.slice(1)))) {
          results.push(child);
        }
        walk(child);
      }
    };
    walk(this);
    return results;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
}

class MockVideoElement extends MockElement {
  constructor(ownerDocument, opts = {}) {
    super('VIDEO', ownerDocument);
    this._playbackRate = opts.playbackRate !== undefined ? opts.playbackRate : 1.0;
    this.defaultPlaybackRate = 1.0;
    this.preservesPitch = true;
    this.paused = opts.paused !== undefined ? opts.paused : false;
    this.ended = opts.ended !== undefined ? opts.ended : false;
    this.muted = opts.muted !== undefined ? opts.muted : false;
    this.readyState = opts.readyState !== undefined ? opts.readyState : 4;
    this._rect = opts.rect || { top: 0, left: 0, width: 1280, height: 720 };
    this.clientWidth = this._rect.width;
    this.clientHeight = this._rect.height;
  }

  get playbackRate() {
    return this._playbackRate;
  }

  set playbackRate(val) {
    this._playbackRate = val;
    this.dispatchEvent({ type: 'ratechange', target: this });
  }

  getBoundingClientRect() {
    return this._rect;
  }
}

class MockDocument extends MockEventTarget {
  constructor() {
    super();
    this.documentElement = new MockElement('HTML', this);
    this.body = new MockElement('BODY', this);
    this.documentElement.appendChild(this.body);
    this.fullscreenElement = null;
  }

  createElement(tag) {
    if (tag.toLowerCase() === 'video') {
      return new MockVideoElement(this);
    }
    return new MockElement(tag, this);
  }

  getElementById(id) {
    const walk = (node) => {
      if (node.id === id) return node;
      for (const child of node.children || []) {
        const found = walk(child);
        if (found) return found;
      }
      return null;
    };
    return walk(this.documentElement);
  }

  querySelectorAll(selector) {
    return this.documentElement.querySelectorAll(selector);
  }
}

module.exports = {
  MockDocument,
  MockElement,
  MockVideoElement
};

