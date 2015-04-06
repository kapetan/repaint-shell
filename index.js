var fs = require('fs');
var path = require('path');
var events = require('events');
var util = require('util');
var url = require('url');

var repaint = require('repaint');
var xhr = require('xhr');
var debounce = require('debounce');
var ElementType = require('domelementtype');
var quotemeta = require('quotemeta');
var Handlebars = require('handlebars');
var hat = require('hat');
var jsonMarkup = require('json-markup');
var marked = require('marked');

var DEFAULT_STYLE = fs.readFileSync(path.join(__dirname, 'default.css'), 'utf-8');
var JSON_STYLE = fs.readFileSync(path.join(__dirname, 'node_modules', 'json-markup', 'style.css'), 'utf-8');
var MARKDOWN_STYLE = fs.readFileSync(path.join(__dirname, 'node_modules', 'github-markdown-css', 'github-markdown.css'), 'utf-8');

var noop = function() {};

var preventDefault = function(fn) {
	return function(e) {
		e.preventDefault();
		return fn.apply(this, arguments);
	};
};

var addClass = function(element, name) {
	element.className += (' ' + name);
};

var removeClass = function(element, name) {
	name = quotemeta(name);
	name = util.format('\\b%s\\b', name);
	name = new RegExp(name, 'gi');

	element.className = element.className.replace(name, '').trim();
};

var prettifyUrl = function(url) {
	return url ? url.replace(/^https?:\/\//, '') : null;
};

var px = function(value) {
	return value + 'px';
};

var text = function(nodes) {
	nodes = Array.isArray(nodes) ? nodes : [nodes];

	return nodes
		.reduce(function(acc, node) {
			if(node.type === ElementType.Text) acc.push(node.data);
			if(node.childNodes) acc.push(text(node.childNodes));
			return acc;
		}, [])
		.join('');
};

var template = function(name, locals) {
	var tmpl = document.getElementById(name).innerHTML;
	tmpl = Handlebars.compile(tmpl);
	tmpl = tmpl(locals);

	var div = document.createElement('div');
	div.innerHTML = tmpl;

	return div.children[0];
};

var isJson = function(response) {
	return /(text|application)\/json/.test(response.headers['content-type']);
};

var json = function(content) {
	content = JSON.parse(content);
	content = jsonMarkup(content);
	return util.format('<html><body>%s</body></html>', content);
};

var isMarkdown = function(response) {
	var pathname = url.parse(response.url).pathname;
	return /\.(md|markdown)$/i.test(pathname);
};

var markdown = function(content) {
	content = marked(content);
	return util.format('<html><body class="markdown-body">%s</body></html>', content);
};

var Tabs = function(tabs, content) {
	events.EventEmitter.call(this);

	this._element = document.getElementById(tabs);
	this._create = this._element.querySelector('.create');
	this._content = document.getElementById(content);

	var self = this;

	this._element.addEventListener('click', preventDefault(function(e) {
		var target = e.target;
		var current = self.active();

		if(current && current.contains(target)) return;
		if(self._create.contains(target)) return self.create(null, null, true);

		self.active(target);
	}));
};

util.inherits(Tabs, events.EventEmitter);

Tabs.prototype.active = function(element) {
	var current = this._element.querySelector('.active');

	if(element) {
		while(element && element.parentNode !== this._element) {
			element = element.parentNode;
		}

		if(element && element !== current) {
			if(current) {
				removeClass(current, 'active');
				this._toggleContent(current, false);
			}

			addClass(element, 'active');
			this._toggleContent(element, true);

			current = element;
			this.emit('active', current);
		}
	}

	return current;
};

Tabs.prototype.create = function(label, url, active) {
	label = label || prettifyUrl(url) || 'New Tab';

	var id = 'tab-' + hat();
	var tab = template('tab-template', { label: label, id: id });
	this._element.insertBefore(tab, this._create);

	var pane = template('tab-pane-template', { id: id });
	this._content.appendChild(pane);

	if(url) tab.dataset.url = url;
	this.emit('create', tab, pane);
	if(active) this.active(tab);
};

Tabs.prototype.destroy = function(element) {
	element.parentNode.removeChild(element);
	this.emit('destroy', element);
};

Tabs.prototype.update = function(element, label, url) {
	label = label || prettifyUrl(url);

	var a = element.querySelector('a');
	a.innerText = label;
	a.setAttribute('title', label);
	this.emit('update', element);
};

Tabs.prototype._toggleContent = function(element, show) {
	var a = element.querySelector('a');
	var id = '#' + a.href.split('#')[1];
	this._content.querySelector(id).style.display = (show ? 'block' : 'none');
};

var Navigation = function(element) {
	events.EventEmitter.call(this);

	this._element = element;
	this._reload = this._element.querySelector('.reload-control');
	this._address = this._element.querySelector('.address-control');

	this._current = null;

	var self = this;

	this._reload.addEventListener('click', preventDefault(function() {
		self.reload();
	}));
	this._element.addEventListener('submit', preventDefault(function() {
		var url = self._address.value;
		self.address(url);
	}));
};

util.inherits(Navigation, events.EventEmitter);

Navigation.prototype.reload = function() {
	if(!this._current) return;
	this._address.value = this._current;
	this.emit('reload', this._current);
};

Navigation.prototype.address = function(url) {
	url = url && url.trim();
	var current = this._current;

	if(url != null && url !== current) {
		this._current = url;
		current = url;
		this.emit('address', url);
	}

	this._address.value = current;
	return current;
};

var Web = function(element) {
	events.EventEmitter.call(this);

	this._element = element;
	this._canvas = element.querySelector('canvas');
	this._url = null;

	var self = this;

	this.fillParent();

	window.addEventListener('resize', debounce(function() {
		self.fillParent();
	}));
};

util.inherits(Web, events.EventEmitter);

Web.prototype.load = function(url, scroll, callback) {
	if(!callback && typeof scroll === 'function') {
		callback = scroll;
		scroll = null;
	}

	scroll = (typeof scroll === 'boolean') ? scroll : true;
	callback = callback || noop;

	var self = this;
	var canvas = this._canvas;
	var context = canvas.getContext('2d');
	var width = this._element.clientWidth;

	var ondone = function(err, page) {
		if(err) {
			self.emit('error', err);
			return callback(err);
		}

		self._url = url;
		if(scroll) self._element.scrollTop = 0;
		self.emit('load', page);
		callback(null, page);
	};

	xhr({
		url: url
	}, function(err, response, body) {
		if(err) return ondone(err);
		if(!/2\d\d/.test(response.statusCode)) {
			var message = util.format('Unexpected status code (%s): %s', response.statusCode, body);
			return ondone(new Error(message));
		}

		var stylesheets = [DEFAULT_STYLE];

		if(isJson(response)) {
			body = json(body);
			stylesheets.push(JSON_STYLE);
		} else if(isMarkdown(response)) {
			body = markdown(body);
			stylesheets.push(MARKDOWN_STYLE);
		}

		var page = repaint({
			url: url,
			stylesheets: stylesheets,
			content: body,
			context: context,
			viewport: {
				dimensions: {
					width: width
				}
			}
		}, ondone);

		page.once('layout', function(layout) {
			canvas.width = width;
			canvas.height = Math.ceil(layout.visibleHeight());
		});
	});
};

Web.prototype.resize = function(width, height) {
	var element = this._element;
	var currentWidth = element.clientWidth;

	element.style.width = px(width);
	element.style.height = px(height);

	this.emit('resize', width, height);
	if(currentWidth !== width && this._url) this.load(this._url, false);
};

Web.prototype.clear = function() {
	var canvas = this._canvas;
	canvas.width = canvas.width;
};

Web.prototype.fillParent = function() {
	var element = this._element;
	var parent = element.offsetParent;

	if(!parent) return;

	var top = element.offsetTop;
	var width = parent.clientWidth;
	var height = parent.clientHeight;

	this.resize(width, height - top - 5);
};

var tabs = new Tabs('tabs', 'tab-content');
var urls = JSON.parse(window.location.hash.replace(/^#/, ''));

tabs.on('active', function(tab) {
	var url = tab.dataset.url;
	var web = tab.state.web;
	var navigation = tab.state.navigation;

	delete tab.dataset.url;

	web.fillParent();
	if(url) navigation.address(url);
});

tabs.on('create', function(tab, pane) {
	var navigation = new Navigation(pane.querySelector('.navigation'));
	var web = new Web(pane.querySelector('.web-view'));

	tab.state = {
		navigation: navigation,
		web: web
	};

	navigation.on('address', function(url) {
		if(url) return web.load(url);
		web.clear();
	});

	navigation.on('reload', function(url) {
		web.load(url, false);
	});

	web.on('load', function(page) {
		var title = page.document.title;
		title = title && text(title).trim();
		tabs.update(tab, title, page.url);
	});

	web.on('error', function(err) {
		alert(err.message);
	});
});

if(!urls.length) urls = [null];

urls.forEach(function(url, i) {
	var last = i === urls.length - 1;
	tabs.create(null, url, last);
});
