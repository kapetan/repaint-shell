var events = require('events');
var util = require('util');
var fs = require('fs');
var path = require('path');
var url = require('url');
var domify = require('domify');
var defaultcss = require('defaultcss');
var repaint = require('repaint');
var xhr = require('xhr');
var debounce = require('debounce');
var jsonMarkup = require('json-markup');
var marked = require('marked');
var $ = require('dombo');

var html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
var style = fs.readFileSync(path.join(__dirname, 'index.css'), 'utf-8');

var defaultStyle = fs.readFileSync(path.join(__dirname, 'default.css'), 'utf-8');
var jsonStyle = fs.readFileSync(path.join(__dirname, '..', 'node_modules', 'json-markup', 'style.css'), 'utf-8');
var markdownStyle = fs.readFileSync(path.join(__dirname, '..', 'node_modules', 'github-markdown-css', 'github-markdown.css'), 'utf-8');

var noop = function() {};

var px = function(value) {
	return value + 'px';
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

var Web = function(options) {
	if(!(this instanceof Web)) return new Web(options);

	events.EventEmitter.call(this);
	options = options || {};
	this._options = options;

	var element = domify(html);
	this.element = element;
	this.canvas = $('canvas', element)[0];
	this.url = null;
};

util.inherits(Web, events.EventEmitter);

Web.prototype.appendTo = function(element) {
	if(typeof element === 'string') element = $(element)[0];
	if(this._options.style !== false) defaultcss('web', style);

	var self = this;

	element.appendChild(this.element);
	this.fillParent();

	$(window).on('resize', debounce(function() {
		self.fillParent();
	}));

	return this;
};

Web.prototype.load = function(url, scroll, callback) {
	if(!callback && typeof scroll === 'function') {
		callback = scroll;
		scroll = null;
	}

	if(!/^[^:]+:\/\//.test(url)) url = 'http://' + url;
	scroll = (typeof scroll === 'boolean') ? scroll : true;
	callback = callback || noop;

	var self = this;
	var canvas = this.canvas;
	var context = canvas.getContext('2d');
	var width = this.element.clientWidth;

	var ondone = function(err, page) {
		if(err) {
			self.emit('error', err);
			return callback(err);
		}

		self._url = url;
		if(scroll) self.element.scrollTop = 0;
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

		var stylesheets = [defaultStyle];

		if(isJson(response)) {
			body = json(body);
			stylesheets.push(jsonStyle);
		} else if(isMarkdown(response)) {
			body = markdown(body);
			stylesheets.push(markdownStyle);
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

Web.prototype.reload = function(callback) {
	if(this._url) this.load(this._url, false, callback);
};

Web.prototype.resize = function(width, height) {
	var element = this.element;
	var currentWidth = element.clientWidth;

	element.style.width = px(width);
	element.style.height = px(height);

	this.emit('resize', width, height);
	if(currentWidth !== width && this._url) this.load(this._url, false);
};

Web.prototype.clear = function() {
	var canvas = this.canvas;
	canvas.width = canvas.width;
};

Web.prototype.fillParent = function() {
	var element = this.element;
	var parent = element.offsetParent;

	if(!parent) return;

	var top = element.offsetTop;
	var width = parent.clientWidth;
	var height = parent.clientHeight;

	this.resize(width, height - top - 5);
};

module.exports = Web;
