var events = require('events');
var util = require('util');
var fs = require('fs');
var path = require('path');
var domify = require('domify');
var defaultcss = require('defaultcss');
var once = require('once');
var hat = require('hat');
var $ = require('dombo');

var html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
var svg = fs.readFileSync(path.join(__dirname, 'icons.html'), 'utf-8');
var style = fs.readFileSync(path.join(__dirname, 'index.css'), 'utf-8');

var prettifyUrl = function(url) {
	return url ? url.replace(/^https?:\/\//, '') : null;
};

var appendSvg = once(function() {
	document.head.appendChild(domify(svg));
});

var Tabs = function(options) {
	if(!(this instanceof Tabs)) return new Tabs(options);

	events.EventEmitter.call(this);
	this._options = options || {};

	var element = domify(html);
	this.element = element;
	this._tabs = $('ul', element)[0];

	var self = this;

	$('.add-tab', element).on('click', function(e) {
		self.create(null, null, true);
	});

	$(element).on('click', 'li', function(e) {
		self.active(e.target);
	});
};

util.inherits(Tabs, events.EventEmitter);

Tabs.prototype.active = function(element) {
	$('.active', this.element).removeClass('active');
	$(element).addClass('active');
	this.emit('active', element);
	return element;
};

Tabs.prototype.create = function(title, url, active) {
	title = title || prettifyUrl(url) || 'New Tab';
	var li = domify(util.format(
		'<li data-id="tab-%s" data-url="%s" title="%s">%s</li>',
		hat(), url || '', title, title));

	this._tabs.appendChild(li);

	this.emit('create', li);
	if(active) this.active(li);
	return li;
};

Tabs.prototype.update = function(element, title, url) {
	title = title || prettifyUrl(url);

	element.innerText = title;
	element.setAttribute('text', title);
	this.emit('update', element);
	return element;
};

Tabs.prototype.appendTo = function(element) {
	if(typeof element === 'string') element = $(element)[0];
	if(this._options.style !== false) defaultcss('tabs', style);
	appendSvg();
	element.appendChild(this.element);
	return this;
};

module.exports = Tabs;
